const User         = require('../models/User');
const AUTH         = require('../constants/auth');
const emailService = require('./emailService');

const validatePasswordStrength = (password) => {
  if (!AUTH.PASSWORD_REGEX.test(password)) throw new Error(AUTH.PASSWORD_RULE);
};

/**
 * Creates a staff member or any admin below super_admin.
 * Sends temporary credentials to the new user's email.
 *
 * @param {string} role - Must be one of the allowed managed roles.
 * @param {string[]} allowedRoles - Roles the calling admin is permitted to create.
 */
const createManagedUser = async ({ name, email, phone, role, tempPassword }, allowedRoles) => {
  if (!allowedRoles.includes(role)) {
    throw new Error(`You do not have permission to create a user with role: ${role}`);
  }

  const existing = await User.findOne({ email });
  if (existing) throw new Error('An account with this email already exists');

  validatePasswordStrength(tempPassword);

  const user = await User.create({
    name,
    email,
    phone,
    role,
    password:           tempPassword,
    isVerified:         true,
    mustChangePassword: true,
    isActive:           true,
  });

  await emailService.sendTempCredentials(email, { name, tempPassword, role });

  return { id: user._id, name: user.name, email: user.email, role: user.role };
};

// Kept for backward compat — existing POST /api/users/staff route calls this
const createStaffUser = async ({ name, email, phone, role, tempPassword }) => {
  const STAFF_CREATABLE = [
    AUTH.ROLES.STAFF,
    AUTH.ROLES.OPERATION_ADMIN,
    AUTH.ROLES.CUSTOMER_SUPPORT_ADMIN,
  ];
  return createManagedUser({ name, email, phone, role, tempPassword }, STAFF_CREATABLE);
};

/** List all staff / sub-admins (admin only) */
const listStaff = async ({ page = 1, limit = 20, role } = {}) => {
  const MANAGED_ROLES = [
    AUTH.ROLES.STAFF,
    AUTH.ROLES.OPERATION_ADMIN,
    AUTH.ROLES.CUSTOMER_SUPPORT_ADMIN,
    AUTH.ROLES.MAIN_ADMIN,
  ];
  const filter = { role: { $in: MANAGED_ROLES } };
  if (role) filter.role = role;

  const skip = (page - 1) * limit;
  const [users, total] = await Promise.all([
    User.find(filter).select('-password -__v').skip(skip).limit(limit).sort({ createdAt: -1 }),
    User.countDocuments(filter),
  ]);

  return { users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

/** List all customers (admin only) */
const listCustomers = async ({ page = 1, limit = 20 } = {}) => {
  const filter = { role: AUTH.ROLES.CUSTOMER };
  const skip   = (page - 1) * limit;
  const [users, total] = await Promise.all([
    User.find(filter).select('-password -__v').skip(skip).limit(limit).sort({ createdAt: -1 }),
    User.countDocuments(filter),
  ]);
  return { users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

/** Toggle active/inactive */
const setUserActive = async (userId, isActive) => {
  const user = await User.findByIdAndUpdate(userId, { isActive }, { new: true }).select('-password -__v');
  if (!user) throw new Error('User not found');
  return user;
};

/** Update own profile — address management is now via /api/addresses */
const updateProfile = async (userId, { name, phone }) => {
  const updates = {};
  if (name)  updates.name  = name;
  if (phone) updates.phone = phone;

  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  Object.assign(user, updates);
  user.profileComplete = !!(user.name && user.phone && user.addresses?.length > 0);
  await user.save();

  return user;
};

/**
 * Change password from settings — requires current password for all users.
 * (Force-change flow is handled separately in authService.forceChangePassword)
 */
const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await User.findById(userId).select('+password');
  if (!user) throw new Error('User not found');

  const valid = await user.comparePassword(currentPassword);
  if (!valid) throw new Error('Current password is incorrect');

  validatePasswordStrength(newPassword);

  user.password           = newPassword;
  user.mustChangePassword = false;
  await user.save();
  return { message: 'Password changed successfully' };
};

module.exports = {
  createManagedUser,
  createStaffUser,
  listStaff,
  listCustomers,
  setUserActive,
  updateProfile,
  changePassword,
};
