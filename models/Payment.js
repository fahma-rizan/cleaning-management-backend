const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    method: {
      type: String,
      enum: ['cod', 'online', 'advance', 'pay-after-completion'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'partial', 'refunded'],
      default: 'pending',
    },
    gatewayId: {
      type: String,
      description: 'Payment gateway transaction ID (e.g., PayHere transaction ID)',
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
      description: 'Full response from payment gateway',
    },
    paidAt: {
      type: Date,
      description: 'When payment was completed',
    },
    failureReason: {
      type: String,
      description: 'Reason if payment failed',
    },
    ipnVerified: {
      type: Boolean,
      default: false,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      description: 'Additional data (e.g., reference numbers, notes)',
    },
    audit: {
      createdBy: mongoose.Schema.Types.ObjectId,
      updatedBy: mongoose.Schema.Types.ObjectId,
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    },
  },
  {
    timestamps: true,
    collection: 'payments',
  }
);

// Indexes
paymentSchema.index({ bookingId: 1, status: 1 });
paymentSchema.index({ invoiceId: 1 });
paymentSchema.index({ customerId: 1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ method: 1, status: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
