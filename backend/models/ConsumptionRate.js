const mongoose = require('mongoose');

const itemRateSchema = new mongoose.Schema(
  {
    itemId:      { type: mongoose.Schema.Types.ObjectId, required: true },
    itemType:    { type: String, required: true, enum: ['consumable'] },
    ratePerUnit: { type: Number, required: true, min: 0 },
    flatPerJob:  { type: Boolean, default: false },
  },
  { _id: false }
);

const consumptionRateSchema = new mongoose.Schema(
  {
    serviceType: { type: String, required: true, trim: true },
    subType:     { type: String, required: true, trim: true },
    usageFactor: { type: String, required: true, trim: true },
    items:       [itemRateSchema],
  },
  { timestamps: true }
);

consumptionRateSchema.index({ serviceType: 1, subType: 1 }, { unique: true });

module.exports = mongoose.model('ConsumptionRate', consumptionRateSchema);
