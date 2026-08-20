const INVENTORY = {
  DEFAULT_LOW_STOCK_THRESHOLD: 10,

  // Consumable category — replaces the old generic consumable/equipment split.
  // `type` on InventoryItem now holds one of these category values.
  CONSUMABLE_TYPES: {
    CLEANING_CHEMICALS:       'Cleaning Chemicals',
    CLEANING_SUPPLIES:        'Cleaning Supplies',
    WASTE_MANAGEMENT:         'Waste Management',
    PPE_SAFETY:               'PPE & Safety',
    FLOOR_SURFACE_TREATMENT:  'Floor & Surface Treatment',
    WINDOW_CLEANING:          'Window Cleaning',
    SOFA_UPHOLSTERY_CLEANING: 'Sofa & Upholstery Cleaning',
    DEODORIZING_SANITIZING:   'Deodorizing & Sanitizing',
  },

  // Visual fill estimate used in completion reports (no measuring needed)
  BOTTLE_FILL_LEVELS: {
    FULL:          'full',
    THREE_QUARTER: 'three_quarter',
    HALF:          'half',
    QUARTER:       'quarter',
    EMPTY:         'empty',
  },

  // Volume fraction for each fill level (used to calc return qty)
  FILL_LEVEL_FRACTION: {
    full: 1.0, three_quarter: 0.75, half: 0.5, quarter: 0.25, empty: 0.0,
  },

  TRANSACTION_TYPES: {
    RESTOCK:            'restock',
    DEDUCT:             'deduct',
    RETURN:             'return',
    ADJUSTMENT:         'adjustment',
    MATERIAL_DEDUCTION: 'material_deduction', // approved material request
    COMPLETION_RETURN:  'completion_return',   // returned after job
  },

  MATERIAL_REQUEST_STATUSES: {
    PENDING_REVIEW: 'pending',
    APPROVED:       'approved',
    REJECTED:       'rejected',
  },

  BOOKING_MATERIAL_STATUSES: [
    'pending_materials',
    'materials_rejected',
  ],

  COMPLETION_REPORT_STATUSES: {
    PENDING_VERIFICATION: 'pending_verification',
    APPROVED:             'approved',
    REJECTED:             'rejected',
  },

  BOTTLE_STATUSES: {
    SEALED:   'sealed',
    OPEN:     'open',
    RETURNED: 'returned',
    DISPOSED: 'disposed',
  },

  ALERT_STATUSES: {
    ACTIVE:   'active',
    RESOLVED: 'resolved',
  },

  // Auto-flag thresholds
  FLAG_LOW_RATIO:  0.5,  // usage < 50% of expected → suspiciously low
  FLAG_HIGH_RATIO: 1.0,  // usage > 100% of allocated → exceeds allocation
};

module.exports = INVENTORY;
