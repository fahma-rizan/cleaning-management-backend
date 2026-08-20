const mongoose = require('mongoose');

/**
 * MASTER INVOICE MODEL
 * Based on Invoice.js — two fixes applied:
 * - customer.userId changed from String to ObjectId ref:'User'
 * - bookingId changed from String to ObjectId ref:'Booking'
 */

const invoiceItemSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  price:    { type: Number, required: true },
  quantity: { type: Number, default: 1 },
});

const discountSchema = new mongoose.Schema({
  description: { type: String, required: true },
  amount:      { type: Number, required: true },
});

const historySchema = new mongoose.Schema({
  event:     { type: String },
  timestamp: { type: Date, default: Date.now },
  details:   { type: String },
});

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type:     String,
    required: true,
    unique:   true,
    index:    true,
  },
  invoiceType: {
    type:     String,
    required: true,
    enum:     ['ADVANCE', 'FINAL', 'FULL', 'COD', 'REFUND', 'CANCELLATION'],
  },
  status: {
    type:    String,
    enum:    ['DRAFT', 'SENT', 'PAID', 'PARTIAL', 'CANCELLED', 'REFUNDED', 'REFUND_PENDING'],
    default: 'DRAFT',
  },

  // FIX: userId is now ObjectId (was String)
  customer: {
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name:    { type: String, required: true },
    email:   { type: String, required: true },
    phone:   { type: String },
    address: { type: String },
  },

  // FIX: bookingId is now ObjectId (was String)
  bookingId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Booking',
    required: true,
  },

  serviceItems:       [invoiceItemSchema],
  customizationItems: [invoiceItemSchema],
  discounts:          [discountSchema],

  taxAmount:     { type: Number, default: 0 },
  subTotal:      { type: Number, required: true },
  totalAmount:   { type: Number, required: true },
  paidAmount:    { type: Number, default: 0 },
  balanceAmount: { type: Number, required: true },

  qrCodeUrl:        { type: String },
  payherePaymentId: { type: String },
  notes:            { type: String },

  mainCategories: [{
    type: String,
    enum: ['LND', 'CUR', 'SVC', 'HOC'],
  }],

  history: [historySchema],

}, { timestamps: true });

module.exports = mongoose.model('Invoice', invoiceSchema);