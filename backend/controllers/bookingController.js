const bookingService = require('../services/bookingService');

const create = async (req, res) => {
  try {
    const booking = await bookingService.createBooking(req.user._id, req.body);
    res.status(201).json({ success: true, data: booking });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const list = async (req, res) => {
  try {
    const { page, limit, status, customerId } = req.query;
    const data = await bookingService.getBookings(req.user, {
      page:       parseInt(page)  || 1,
      limit:      parseInt(limit) || 10,
      status,
      customerId,
    });
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getOne = async (req, res) => {
  try {
    const booking = await bookingService.getBookingById(req.params.id, req.user);
    res.status(200).json({ success: true, data: booking });
  } catch (err) {
    const code = err.message === 'Access denied' ? 403 : err.message === 'Booking not found' ? 404 : 400;
    res.status(code).json({ success: false, message: err.message });
  }
};

const updateStatus = async (req, res) => {
  try {
    const booking = await bookingService.updateBookingStatus(req.params.id, req.body, req.user);
    res.status(200).json({ success: true, data: booking });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getMyStats = async (req, res) => {
  try {
    const stats = await bookingService.getCustomerStats(req.user._id);
    res.status(200).json({ success: true, data: stats });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = { create, list, getOne, updateStatus, getMyStats };
