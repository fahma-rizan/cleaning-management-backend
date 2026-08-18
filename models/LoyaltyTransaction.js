const mongoose = require('mongoose');

const loyaltyTransactionSchema = new mongoose.Schema(
  {
    customerId: {
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
    points:              { type: Number, required: true },
    balanceAfter:        { type: Number, required: true },
    lifetimePointsAfter: { type: Number, required: true },
    reason:              { type: String },
    cancelledBy:         { type: String, enum: ['customer', 'company'] },
    paymentStage:        { type: String, enum: ['partial', 'full'] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LoyaltyTransaction', loyaltyTransactionSchema);
