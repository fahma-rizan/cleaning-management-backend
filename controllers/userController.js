const userService = require('../services/userService');
const AUTH        = require('../constants/auth');

/**
 * POST /api/users/staff  (backward compat)
 * POST /api/users/create-staff
 * Allowed: operation_admin, main_admin, super_admin, admin
 */
const createStaff = async (req, res) => {
  try {
    const allowedRoles = [AUTH.ROLES.STAFF];
    const user = await userService.createManagedUser(req.body, allowedRoles);
    res.status(201).json({ success: true, message: 'Staff member created.', data: user });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/users/create-sub-admin
 * Allowed: super_admin, main_admin, admin
 * Creates: operation_admin or customer_support_admin
 */
const createSubAdmin = async (req, res) => {
  try {
    const allowedRoles = [AUTH.ROLES.OPERATION_ADMIN, AUTH.ROLES.CUSTOMER_SUPPORT_ADMIN];
    const user = await userService.createManagedUser(req.body, allowedRoles);
    res.status(201).json({ success: true, message: 'Sub-admin created.', data: user });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/users/create-main-admin
 * Allowed: super_admin, admin only
 * Creates: main_admin
 */
const createMainAdmin = async (req, res) => {
  try {
    const allowedRoles = [AUTH.ROLES.MAIN_ADMIN];
    const user = await userService.createManagedUser(req.body, allowedRoles);
    res.status(201).json({ success: true, message: 'Main admin created.', data: user });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const listStaff = async (req, res) => {
  try {
    const { page, limit, role } = req.query;
    const data = await userService.listStaff({
      page:  parseInt(page)  || 1,
      limit: parseInt(limit) || 20,
      role,
    });
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const listCustomers = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const data = await userService.listCustomers({
      page:  parseInt(page)  || 1,
      limit: parseInt(limit) || 20,
    });
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const setActive = async (req, res) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isActive must be a boolean' });
    }
    const user = await userService.setUserActive(req.params.id, isActive);
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const user = await userService.updateProfile(req.user._id, req.body);
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'currentPassword and newPassword are required' });
    }
    const result = await userService.changePassword(req.user._id, { currentPassword, newPassword });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = {
  createStaff,
  createSubAdmin,
  createMainAdmin,
  listStaff,
  listCustomers,
  setActive,
  updateProfile,
  changePassword,
};
