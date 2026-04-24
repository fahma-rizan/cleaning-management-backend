const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Never return password in queries by default
    },
    role: {
      type: String,
      enum: ['customer', 'admin', 'cleaner', 'staff'],
      default: 'customer',
    },
    adminRole: {
      type: String,
      enum: ['Admin', 'Operations Manager', 'Customer Support'],
    },
    verified: {
      type: Boolean,
      default: false,
    },
    loyaltyPoints: {
      type: Number,
      default: 0,
    },
    badge: {
      type: String,
      enum: ['Silver', 'Gold', 'Platinum'],
    },
    requiresPasswordChange: {
      type: Boolean,
      default: false,
    },
    phone: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    profileImage: {
      type: String,
    },
  },
  { timestamps: true }
);

// ─── Hash password before saving ──────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ─── Instance method: compare password ────────────────────────────────────────
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

// ─── Auto-assign badge based on loyalty points ────────────────────────────────
userSchema.methods.updateBadge = function () {
  if (this.loyaltyPoints >= 1000) this.badge = 'Platinum';
  else if (this.loyaltyPoints >= 500) this.badge = 'Gold';
  else if (this.loyaltyPoints >= 100) this.badge = 'Silver';
  else this.badge = undefined;
};

module.exports = mongoose.model('User', userSchema);
