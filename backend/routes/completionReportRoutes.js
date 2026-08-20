const express    = require('express');
const controller = require('../controllers/completionReportController');
const { protect }     = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const AUTH            = require('../constants/auth');

const router = express.Router();
router.use(protect);

// Staff (job lead) submits a report for their booking
router.post('/booking/:bookingId', requireRole(...AUTH.STAFF_ROLES), controller.submit);

// Admin views the full list or a specific report
router.get('/',                     requireRole(...AUTH.ADMIN_ROLES), controller.list);
router.get('/booking/:bookingId',   requireRole(...AUTH.STAFF_ROLES), controller.getByBooking);

// Admin can view any employee's report history for anomaly investigation
router.get('/employee/:userId',     requireRole(...AUTH.ADMIN_ROLES), controller.employeeHistory);

// Admin approves or rejects — triggers stock and loyalty side-effects
router.post('/:id/verify',          requireRole(...AUTH.ADMIN_ROLES), controller.verify);

module.exports = router;
