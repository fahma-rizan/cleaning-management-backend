const mongoose = require('mongoose');
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

const Booking = require('../models/Booking');
const Invoice = require('../models/Invoice');
const Refund = require('../models/Refund');
const { determineInvoiceDetails, generateInvoiceNumber } = require('../utils/invoiceUtils');

/**
 * @route   GET /api/bookings
 * @desc    Get all bookings
 * @access  Private (for staff/admin)
 */
router.get('/', auth, async (req, res, next) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/bookings/:id
 * @desc    Get booking details by ID — accepts either a MongoDB ObjectId
 *          or the human-readable bookingId string (e.g. BK-...)
 * @access  Public (no auth — needed for QR-code-scanned pages like
 *          JobCompletePage and PaymentGatewayPage's polling check, which
 *          may not have an active session token)
 */
router.get('/:id', async (req, res, next) => {
  try {
    const param = req.params.id;

    // Try by MongoDB ObjectId first
    let booking = null;
    if (mongoose.Types.ObjectId.isValid(param)) {
      booking = await Booking.findById(param);
    }

    // If not found, try searching by the human-friendly bookingId field (e.g. BK-...)
    if (!booking) {
      booking = await Booking.findOne({ bookingId: param });
    }

    if (!booking) {
      return res.status(404).json({ msg: 'Booking not found' });
    }

    res.json(booking);
  } catch (err) {
    console.error(err.message);
    next(err);
  }
});

/**
 * @route   POST /api/bookings
 * @desc    Create a new booking (before payment)
 * @access  Public
 *
 * FIX 1: advanceAmount changed from 50% to 20% to match the PayHere hash route
 *         and the UI which shows "Pay 20% advance".
 * FIX 2: Initial status set to 'PENDING' — not 'ADVANCE_PAID'. The PayHere
 *         notify webhook updates the status to ADVANCE_PAID / CONFIRMED after
 *         the payment actually succeeds.
 */
router.post('/', async (req, res, next) => {
  try {
    const { bookingId, customerId, email, serviceItems, date, time, address } = req.body;

    if (!bookingId || !customerId || !email || !serviceItems || serviceItems.length === 0 || !date || !time || !address) {
      return res.status(400).json({ msg: 'Missing required fields' });
    }

    const totalPrice = serviceItems.reduce((acc, item) => acc + item.price, 0);

    // FIX 1: Use 20% advance to match PayHere route and UI
    const advanceAmount = totalPrice * 0.20;
    const balanceAmount = totalPrice - advanceAmount;

    const newBooking = new Booking({
      bookingId,
      customerId,
      email,
      serviceItems,
      price: totalPrice,
      date,
      time,
      address,
      status: 'pending', // master schema: lowercase
      advanceAmount,
      balanceAmount,
    });

    await newBooking.save();
    res.status(201).json(newBooking);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/bookings/:id/cancel
 * @desc    Cancel a booking and create a refund request for the advance
 * @access  Private
 *
 * FIX 1: Added auth middleware — unauthenticated users could previously cancel
 *         any booking by guessing the ID.
 * FIX 2: Refund now links to the correct Invoice._id (not booking._id).
 *         The Refund model's 'invoice' field is a reference to the Invoice
 *         collection — storing a Booking _id broke populate() in the admin panel.
 */
router.post('/:id/cancel', auth, async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ msg: 'Booking not found' });
    }

    // Only the owner can cancel their booking
    if (booking.customerId.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorised to cancel this booking' });
    }

    if (booking.status === 'cancelled' || booking.status === 'completed') {
      return res.status(400).json({ msg: `Booking is already ${booking.status.toLowerCase()}` });
    }

    booking.status = 'cancelled';
    await booking.save();

    // Create a refund if an invoice exists and customer paid online before service
    const invoice = await Invoice.findOne({ bookingId: booking._id }) || await Invoice.findOne({ invoiceNumber: booking.bookingId });
    const paidAmt = (invoice && invoice.paidAmount) || booking.paidAmount || booking.advanceAmount || 0;

    if (invoice && paidAmt > 0) {
      const existingRefund = await Refund.findOne({ invoice: invoice._id, status: { $in: ['PENDING', 'APPROVED'] } });
      if (!existingRefund) {
        const refund = new Refund({
          invoice: invoice._id,
          reason: 'Booking cancelled by customer',
          status: 'PENDING',
          refundedAmount: paidAmt,
        });
        await refund.save();

        invoice.status = 'REFUND_PENDING';
        await invoice.save({ validateBeforeSave: false });
      }
    }

    res.json({ msg: 'Booking cancelled and refund process initiated if payment was made', booking });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/bookings/:id/record-cash-payment
 * @desc    Record that the balance was paid in cash
 * @access  Private (Staff)
 */
router.post('/:id/record-cash-payment', auth, async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ msg: 'Booking not found' });
    }

    booking.paymentMethod = 'CASH';
    booking.balancePaid = true;
    booking.status = 'completed';
    await booking.save();

    res.json({ msg: 'Cash payment recorded successfully', booking });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/bookings/:id/complete
 * @desc    Mark a service as complete and create a balance invoice if needed.
 *          Called by JobCompletePage when staff scans the invoice QR code
 *          on-site and taps "Mark Job as Complete".
 * @access  Private (Staff)
 *
 * FIX: Replaced the self-referencing loopback fetch() calls with direct
 *      imports. Calling localhost:4000 from within the same process is fragile
 *      (breaks in Docker, load balancers, different PORT values) and adds
 *      unnecessary network overhead.
 */
router.post('/:id/complete', auth, async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ msg: 'Booking not found' });
    }

    // If balance already paid, just mark complete
    if (booking.balancePaid || booking.balanceAmount <= 0) {
      booking.status = 'completed';
      await booking.save();
      return res.json({ msg: 'Service marked as complete', booking });
    }

    // Balance is outstanding — create a FINAL invoice directly (no loopback fetch)
    const { prefix, categories } = determineInvoiceDetails(booking.serviceItems);
    const invoiceNumber = await generateInvoiceNumber(prefix);

    const balanceInvoice = new Invoice({
      invoiceNumber,
      invoiceType: 'FINAL',
      mainCategories: categories,
      // FIX: bookingId on Invoice is ObjectId ref:'Booking' (master schema) —
      // was incorrectly set to booking.bookingId (the readable string).
      bookingId: booking._id,
      customer: {
        userId:  booking.customerId,
        name:    booking.customerName || 'Customer',
        // FIX: Booking schema stores this as customerEmail, not email.
        // booking.email was always undefined, which failed the Invoice
        // model's required customer.email validation with a 400 error.
        email:   booking.customerEmail || booking.email || 'no-reply@cloudlaundry.lk',
        address: booking.address,
      },
      serviceItems: (booking.serviceItems && booking.serviceItems.length > 0)
        ? booking.serviceItems.map(item => ({ name: item.name, price: item.price, quantity: 1 }))
        : [{ name: booking.serviceName || 'Service', price: booking.balanceAmount, quantity: 1 }],
      subTotal: booking.balanceAmount,
      totalAmount: booking.balanceAmount,
      paidAmount: 0,
      balanceAmount: booking.balanceAmount,
      status: 'SENT',
    });

    await balanceInvoice.save();

    booking.status = 'completed';
    await booking.save();

    // Notify admin in real time that a job was completed
    const io = req.app.get('socketio');
    if (io) io.to('admin-room').emit('booking-completed', booking);

    res.json({
      msg: 'Service marked as complete. Balance invoice created for customer.',
      invoiceNumber: balanceInvoice.invoiceNumber,
      balanceAmount: booking.balanceAmount,
      booking,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/bookings/:id/request-reschedule
 * @desc    Admin requests the customer reschedule their booking
 * @access  Private
 */
router.post('/:id/request-reschedule', auth, async (req, res, next) => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ msg: 'Booking not found' });

    const io = req.app.get('socketio');
    if (io && booking.customerId) {
      io.to(`user:${booking.customerId}`).emit('notification', {
        type:    'reschedule-request',
        title:   'Reschedule Requested',
        message: reason || 'Please contact us to reschedule your booking.',
        bookingId: booking.bookingId,
      });
    }

    res.json({ msg: 'Reschedule request sent to customer.' });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/bookings/:id/request-cancel
 * @desc    Admin requests the customer confirm cancellation
 * @access  Private
 */
router.post('/:id/request-cancel', auth, async (req, res, next) => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ msg: 'Booking not found' });

    const io = req.app.get('socketio');
    if (io && booking.customerId) {
      io.to(`user:${booking.customerId}`).emit('notification', {
        type:    'cancel-request',
        title:   'Cancellation Requested',
        message: reason || 'Please confirm if you would like to cancel your booking.',
        bookingId: booking.bookingId,
      });
    }

    res.json({ msg: 'Cancel request sent to customer.' });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/bookings/:id/decline-reschedule
 * @desc    Customer declines admin reschedule request -> triggers refund if paid online
 * @access  Private
 */
router.post('/:id/decline-reschedule', auth, async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id) || await Booking.findOne({ bookingId: req.params.id });

    if (!booking) {
      return res.status(404).json({ msg: 'Booking not found' });
    }

    booking.status = 'cancelled';
    await booking.save({ validateBeforeSave: false });

    const invoice = await Invoice.findOne({ bookingId: booking._id }) || await Invoice.findOne({ invoiceNumber: booking.bookingId });
    const paidAmt = (invoice && invoice.paidAmount) || booking.paidAmount || booking.advanceAmount || 0;

    let refundCreated = false;
    if (invoice && paidAmt > 0) {
      const existingRefund = await Refund.findOne({ invoice: invoice._id, status: { $in: ['PENDING', 'APPROVED'] } });
      if (!existingRefund) {
        const refund = new Refund({
          invoice: invoice._id,
          reason: 'Customer declined admin reschedule request',
          status: 'PENDING',
          refundedAmount: paidAmt,
        });
        await refund.save();
        invoice.status = 'REFUND_PENDING';
        await invoice.save({ validateBeforeSave: false });
        refundCreated = true;
      }
    }

    res.json({
      msg: refundCreated
        ? 'Reschedule declined. Booking cancelled and refund request initiated.'
        : 'Reschedule declined. Booking cancelled.',
      booking,
    });
  } catch (err) {
    next(err);
  }
});

// FIX: module.exports must be at the END of the file.
module.exports = router;
