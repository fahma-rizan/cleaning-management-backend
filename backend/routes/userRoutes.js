const express          = require('express');
const userController   = require('../controllers/userController');
const { protect, checkPasswordChange } = require('../middleware/authMiddleware');
const { requireRole }  = require('../middleware/roleMiddleware');
const AUTH             = require('../constants/auth');

const router = express.Router();
router.use(protect);
router.use(checkPasswordChange);

// ── Any authenticated user ──────────────────────────────────────────────────
router.patch('/profile',         userController.updateProfile);
router.post('/change-password',  userController.changePassword);

// ── Admin-level: staff & customer management ────────────────────────────────
const anyAdmin = requireRole(...AUTH.ADMIN_ROLES);
router.get('/staff',             anyAdmin, userController.listStaff);
router.get('/customers',         anyAdmin, userController.listCustomers);
router.patch('/:id/active',      anyAdmin, userController.setActive);

// ── Create staff (operation_admin, main_admin, super_admin, admin) ──────────
router.post('/staff',             anyAdmin, userController.createStaff);
router.post('/create-staff',      anyAdmin, userController.createStaff);

// ── Create sub-admin (main_admin, super_admin, admin) ──────────────────────
const seniorAdmin = requireRole(AUTH.ROLES.SUPER_ADMIN, AUTH.ROLES.MAIN_ADMIN, AUTH.ROLES.ADMIN);
router.post('/create-sub-admin',  seniorAdmin, userController.createSubAdmin);

// ── Create main admin (super_admin, admin only) ────────────────────────────
const superOnly = requireRole(AUTH.ROLES.SUPER_ADMIN, AUTH.ROLES.ADMIN);
router.post('/create-main-admin', superOnly, userController.createMainAdmin);

module.exports = router;
