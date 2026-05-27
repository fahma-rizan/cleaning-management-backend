const mongoose = require('mongoose');
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

const Booking = require('../models/Booking');

const Refund = require('../models/Refund');

/**
 * @route   GET /api/bookings
 * @desc    Get all bookings
 * @access  Private (for staff/admin)
 */
router.get('/', auth, async (req, res) => {
  try {
    // Staff should see all bookings, sorted by most recent
    const bookings = await Booking.find().sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

/**
 * @route   POST /api/bookings
 * @desc    Create a new booking with an advance payment
 * @access  Public
 */
router.post('/', async (req, res) => {
  try {
    const { bookingId, userId, email, serviceItems, date, time, address } = req.body;

    // Basic validation
    if (!bookingId || !userId || !email || !serviceItems || serviceItems.length === 0 || !date || !time || !address) {
      return res.status(400).json({ msg: 'Missing required fields' });
    }

    // Calculate total price from all service items
    const totalPrice = serviceItems.reduce((acc, item) => acc + item.price, 0);

    // Calculate advance and balance (50% advance)
    const advanceAmount = totalPrice * 0.5;
    const balanceAmount = totalPrice - advanceAmount;

    // Create new booking
    const newBooking = new Booking({
      bookingId,
      userId,
      email,
      serviceItems,
      price: totalPrice, // Store the calculated total price
      date,
      time,
      address,
      status: 'ADVANCE_PAID', // New status
      advanceAmount,
      balanceAmount,
    });

    await newBooking.save();
    res.status(201).json(newBooking);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

/**
 * @route   POST /api/bookings/:id/cancel
 * @desc    Cancel a booking and trigger a refund for the advance payment
 * @access  Private (should be protected)
 */
router.post('/:id/cancel', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ msg: 'Booking not found' });
    }

    // Prevent cancelling already cancelled or completed bookings
    if (booking.status === 'CANCELLED' || booking.status === 'COMPLETED') {
      return res.status(400).json({ msg: `Booking is already ${booking.status.toLowerCase()}` });
    }

    // Update booking status
    booking.status = 'CANCELLED';
    await booking.save();

    // Create a refund request for the advance amount
    if (booking.advanceAmount > 0) {
      const refund = new Refund({
        invoice: booking._id, // Link to the booking
        reason: 'Booking cancelled by customer',
        status: 'PENDING',
        refundedAmount: booking.advanceAmount,
      });
      await refund.save();
    }

    res.json({ msg: 'Booking cancelled and refund process initiated', booking });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});


/**
 * @route   GET api/bookings/:id
 * @desc    Get booking details by ID. If the ID is 'new', create a new sample booking for testing.
 * @access  Private
 */
router.get('/:id', async (req, res) => {
  try {
    let booking;

    if (req.params.id === 'new') {
      // This is a temporary feature for easy testing.
      // It creates a new booking record that we can use to test the payment flow.
      const newBookingId = new mongoose.Types.ObjectId();
      booking = new Booking({
        _id: newBookingId,
        bookingId: `BK-${Date.now()}`,
        userId: new mongoose.Types.ObjectId(),
        email: 'farhathays.123@gmail.com',
        serviceItems: [
          { name: 'Apartment Deep Cleaning', price: 7500 },
          { name: 'Laundry Service', price: 2500 },
        ],
        price: 10000, // Total price
        date: '2026-05-20',
        time: '2:00 PM',
        address: '456 Park Avenue, Colombo 02',
        status: 'PENDING',
      });
      await booking.save();
      // FIX (Critical): Return JSON instead of HTML redirect from API endpoint
      return res.status(201).json(booking);
    } else {
      booking = await Booking.findById(req.params.id);
    }

    if (!booking) {
      return res.status(404).json({ msg: 'Booking not found' });
    }
    res.json(booking);
  } catch (err) {
    console.error(err.message);
    // If the ID format is invalid, Mongoose throws a CastError
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Booking not found' });
    }
    res.status(500).send('Server Error');
  }
});

module.exports = router;

/**
 * @route   POST /api/bookings/:id/record-cash-payment
 * @desc    Record that the balance was paid in cash
 * @access  Private (Staff)
 */
router.post('/:id/record-cash-payment', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ msg: 'Booking not found' });
    }

    booking.paymentMethod = 'CASH';
    booking.balancePaid = true;
    booking.status = 'COMPLETED'; // Mark as completed since final payment is made
    await booking.save();

    res.json({ msg: 'Cash payment recorded successfully', booking });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

/**
 * @route   POST /api/bookings/:id/complete
 * @desc    Mark a service as complete and handle balance payment
 * @access  Private (Staff)
 */
router.post('/:id/complete', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ msg: 'Booking not found' });
    }

    // If balance is already paid (e.g., via cash), just complete the booking
    if (booking.balancePaid) {
      booking.status = 'COMPLETED';
      await booking.save();
      return res.json({ msg: 'Service marked as complete', booking });
    }

    // If balance is not paid, generate a payment link for the customer
    if (booking.balanceAmount > 0) {
      // 1. Create an invoice for the balance amount
      const invoiceResponse = await fetch(`http://localhost:${process.env.PORT || 4000}/api/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.bookingId,
          customer: {
            userId: booking.userId,
            name: 'Customer Name', // You might want to fetch this from the User model
            email: booking.email,
          },
          serviceItems: booking.serviceItems.map(item => ({ name: item.name, price: item.price })),
          totalAmount: booking.balanceAmount,
          status: 'SENT',
        }),
      });

      if (!invoiceResponse.ok) {
        throw new Error('Failed to create invoice for balance payment');
      }

      const invoice = await invoiceResponse.json();

      // 2. Generate a payment link for the new invoice
      const paymentLinkResponse = await fetch(`http://localhost:${process.env.PORT || 4000}/api/invoices/${invoice._id}/generate-payment-link`, {
        method: 'POST',
      });

      if (!paymentLinkResponse.ok) {
        throw new Error('Failed to generate payment link');
      }

      const paymentLinkData = await paymentLinkResponse.json();

      // Update booking status to COMPLETED
      booking.status = 'COMPLETED';
      await booking.save();

      res.json({
        msg: 'Service marked as complete. Please provide the payment link to the customer.',
        paymentLink: paymentLinkData.paymentLink,
        booking,
      });
    } else {
      // No balance due, just complete the service
      booking.status = 'COMPLETED';
      await booking.save();
      res.json({ msg: 'Service marked as complete', booking });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});