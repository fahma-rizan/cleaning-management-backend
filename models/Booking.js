const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    customerId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    serviceType:       { type: String, required: true, trim: true },
    subType:           { type: String, required: true, trim: true },
    usageFactor:       { type: String, required: true, trim: true },
    usageFactorValue:  { type: Number, required: true, min: 0 },
    scheduledDate:     { type: Date, required: true },
    assignedMembers:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    jobLead:           { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    materialStatus: {
      type: String,
      enum: [
        'pending_materials',
        'materials_approved',
        'materials_rejected',
        'in_progress',
        'pending_verification',
        'completed',
        'cancelled',
      ],
      default: 'pending_materials',
    },
    materialRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'MaterialRequest' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Booking', bookingSchema);
