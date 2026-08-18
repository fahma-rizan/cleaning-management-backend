const mongoose = require('mongoose');

const stockLogSchema = new mongoose.Schema({
  itemId:       { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
  itemName:     { type: String, required: true },
  movementType: { type: String, required: true, enum: ['deduction', 'return', 'restock'] },
  quantity:     { type: Number, required: true, min: 0 },
  bookingId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  performedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  unitCost:     { type: Number, default: 0 },
  timestamp:    { type: Date, default: Date.now },
});

module.exports = mongoose.model('StockLog', stockLogSchema);
