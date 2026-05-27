const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  bookingId: {
    type: String,
    required: true,
    unique: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Assuming you have a User model
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  serviceItems: [
    {
      name: { type: String, required: true },
      price: { type: Number, required: true },
      // Add other service-specific fields here if needed in the future
    },
  ],
  price: {
    type: Number,
    required: true,
  },
  date: {
    type: String, // Storing as string for simplicity, but Date type is also an option
    required: true,
  },
  time: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'ADVANCE_PAID'],
    default: 'PENDING',
  },
  advanceAmount: {
    type: Number,
    default: 0,
  },
  balanceAmount: {
    type: Number,
    default: 0,
  },
  paymentMethod: {
    type: String,
    enum: ['ONLINE', 'CASH', 'NOT_PAID'],
    default: 'NOT_PAID',
  },
  balancePaid: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Booking', bookingSchema);