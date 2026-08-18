const mongoose = require('mongoose');
const INVENTORY = require('../constants/inventory');

const bottleSchema = new mongoose.Schema(
  {
    // itemId lets us quickly find all bottles of a given consumable without
    // denormalising the entire InventoryItem into every bottle document.
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryItem',
      required: true,
      index: true,
    },

    // sku is copied from InventoryItem at creation so lookups never need a join
    sku: String,

    status: {
      type: String,
      enum: Object.values(INVENTORY.BOTTLE_STATUSES),
      default: INVENTORY.BOTTLE_STATUSES.SEALED,
    },

    // fillLevel is a visual estimate — staff mark it on the completion report
    // rather than measuring, keeping the process practical.
    fillLevel: {
      type: String,
      enum: Object.values(INVENTORY.BOTTLE_FILL_LEVELS),
      default: INVENTORY.BOTTLE_FILL_LEVELS.FULL,
    },

    // nominalCapacity is the full volume of this bottle in item.unit.
    // Stored here because bottle sizes can differ within the same SKU.
    nominalCapacity: {
      type: Number,
      required: true,
    },

    // currentBookingId is set on assignment so we can quickly answer
    // "which bottles are currently out on a job?"
    currentBookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
    },

    openedAt:   Date,
    returnedAt: Date,

    // Reference back to the restock transaction that created this bottle,
    // enabling full traceability from restock to consumption.
    createdByRestock: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Bottle', bottleSchema);
