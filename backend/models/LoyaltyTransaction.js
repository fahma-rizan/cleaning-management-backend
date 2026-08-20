const mongoose = require('mongoose');

const loyaltyTransactionSchema = new mongoose.Schema(
  {
    // Named userId (not customerId) to match the shared loyaltytransactions collection.
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'Booking',
    },
    type: {
      type:     String,
      enum:     ['earned', 'redeemed', 'reversed', 'expired', 'bonus'],
      required: true,
    },
    points: { type: Number, required: true },
    // Not required: existing shared documents have neither field set.
    balanceAfter:        { type: Number },
    lifetimePointsAfter: { type: Number },
    reason:              { type: String },
    cancelledBy:         { type: String, enum: ['customer', 'company'] },
    paymentStage:        { type: String, enum: ['partial', 'full'] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LoyaltyTransaction', loyaltyTransactionSchema);
