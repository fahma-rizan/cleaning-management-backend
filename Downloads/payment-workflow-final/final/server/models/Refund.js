const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Represents a refund request in the system.
 *
 * This model is separate from the Invoice model to clearly distinguish
 * payment lifecycle from the refund lifecycle. It holds all details
 * related to a single refund request.
 */
const refundSchema = new Schema({
  // A direct link to the Invoice this refund is for. This is a critical relationship.
  invoice: {
    type: Schema.Types.ObjectId,
    ref: 'Invoice',
    required: true,
    index: true, // Index for faster lookups by invoice
  },
  // The reason provided by the customer for the refund request.
  reason: {
    type: String,
    required: [true, 'A reason for the refund is required.'],
    trim: true,
  },
  // The current status of the refund process.
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING',
  },
  // If the refund is rejected, the administrator must provide a reason.
  rejectionReason: {
    type: String,
    trim: true,
  },
  // The amount that was refunded. This is stored here for historical accuracy.
  refundedAmount: {
    type: Number,
    required: [true, 'Refunded amount must be specified.'],
  },
}, {
  // Automatically add `createdAt` and `updatedAt` timestamps.
  timestamps: true,
});

const Refund = mongoose.model('Refund', refundSchema);

module.exports = Refund;