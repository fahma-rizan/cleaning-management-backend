const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  require('../models/index');
  const MaterialRequest = require('../models/MaterialRequest');
  const Booking = require('../models/Booking');

  // Delete all material requests created before May 7
  const cutoff = new Date('2026-05-07T00:00:00.000Z');
  
  const oldRequests = await MaterialRequest.find({ 
    createdAt: { $lt: cutoff } 
  });
  
  console.log('Old requests to delete:', oldRequests.length);
  
  // Delete old bookings linked to these requests
  const oldBookingIds = oldRequests.map(r => r.bookingId).filter(Boolean);
  await Booking.deleteMany({ _id: { $in: oldBookingIds } });
  await MaterialRequest.deleteMany({ createdAt: { $lt: cutoff } });
  
  console.log('Cleaned up successfully');
  
  const remaining = await MaterialRequest.countDocuments();
  console.log('Remaining material requests:', remaining);
  
  mongoose.disconnect();
});