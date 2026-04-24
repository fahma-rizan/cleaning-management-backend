const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    bookingRef: {
      type: String,
      unique: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    serviceId: {
      type: Number,
      required: true,
    },
    serviceName: {
      type: String,
      required: true,
    },
    mainServiceType: {
      type: String,
    },
    serviceCategory: {
      type: String,
    },

    // ─── Schedule ─────────────────────────────────────────────────────────────
    date: {
      type: String,
      required: [true, 'Booking date is required'],
    },
    time: {
      type: String,
      required: [true, 'Booking time is required'],
    },

    // ─── Location ─────────────────────────────────────────────────────────────
    address: {
      type: String,
      required: [true, 'Address is required'],
    },

    // ─── Status ───────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'completed', 'cancelled'],
      default: 'pending',
    },

    // ─── Pricing ──────────────────────────────────────────────────────────────
    totalAmount: {
      type: Number,
      required: true,
    },
    packageType: {
      type: String,
      enum: ['standard', 'premium'],
      default: 'standard',
    },

    // ─── Home / Office Cleaning Fields ────────────────────────────────────────
    houseSize: {
      type: String,
      enum: ['small', 'medium', 'large', 'xl'],
    },
    rooms: {
      type: Number,
    },
    bathrooms: {
      type: Number,
    },
    frequency: {
      type: String,
      enum: ['once', 'weekly', 'biweekly', 'monthly'],
    },

    // ─── Laundry Fields ───────────────────────────────────────────────────────
    laundryWeight: {
      type: Number,
    },
    laundryServices: {
      type: [String], // e.g. ['wash', 'dry', 'fold']
    },
    laundryItemType: {
      type: String,
    },
    laundrySelectedItems: {
      type: mongoose.Schema.Types.Mixed, // Flexible structure for garment lists
    },
    laundryPickupDelivery: {
      type: Boolean,
      default: false,
    },

    // ─── Curtain Cleaning Fields ──────────────────────────────────────────────
    curtainServiceType: {
      type: String,
      enum: ['dry-clean-press', 'laundry-press', 'premium'],
    },
    curtainOptions: {
      type: [String], // e.g. ['removal', 'installation', 'pickup-delivery']
    },
    curtainQuantity: {
      type: Number,
    },

    // ─── Sofa / Mattress / Carpet Fields ──────────────────────────────────────
    sofaUnits: {
      type: Number,
    },
    sofaSeatingCapacity: {
      type: Number,
    },
    mattressCount: {
      type: Number,
    },
    mattressSquareFeet: {
      type: Number,
    },
    carpetCount: {
      type: Number,
    },
    carpetSquareFeet: {
      type: Number,
    },

    // ─── Miscellaneous ────────────────────────────────────────────────────────
    specialInstructions: {
      type: String,
    },
    loyaltyPointsEarned: {
      type: Number,
      default: 0,
    },
    assignedCleaner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid', 'refunded'],
      default: 'unpaid',
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'online'],
    },
    cancelledAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// ─── Auto-generate booking reference ──────────────────────────────────────────
bookingSchema.pre('save', async function (next) {
  if (!this.bookingRef) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    this.bookingRef = `CL-${timestamp}-${random}`;
  }
  next();
});

module.exports = mongoose.model('Booking', bookingSchema);
