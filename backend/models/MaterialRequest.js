const mongoose = require('mongoose');

const requestItemSchema = new mongoose.Schema(
  {
    itemId:       { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
    itemType:     { type: String, enum: ['consumable'] },
    requestedQty: { type: Number, default: 0 },
    allocatedQty: { type: Number, default: 0 },
    bottleIds:    [{ type: mongoose.Schema.Types.ObjectId }],
  },
  { _id: false }
);

const materialRequestSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    items:           [requestItemSchema],
    rejectionReason: String,
    reviewedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt:      Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('MaterialRequest', materialRequestSchema);
