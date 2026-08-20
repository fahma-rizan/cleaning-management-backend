const LOYALTY = {
  // 1 point per Rs. 10 spent
  POINTS_PER_RUPEE: 0.1,
  MIN_REDEEM_POINTS: 50,
  // 1 point = Rs. 1 discount
  POINTS_RUPEE_VALUE: 1,
  // Max 50% of booking value can be covered by points
  MAX_REDEEM_PERCENT: 0.5,
  BADGE_EXPIRY_DAYS: 90,

  TIERS: {
    BRONZE:   { name: 'Bronze',   min: 0,    max: 999,      discount: 0,    badge: null      },
    SILVER:   { name: 'Silver',   min: 1000, max: 2499,     discount: 0.03, badge: '3% OFF'  },
    GOLD:     { name: 'Gold',     min: 2500, max: 4999,     discount: 0.05, badge: '5% OFF'  },
    PLATINUM: { name: 'Platinum', min: 5000, max: Infinity, discount: 0.07, badge: '7% OFF'  },
  },

  TRANSACTION_TYPES: {
    EARN:       'earn',
    REDEEM:     'redeem',
    EXPIRE:     'expire',
    ADJUSTMENT: 'adjustment',
    BADGE_EARN: 'badge_earn',
    BADGE_USED: 'badge_used',
    REFUND:     'refund',
    PENDING:    'pending',
  },
};

module.exports = LOYALTY;
