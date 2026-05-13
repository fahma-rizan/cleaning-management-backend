const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role:     { type: String, required: true, default: 'customer', enum: ['customer', 'staff', 'operation_admin', 'customer_support_admin', 'main_admin', 'admin', 'super_admin'] },
    phone:              { type: String },
    isVerified:         { type: Boolean, default: false },
    isActive:           { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    googleId:           { type: String, select: false },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', userSchema);