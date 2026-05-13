const crypto       = require('crypto');
const https        = require('https');
const bcrypt       = require('bcryptjs');
const User         = require('../models/User');
const OtpToken     = require('../models/OtpToken');
const tokenService = require('./tokenService');
const emailService = require('./emailService');
const AUTH         = require('../constants/auth');

const generateOtp = () => crypto.randomInt(100000, 999999).toString();

const issueOtp = async (email, purpose) => {
  const otp      = generateOtp();
  const expiresAt = new Date(Date.now() + AUTH.OTP_EXPIRY_MINUTES * 60 * 1000);
  const hashed   = await bcrypt.hash(otp, 10);

  await OtpToken.findOneAndDelete({ email, purpose });
  await OtpToken.create({ email, otp: hashed, purpose, expiresAt });
  await emailService.sendOtpEmail(email, otp, purpose);
};

const verifyOtp = async (email, otp, purpose) => {
  const record = await OtpToken.findOne({ email, purpose }).select('+otp');
  if (!record) throw new Error('OTP not found or expired');

  if (record.attempts >= AUTH.OTP_MAX_ATTEMPTS) {
    await OtpToken.deleteOne({ _id: record._id });
    throw new Error('Maximum OTP attempts exceeded. Please request a new OTP');
  }

  const isMatch = await bcrypt.compare(otp, record.otp);
  if (!isMatch) {
    record.attempts += 1;
    await record.save();
    const remaining = AUTH.OTP_MAX_ATTEMPTS - record.attempts;
    throw new Error(`Invalid OTP. ${remaining} attempt(s) remaining`);
  }

  await OtpToken.deleteOne({ _id: record._id });
};

const registerUser = async ({ name, email, password, phone, role }) => {
  const existing = await User.findOne({ email });
  if (existing) throw new Error('An account with this email already exists');

  await User.create({ name, email, password, phone, role: role || AUTH.ROLES.CUSTOMER });
  await issueOtp(email, AUTH.OTP_PURPOSES.VERIFY_EMAIL);

  return { email };
};

/**
 * Verifies the email OTP and returns auth tokens so the user is logged in immediately.
 */
const verifyEmail = async ({ email, otp }, ip) => {
  await verifyOtp(email, otp, AUTH.OTP_PURPOSES.VERIFY_EMAIL);
  const user = await User.findOneAndUpdate({ email }, { isVerified: true }, { new: true });
  if (!user) throw new Error('User not found');

  const accessToken  = tokenService.generateAccessToken(user._id, user.role);
  const refreshToken = await tokenService.generateRefreshToken(user._id, ip || null);

  return {
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
    accessToken,
    refreshToken,
  };
};

/**
 * Resends OTP for email verification or password reset.
 * Silently succeeds if email not found to avoid leaking account existence.
 */
const resendOtp = async ({ email, purpose = AUTH.OTP_PURPOSES.VERIFY_EMAIL }) => {
  const user = await User.findOne({ email });
  if (!user) return;

  if (purpose === AUTH.OTP_PURPOSES.VERIFY_EMAIL && user.isVerified) {
    throw new Error('Email is already verified');
  }

  await issueOtp(email, purpose);
};

const loginUser = async ({ email, password }, ip) => {
  const user = await User.findOne({ email }).select('+password');
  if (!user || !user.isActive) throw new Error('Invalid email or password.');
  if (!user.isVerified) throw new Error('Please verify your email before logging in');

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new Error('Invalid email or password.');

  // Issue a short-lived access token — if mustChangePassword is true, the
  // frontend must redirect to /force-change-password before doing anything else.
  const accessToken  = tokenService.generateAccessToken(user._id, user.role);
  const refreshToken = await tokenService.generateRefreshToken(user._id, ip);

  return {
    user: {
      id:                 user._id,
      name:               user.name,
      email:              user.email,
      role:               user.role,
      isVerified:         user.isVerified,
      mustChangePassword: user.mustChangePassword,
    },
    accessToken,
    refreshToken,
  };
};

/**
 * Completes a forced first-login password change.
 * Returns fresh tokens with the same shape as loginUser so the frontend can
 * treat this identically to a normal login response.
 */
const forceChangePassword = async (userId, { newPassword }, ip) => {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');
  if (!user.mustChangePassword) throw new Error('Password change is not required for this account');

  if (!AUTH.PASSWORD_REGEX.test(newPassword)) throw new Error(AUTH.PASSWORD_RULE);

  user.password           = newPassword;
  user.mustChangePassword = false;
  await user.save();

  // Revoke all existing tokens and issue fresh ones now that the account is fully set up
  await tokenService.revokeAllUserTokens(userId);
  const accessToken  = tokenService.generateAccessToken(user._id, user.role);
  const refreshToken = await tokenService.generateRefreshToken(user._id, ip);

  return {
    user: {
      id:    user._id,
      name:  user.name,
      email: user.email,
      role:  user.role,
    },
    accessToken,
    refreshToken,
  };
};

const refreshAccessToken = async (refreshToken, ip) => {
  const { userId, newToken } = await tokenService.rotateRefreshToken(refreshToken, ip);
  const user = await User.findById(userId);
  if (!user || !user.isActive) throw new Error('User not found or deactivated');

  const accessToken = tokenService.generateAccessToken(user._id, user.role);
  return { accessToken, refreshToken: newToken };
};

const forgotPassword = async (email) => {
  const user = await User.findOne({ email });
  if (!user) throw new Error('EMAIL_NOT_REGISTERED');
  await issueOtp(email, AUTH.OTP_PURPOSES.RESET_PASSWORD);
};

const resetPassword = async ({ email, otp, newPassword }) => {
  await verifyOtp(email, otp, AUTH.OTP_PURPOSES.RESET_PASSWORD);

  if (!AUTH.PASSWORD_REGEX.test(newPassword)) throw new Error(AUTH.PASSWORD_RULE);

  // select('+password') ensures Mongoose loads the current hash so isModified('password')
  // reliably returns true and the pre-save bcrypt hook fires to hash the new password.
  const user = await User.findOne({ email }).select('+password');
  if (!user) throw new Error('User not found');

  user.password   = newPassword;
  user.isVerified = true; // OTP ownership proof — user demonstrated access to this email
  await user.save();
  await tokenService.revokeAllUserTokens(user._id);
};

/**
 * Verifies a Google ID token using Google's tokeninfo endpoint (no extra package needed).
 * Creates a customer account if one doesn't exist yet.
 * Restricted to customers only — staff and admins must use email/password.
 */
const verifyGoogleIdToken = (idToken) => new Promise((resolve, reject) => {
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
  https.get(url, (res) => {
    let raw = '';
    res.on('data', (chunk) => { raw += chunk; });
    res.on('end', () => {
      try {
        const payload = JSON.parse(raw);
        if (payload.error) return reject(new Error('Invalid Google token'));
        resolve(payload);
      } catch {
        reject(new Error('Failed to parse Google verification response'));
      }
    });
  }).on('error', () => reject(new Error('Google token verification failed')));
});

const googleAuth = async ({ idToken }, ip) => {
  if (!process.env.GOOGLE_CLIENT_ID) throw new Error('Google OAuth is not configured on this server');

  const payload = await verifyGoogleIdToken(idToken);

  if (payload.aud !== process.env.GOOGLE_CLIENT_ID) throw new Error('Google token audience mismatch');
  if (payload.email_verified !== 'true' && payload.email_verified !== true) {
    throw new Error('Google account email is not verified');
  }

  const { email, name } = payload;
  let user = await User.findOne({ email });

  if (user) {
    if (user.role !== AUTH.ROLES.CUSTOMER) {
      throw new Error('Google sign-in is available for customers only');
    }
    if (!user.isActive) throw new Error('Account is deactivated. Please contact support.');
  } else {
    // Auto-create a verified customer account — no password required
    user = await User.create({
      name:      name || email.split('@')[0],
      email,
      password:  crypto.randomBytes(32).toString('hex'), // random unusable password
      role:      AUTH.ROLES.CUSTOMER,
      isVerified: true,
      isActive:   true,
    });
  }

  const accessToken  = tokenService.generateAccessToken(user._id, user.role);
  const refreshToken = await tokenService.generateRefreshToken(user._id, ip);

  return {
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
    accessToken,
    refreshToken,
  };
};

const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await User.findById(userId).select('+password');
  if (!user) throw new Error('User not found');

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) throw new Error('Current password is incorrect');

  if (!AUTH.PASSWORD_REGEX.test(newPassword)) throw new Error(AUTH.PASSWORD_RULE);

  user.password = newPassword;
  await user.save();
  await tokenService.revokeAllUserTokens(userId);
};

const updateUserProfile = async (userId, { name, phone }) => {
  const updates = {};
  if (name  !== undefined) updates.name  = name.trim();
  if (phone !== undefined) updates.phone = phone.trim();

  const user = await User.findByIdAndUpdate(userId, updates, { new: true, runValidators: true });
  if (!user) throw new Error('User not found');
  return { id: user._id, name: user.name, email: user.email, phone: user.phone };
};

const logoutUser = async (userId) => {
  await tokenService.revokeAllUserTokens(userId);
};

const getUserProfile = async (userId) => {
  const user = await User.findById(userId).select('-__v -password');
  if (!user) throw new Error('User not found');

  let bookingStats = {};
  let loyaltyData  = {};

  if (user.role === AUTH.ROLES.CUSTOMER) {
    try {
      const bookingService = require('./bookingService');
      bookingStats = await bookingService.getCustomerStats(userId);
    } catch {
      bookingStats = { totalBookings: 0, activeServices: 0, completedBookings: 0, recentBookings: [] };
    }

    try {
      const loyaltyService = require('./loyaltyService');
      const account = await loyaltyService.getOrCreateAccount(userId);
      loyaltyData = {
        currentBalance: account.currentBalance,
        lifetimePoints: account.lifetimePoints,
        currentTier:    account.currentTier,
      };
    } catch {
      loyaltyData = { currentBalance: 0, lifetimePoints: 0, currentTier: 'bronze' };
    }
  }

  return { ...user.toObject(), ...bookingStats, ...loyaltyData };
};

module.exports = {
  registerUser,
  verifyEmail,
  resendOtp,
  loginUser,
  forceChangePassword,
  refreshAccessToken,
  forgotPassword,
  resetPassword,
  googleAuth,
  logoutUser,
  getUserProfile,
  changePassword,
  updateUserProfile,
};
