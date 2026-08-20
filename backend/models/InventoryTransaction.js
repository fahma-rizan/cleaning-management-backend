const mongoose = require('mongoose');
const INVENTORY = require('../constants/inventory');

const inventoryTransactionSchema = new mongoose.Schema(
  {
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryItem',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(INVENTORY.TRANSACTION_TYPES),
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    // previousQty/newQty match the shared inventorytransactions collection's
    // field names (was quantityBefore/quantityAfter locally).
    previousQty: {
      type: Number,
      required: true,
    },
    newQty: {
      type: Number,
      required: true,
    },

    // costPerUnit is snapshotted at transaction time so historical cost reports
    // remain accurate even if the item's current price changes later.
    costPerUnit: {
      type: Number,
      default: 0,
    },

    reference: String,
    notes: String,
    // Not required: existing shared documents have no performedBy at all.
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('InventoryTransaction', inventoryTransactionSchema);
