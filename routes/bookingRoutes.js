const express = require('express');
const router  = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const {
  createBooking,
  getMyBookings,
  getAssignedBookings,
  checkSlotAvailability,
  rescheduleBooking,
  cancelBooking,
  startTask,
  completeTask,
  markCashReceived,
  declineTask,
  getAllBookings,
  assignAllUnassigned,
  getNeedsAttention,
  resolveAttention,
  sendInvoice,
} = require('../controllers/bookingController');

router.use(protect);

router.get('/slot-check',              checkSlotAvailability);
router.get('/my',                      getMyBookings);
router.get('/assigned',                getAssignedBookings);
router.get('/all',                     adminOnly, getAllBookings);
router.get('/needs-attention',         adminOnly, getNeedsAttention);
router.post('/',                       createBooking);
router.post('/assign-unassigned',      adminOnly, assignAllUnassigned);
router.patch('/:id/reschedule',        rescheduleBooking);
router.patch('/:id/cancel',            cancelBooking);
router.patch('/:id/start',             startTask);
router.patch('/:id/complete',          completeTask);
router.patch('/:id/cash-received',     markCashReceived);
router.patch('/:id/decline',           declineTask);
router.patch('/:id/resolve-attention', adminOnly, resolveAttention);
router.post('/:id/send-invoice',       sendInvoice);

module.exports = router;
