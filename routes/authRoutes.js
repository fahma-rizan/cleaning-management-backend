const express        = require('express');
const rateLimit      = require('express-rate-limit');
const passport       = require('passport');
const authController = require('../controllers/authController');
const tokenService   = require('../services/tokenService');
const { protect }    = require('../middleware/authMiddleware');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 50, standardHeaders: true, legacyHeaders: false, // TODO: revert max to 5 after testing
  message: { success: false, message: 'Too many login attempts. Please try again in 1 hour.' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many registration attempts. Please try again in 1 hour.' },
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many password reset attempts. Please try again in 1 hour.' },
});

// ── Public ──────────────────────────────────────────────────────────────────
router.post('/register',          registerLimiter, authController.register);
router.post('/verify-email',      authController.verifyEmail);  // original path
router.post('/verify-otp',        authController.verifyEmail);  // spec alias
router.post('/resend-otp',        authController.resendOtp);
router.post('/login',             loginLimiter, authController.login);
router.post('/google',            authController.googleLogin); // legacy ID-token flow

// ── Google OAuth2 redirect flow (Passport) ──────────────────────────────────
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

router.get('/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=google_failed`,
  }),
  (req, res) => {
    if (!req.user) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=google_failed`);
    }
    const accessToken = tokenService.generateAccessToken(req.user._id, req.user.role);
    res.redirect(
      `${process.env.FRONTEND_URL}/auth/google/success?token=${accessToken}&userId=${req.user._id}`
    );
  }
);

router.post('/refresh-token',     authController.refreshToken);
router.post('/forgot-password',   forgotPasswordLimiter, authController.forgotPassword);
router.post('/reset-password',    authController.resetPassword);

// ── Protected (valid JWT required) ──────────────────────────────────────────
router.use(protect);
router.post('/force-change-password', authController.forceChangePassword);
router.post('/logout',                authController.logout);
router.get('/me',                     authController.getProfile);    // spec path
router.get('/profile',                authController.getProfile);    // original path
router.put('/profile',                authController.updateProfile);  // update name/phone
router.post('/change-password',       authController.changePassword); // change password (requires current)

module.exports = router;
