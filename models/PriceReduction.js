const mongoose = require('mongoose');

const priceReductionSchema = new mongoose.Schema({
  invoice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    required: true,
    index: true,
  },
  requestedAmount: {
    type: Number,
    required: [true, 'Requested reduction amount is required.'],
    min: [1, 'Reduction amount must be at least Rs. 1.'],
  },
  approvedAmount: {
    type: Number,
    default: null,
  },
  reason: {
    type: String,
    required: [true, 'A reason for the price reduction is required.'],
    trim: true,
  },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING',
  },
  rejectionReason: {
    type: String,
    trim: true,
  },
  // Tracks whether the reduction was a refund (already paid) or an invoice adjustment (not yet paid)
  reductionType: {
    type: String,
    enum: ['REFUND', 'ADJUSTMENT'],
    default: null,
  },
}, { timestamps: true });

module.exports = mongoose.model('PriceReduction', priceReductionSchema);