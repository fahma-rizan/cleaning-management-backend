const mongoose = require('mongoose');

const equipmentSchema = new mongoose.Schema(
  {
    name:       { type: String, required: true, trim: true },
    assetTag:   { type: String, required: true, unique: true, trim: true },
    status: {
      type: String,
      enum: ['available', 'in_use', 'under_maintenance', 'retired'],
      default: 'available',
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    notes:      { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Equipment', equipmentSchema);
