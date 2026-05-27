const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true 
  },
  type: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  read: {
    type: Boolean,
    default: false,
  },
  actionUrl: {
    type: String,
  },
  bookingId: {
    type: String,
  }
}, { timestamps: true }); // timestamps adds createdAt and updatedAt fields automatically

const Notification = mongoose.model('Notification', NotificationSchema);

module.exports = Notification;