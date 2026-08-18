const express    = require('express');
const controller = require('../controllers/materialRequestController');
const { protect }     = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const AUTH            = require('../constants/auth');

const router = express.Router();
router.use(protect); // all material-request endpoints require authentication

// Admin triggers material need calculation for a booking manually
router.post('/booking/:bookingId', requireRole(...AUTH.ADMIN_ROLES), controller.create);

// Admin and staff can see the request queue and individual requests
router.get('/', requireRole(...AUTH.STAFF_ROLES), controller.list);
router.get('/booking/:bookingId', requireRole(...AUTH.STAFF_ROLES), controller.getByBooking);

// Only admin can approve or reject — these actions deduct real stock
router.post('/:id/approve', requireRole(...AUTH.ADMIN_ROLES), controller.approve);
router.post('/:id/reject',  requireRole(...AUTH.ADMIN_ROLES), controller.reject);

module.exports = router;
