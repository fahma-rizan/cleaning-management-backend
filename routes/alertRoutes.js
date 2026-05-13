const express    = require('express');
const controller = require('../controllers/alertController');
const { protect }     = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const AUTH            = require('../constants/auth');

const router = express.Router();
router.use(protect);

// Active alerts visible to all staff so anyone can flag procurement needs
router.get('/',         requireRole(...AUTH.STAFF_ROLES), controller.getActive);

// Full history is an admin-only analytical view
router.get('/history',  requireRole(...AUTH.ADMIN_ROLES), controller.getHistory);

// Manual resolve is admin-only to prevent staff from hiding shortfalls
router.post('/resolve', requireRole(...AUTH.ADMIN_ROLES), controller.resolve);

module.exports = router;
