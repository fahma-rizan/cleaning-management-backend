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
      enum: Object.values(INVENTORY.ITEM_TYPES),
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
    costPerUnit: {
      type: Number,
      required: true,
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

    // reservedCount tracks equipment units currently assigned to active jobs.
    // Keeping it on the item avoids a separate query when checking availability.
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

// For equipment: how many units are free to be assigned to a new job
inventoryItemSchema.virtual('availableCount').get(function () {
  return Math.max(0, this.quantity - this.reservedCount);
});

// Equipment status derived from reservation state and active flag.
// Under_maintenance is inferred from isActive=false so we don't need an extra field.
inventoryItemSchema.virtual('equipmentStatus').get(function () {
  if (this.type !== INVENTORY.ITEM_TYPES.EQUIPMENT) return null;
  if (!this.isActive) return INVENTORY.EQUIPMENT_STATUSES.UNDER_MAINTENANCE;
  if (this.reservedCount >= this.quantity) return INVENTORY.EQUIPMENT_STATUSES.IN_USE;
  return INVENTORY.EQUIPMENT_STATUSES.AVAILABLE;
});

module.exports = mongoose.model('InventoryItem', inventoryItemSchema);
