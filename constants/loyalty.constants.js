const TIER_THRESHOLDS = {
  BRONZE:   { min: 0,   max: 99  },
  SILVER:   { min: 100, max: 299 },
  GOLD:     { min: 300, max: 699 },
  PLATINUM: { min: 700, max: Infinity },
};

// Points earned per 100 Rs spent, by tier
const TIER_EARNING_RATES = {
  BRONZE:   1.0,
  SILVER:   1.5,
  GOLD:     2.0,
  PLATINUM: 3.0,
};

// One-time discount % awarded when a customer first reaches each tier
const TIER_ONE_TIME_DISCOUNTS = {
  BRONZE:   0,
  SILVER:   5,
  GOLD:     10,
  PLATINUM: 15,
};

const REDEMPTION = {
  POINTS_TO_RUPEES: 1,   // 1 pt = Rs. 1
  MIN_REDEEM:       100, // minimum currentBalance required to redeem
};

const TRANSACTION_TYPES = {
  EARNED:   'earned',
  REDEEMED: 'redeemed',
  REVERSED: 'reversed',
  EXPIRED:  'expired',
  BONUS:    'bonus',
};

module.exports = {
  TIER_THRESHOLDS,
  TIER_EARNING_RATES,
  TIER_ONE_TIME_DISCOUNTS,
  REDEMPTION,
  TRANSACTION_TYPES,
};
