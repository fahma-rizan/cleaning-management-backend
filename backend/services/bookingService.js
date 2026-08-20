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

  // Use materialStatus since Booking model has no status field
  if (status) filter.materialStatus = status;

  const skip = (page - 1) * limit;
  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate('customerId',      'name email phone')
      .populate('assignedMembers', 'name email')
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
    .populate('customerId',      'name email phone')
    .populate('assignedMembers', 'name email');

  if (!booking) throw new Error('Booking not found');

  const isCustomer = requestingUser.role === 'customer';
  if (isCustomer && booking.customerId._id.toString() !== requestingUser._id.toString()) {
    throw new Error('Access denied');
  }

  return booking;
};

/* ── Update booking status ────────────────────────────────── */
const updateBookingStatus = async (bookingId, { status, assignedStaff, notes, cancelReason, amountPaid }, requestingUser) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new Error('Booking not found');

  const isCustomer = requestingUser.role === 'customer';

  if (isCustomer) {
    if (status !== 'cancelled') throw new Error('Customers can only cancel bookings');
    if (!['pending_materials', 'materials_approved'].includes(booking.materialStatus)) {
      throw new Error('Cannot cancel a booking that is in progress or completed');
    }
  }

  const prevStatus       = booking.materialStatus;
  booking.materialStatus = status;

  if (status === 'cancelled') {
    booking.cancelReason = cancelReason || '';

    // Reverse points earned on this booking.
    // cancelledBy determines whether points are kept (company) or reversed (customer).
    const cancelledBy = isCustomer ? 'customer' : 'company';
    await getLoyaltyService().reversePoints(
      booking.customerId, booking._id, cancelledBy
    ).catch(() => {});
  }

  if (status === 'completed' && prevStatus !== 'completed') {
    // Points awarded after payment confirmation by payment service.
    // Do NOT award here — payment method determines eligibility.
  }

  // Use assignedMembers — Booking model has no assignedStaff field
  if (assignedStaff) booking.assignedMembers = assignedStaff;
  if (notes)         booking.notes           = notes;

  await booking.save();
  return booking;
};

/* ── Customer stats (for dashboard) ──────────────────────── */
const getCustomerStats = async (customerId) => {
  const [total, active, completed, recent] = await Promise.all([
    Booking.countDocuments({ customerId }),
    Booking.countDocuments({ customerId, materialStatus: { $in: ['pending_materials', 'materials_approved', 'in_progress'] } }),
    Booking.countDocuments({ customerId, materialStatus: 'completed' }),
    Booking.find({ customerId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('serviceType materialStatus scheduledDate'),
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