const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  require('../models/index');
  const Booking = require('../models/Booking');
  const MaterialRequest = require('../models/MaterialRequest');

  const latest = await Booking.findOne()
    .sort({ createdAt: -1 });
  
  console.log('Latest booking:');
  console.log('ID:', latest._id);
  console.log('serviceType:', latest.serviceType);
  console.log('subType:', latest.subType);
  console.log('usageFactor:', latest.usageFactor);
  console.log('usageFactorValue:', latest.usageFactorValue);
  console.log('materialStatus:', latest.materialStatus);
  console.log('materialRequestId:', latest.materialRequestId);

  const req = await MaterialRequest.findOne({ bookingId: latest._id });
  console.log('\nMaterial request found:', req ? 'YES' : 'NO');
  if (req) {
    console.log('Request ID:', req._id);
    console.log('Items:', req.items.length);
    console.log('Status:', req.status);
  }

  mongoose.disconnect();
});