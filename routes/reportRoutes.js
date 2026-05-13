const express    = require('express');
const controller = require('../controllers/reportController');
const { protect }     = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const AUTH            = require('../constants/auth');

const router = express.Router();
router.use(protect);

// All report endpoints are admin-only — financial and operational data
router.get('/monthly',    requireRole(...AUTH.ADMIN_ROLES), controller.monthly);
router.get('/anomalies',  requireRole(...AUTH.ADMIN_ROLES), controller.anomalies);

module.exports = router;
