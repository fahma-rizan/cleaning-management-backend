const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, default: 1 },
});

const discountSchema = new mongoose.Schema({
  description: { type: String, required: true },
  amount: { type: Number, required: true },
});

// FIX (Bug 9): Added history array to schema so payment events are actually saved
const historySchema = new mongoose.Schema({
  event: { type: String },
  timestamp: { type: Date, default: Date.now },
  details: { type: String },
});

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  invoiceType: {
    type: String,
    required: true,
    enum: ['ADVANCE', 'FINAL', 'FULL', 'COD', 'REFUND', 'CANCELLATION'],
  },
  status: {
    type: String,
    enum: ['DRAFT', 'SENT', 'PAID', 'PARTIAL', 'CANCELLED', 'REFUNDED', 'REFUND_PENDING'],
    default: 'DRAFT',
  },
  customer: {
    userId: { type: String, ref: 'User' },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    address: { type: String },
  },
  bookingId: {
    type: String,
    required: true,
  },
  serviceItems: [invoiceItemSchema],
  customizationItems: [invoiceItemSchema],
  discounts: [discountSchema],
  taxAmount: {
    type: Number,
    default: 0,
  },
  subTotal: {
    type: Number,
    required: true,
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  paidAmount: {
    type: Number,
    default: 0,
  },
  balanceAmount: {
    type: Number,
    required: true,
  },
  qrCodeUrl: {
    type: String,
  },
  notes: {
    type: String,
  },
  // FIX (Bug 9): history array is now part of the schema so events persist to MongoDB
  history: [historySchema],
}, { timestamps: true });

const Invoice = mongoose.model('Invoice', invoiceSchema);

module.exports = Invoice;