const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  require('../models/index');
  const Booking = require('../models/Booking');
  const MaterialRequest = require('../models/MaterialRequest');

  const bookings = await Booking.find({ 
    materialStatus: 'materials_approved' 
  }).sort({ createdAt: -1 });

  console.log('Approved bookings:', bookings.length);
  for (const b of bookings) {
    const req = await MaterialRequest.findOne({ bookingId: b._id });
    console.log('Booking:', b._id, '| service:', b.serviceType, '| items:', req?.items?.length || 0);
  }

  mongoose.disconnect();
});