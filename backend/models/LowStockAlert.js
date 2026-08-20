const mongoose = require('mongoose');
const INVENTORY = require('../constants/inventory');

const lowStockAlertSchema = new mongoose.Schema(
  {
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryItem',
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: Object.values(INVENTORY.ALERT_STATUSES),
      default: INVENTORY.ALERT_STATUSES.ACTIVE,
      index: true,
    },

    // triggerQuantity is the stock level at the moment the alert fired,
    // so the admin can see how bad the shortage was even after restocking.
    triggerQuantity:  Number,
    triggerThreshold: Number, // threshold value at time of trigger

    resolvedAt:       Date,
    resolvedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedQuantity: Number, // stock level after the restock that resolved it
  },
  { timestamps: true }
);

module.exports = mongoose.model('LowStockAlert', lowStockAlertSchema);
