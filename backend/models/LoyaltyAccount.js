const mongoose = require('mongoose');

const loyaltyAccountSchema = new mongoose.Schema(
  {
    customerId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      unique:   true,
      index:    true,
    },
    currentBalance: { type: Number, default: 0, min: 0 },
    lifetimePoints: { type: Number, default: 0, min: 0 },
    currentTier: {
      type:    String,
      enum:    ['bronze', 'silver', 'gold', 'platinum'],
      default: 'bronze',
    },
    tierDiscountsUsed: {
      silver:   { type: Boolean, default: false },
      gold:     { type: Boolean, default: false },
      platinum: { type: Boolean, default: false },
    },
    balanceLastResetAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LoyaltyAccount', loyaltyAccountSchema);
