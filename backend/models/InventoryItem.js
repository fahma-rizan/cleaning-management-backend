const mongoose = require('mongoose');
const INVENTORY = require('../constants/inventory');

const inventoryItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    type: {
      type: String,
      enum: Object.values(INVENTORY.CONSUMABLE_TYPES),
      required: true,
    },
    unit: {
      type: String,
      required: [true, 'Unit is required'],
    },
    quantity: {
      type: Number,
      required: true,
      min: [0, 'Quantity cannot be negative'],
      default: 0,
    },
    lowStockThreshold: {
      type: Number,
      default: INVENTORY.DEFAULT_LOW_STOCK_THRESHOLD,
    },
    // Not required: the shared Atlas inventoryitems collection has existing
    // documents with no costPerUnit at all.
    costPerUnit: {
      type: Number,
      default: 0,
      min: 0,
    },
    supplier: {
      name: String,
      contact: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // reservedCount tracks units currently allocated to active bookings/service
    // requests. Keeping it on the item avoids a separate query when checking
    // how much stock is actually free.
    reservedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// True when physical stock is at or below the configured threshold
inventoryItemSchema.virtual('isLowStock').get(function () {
  return this.quantity <= this.lowStockThreshold;
});

module.exports = mongoose.model('InventoryItem', inventoryItemSchema);
