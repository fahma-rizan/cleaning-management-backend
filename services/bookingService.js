const Booking        = require('../models/Booking');
const User           = require('../models/User');

// Lazy require to avoid circular deps
const getLoyaltyService         = () => require('./loyaltyService');
const getMaterialRequestService = () => require('./materialRequestService');

/* ── Create booking ───────────────────────────────────────── */
const createBooking = async (customerId, data) => {
  const {
    serviceType,
    subType,
    usageFactor,
    usageFactorValue,
    items = [],
    scheduledDate,
    address,
    notes,
    pointsToRedeem = 0,
  } = data;

  const totalAmount = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  if (totalAmount <= 0) throw new Error('Booking total must be greater than 0');

  const customer = await User.findById(customerId);
  if (!customer) throw new Error('Customer not found');

  let discountAmount = 0;
  let pointsRedeemed = 0;

  // Redeem points against the LoyaltyAccount (min 100 pts, validated inside service)
  if (pointsToRedeem > 0) {
    const redemption  = await getLoyaltyService().redeemPoints(customerId, pointsToRedeem);
    discountAmount    = redemption.rupeeValue; // 1 pt = Rs. 1
    pointsRedeemed    = pointsToRedeem;
  }

  const finalAmount = Math.max(0, totalAmount - discountAmount);

  const booking = await Booking.create({
    customerId,
    serviceType,
    subType,
    usageFactor,
    usageFactorValue,
    items,
    scheduledDate,
    address,
    notes,
    totalAmount,
    discountAmount,
    finalAmount,
    pointsRedeemed,
  });

  try {
    await getMaterialRequestService().calculateMaterialNeeds(booking._id);
  } catch (materialErr) {
    console.error('[BookingService] calculateMaterialNeeds failed:', materialErr.message);
    console.error('[BookingService] Booking ID:', booking._id);
    console.error('[BookingService] Stack:', materialErr.stack);
  }

  const updatedBooking = await Booking.findById(booking._id);
  return updatedBooking;
};

/* ── Get bookings ─────────────────────────────────────────── */
const getBookings = async (requestingUser, { page = 1, limit = 10, status, customerId } = {}) => {
  const isCustomer = requestingUser.role === 'customer';
  const filter     = {};

  if (isCustomer) {
    filter.customerId = requestingUser._id;
  } else if (customerId) {
    filter.customerId = customerId;
  }
  if (status) filter.status = status;

  const skip = (page - 1) * limit;
  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate('customerId',    'name email phone')
      .populate('assignedStaff', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Booking.countDocuments(filter),
  ]);

  return { bookings, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

/* ── Get single booking ───────────────────────────────────── */
const getBookingById = async (bookingId, requestingUser) => {
  const booking = await Booking.findById(bookingId)
    .populate('customerId',    'name email phone')
    .populate('assignedStaff', 'name email');

  if (!booking) throw new Error('Booking not found');

  const isCustomer = requestingUser.role === 'customer';
  if (isCustomer && booking.customerId._id.toString() !== requestingUser._id.toString()) {
    throw new Error('Access denied');
  }

  return booking;
};

/* ── Update booking status ────────────────────────────────── */
const updateBookingStatus = async (bookingId, { status, assignedStaff, notes, cancelReason }, requestingUser) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new Error('Booking not found');

  const isCustomer = requestingUser.role === 'customer';

  if (isCustomer) {
    if (status !== 'cancelled') throw new Error('Customers can only cancel bookings');
    if (!['pending', 'confirmed'].includes(booking.status)) {
      throw new Error('Cannot cancel a booking that is in progress or completed');
    }
  }

  const prevStatus = booking.status;
  booking.status = status;

  if (status === 'cancelled') {
    booking.cancelledAt  = new Date();
    booking.cancelReason = cancelReason || '';

    // Reverse points earned on this booking
    const cancelledBy = isCustomer ? 'customer' : 'company';
    await getLoyaltyService().reversePoints(
      booking.customerId, booking._id, cancelledBy
    ).catch(() => {});
  }

  if (status === 'completed' && prevStatus !== 'completed') {
    booking.completedAt = new Date();
    // Points are awarded via the completion report approval workflow.
    // Do NOT award here to avoid double-crediting when a report is also approved.
  }

  if (assignedStaff) booking.assignedStaff = assignedStaff;
  if (notes)         booking.notes = notes;

  await booking.save();
  return booking;
};

/* ── Customer stats (for dashboard) ──────────────────────── */
const getCustomerStats = async (customerId) => {
  const [total, active, completed, recent] = await Promise.all([
    Booking.countDocuments({ customerId }),
    Booking.countDocuments({ customerId, status: { $in: ['pending', 'confirmed', 'in_progress'] } }),
    Booking.countDocuments({ customerId, status: 'completed' }),
    Booking.find({ customerId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('bookingRef serviceType status scheduledDate finalAmount pointsEarned'),
  ]);

  return {
    totalBookings:     total,
    activeServices:    active,
    completedBookings: completed,
    recentBookings:    recent,
  };
};

module.exports = {
  createBooking,
  getBookings,
  getBookingById,
  updateBookingStatus,
  getCustomerStats,
};