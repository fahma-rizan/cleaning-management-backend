const mongoose = require('mongoose');
const express = require('express');
const router = express.Router();

const Booking = require('../models/Booking');

/**
 * @route   POST /api/bookings
 * @desc    Create a new booking
 * @access  Public
 */
router.post('/', async (req, res) => {
  try {
    const { bookingId, userId, email, serviceType, price, date, time, address, status } = req.body;

    // Validate required fields
    if (!bookingId || !userId || !email || !serviceType || !price || !date || !time || !address) {
      return res.status(400).json({ msg: 'Missing required fields' });
    }

    // Check if booking already exists
    const existingBooking = await Booking.findOne({ bookingId });
    if (existingBooking) {
      return res.status(400).json({ msg: 'Booking with this ID already exists' });
    }

    // Create new booking
    const newBooking = new Booking({
      bookingId,
      userId,
      email,
      serviceType,
      price,
      date,
      time,
      address,
      status: status || 'PENDING',
    });

    await newBooking.save();
    res.status(201).json(newBooking);
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
        userId: new mongoose.Types.ObjectId(), // Generate a valid ObjectId for the test user
        email: 'farhathays.123@gmail.com', // <-- CHANGE THIS to your real email to receive test notifications
        serviceType: 'Apartment Deep Cleaning',
        price: 7500,
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