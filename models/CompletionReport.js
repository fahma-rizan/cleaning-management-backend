const mongoose = require('mongoose');

const usageItemSchema = new mongoose.Schema(
  {
    itemId:       { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem' },
    allocatedQty: Number,
    reportedUsed: Number,
    expectedQty:  Number,
    ratio:        Number,
    flagged:      { type: Boolean, default: false },
    flagReason:   String,
  },
  { _id: false }
);

const equipmentConditionSchema = new mongoose.Schema(
  {
    equipmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipment' },
    condition:   { type: String, enum: ['good', 'damaged', 'lost'] },
  },
  { _id: false }
);

const bottleReturnSchema = new mongoose.Schema(
  {
    bottleId:           { type: mongoose.Schema.Types.ObjectId, ref: 'BottleInstance' },
    estimatedRemaining: { type: Number, min: 0, max: 1 },
    condition:          { type: String, enum: ['good', 'damaged', 'lost'] },
  },
  { _id: false }
);

const completionReportSchema = new mongoose.Schema(
  {
    bookingId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    submittedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['pending_verification', 'approved', 'rejected'],
      default: 'pending_verification',
    },
    isLocked:             { type: Boolean, default: false },
    usageItems:           [usageItemSchema],
    equipmentConditions:  [equipmentConditionSchema],
    bottleReturns:        [bottleReturnSchema],
    adminNote:            String,
    verifiedBy:           { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verifiedAt:           Date,
    submittedAt:          { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CompletionReport', completionReportSchema);
