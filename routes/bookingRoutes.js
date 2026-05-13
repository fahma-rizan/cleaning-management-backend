const express           = require('express');
const bookingController = require('../controllers/bookingController');
const { protect }       = require('../middleware/authMiddleware');
const { requireRole }   = require('../middleware/roleMiddleware');
const AUTH              = require('../constants/auth');

const router = express.Router();
router.use(protect);

// Customer + staff/admin readable endpoints
router.get('/my-stats', requireRole(AUTH.ROLES.CUSTOMER), bookingController.getMyStats);
router.get('/',                                            bookingController.list);
router.get('/:id',                                         bookingController.getOne);

// Customer creates bookings
router.post('/', requireRole(AUTH.ROLES.CUSTOMER), bookingController.create);

// Staff / admin update status (confirm, assign, complete, cancel)
router.patch('/:id/status', requireRole(...AUTH.STAFF_ROLES, AUTH.ROLES.CUSTOMER), bookingController.updateStatus);

module.exports = router;
