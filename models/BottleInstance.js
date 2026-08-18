const mongoose = require('mongoose');

const bottleInstanceSchema = new mongoose.Schema(
  {
    itemId:     { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
    bottleCode: { type: String, required: true, unique: true, trim: true },
    status: {
      type: String,
      enum: ['sealed', 'in_use', 'partially_used', 'empty', 'returned'],
      default: 'sealed',
    },
    estimatedRemaining: { type: Number, min: 0, max: 1, default: 1 },
    assignedTo:         { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    lastUpdatedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BottleInstance', bottleInstanceSchema);
