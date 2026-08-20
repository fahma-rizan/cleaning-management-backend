const mongoose = require('mongoose');

const otpTokenSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
  },
  otp: {
    type: String,
    required: true,
    select: false,
  },
  purpose: {
    type: String,
    enum: ['verify_email', 'reset_password'],
    required: true,
  },
  attempts: {
    type: Number,
    default: 0,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 }, // TTL — Mongo auto-deletes after expiresAt
  },
});

module.exports = mongoose.model('OtpToken', otpTokenSchema);
