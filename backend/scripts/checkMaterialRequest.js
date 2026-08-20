const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const { MaterialRequest, Booking } = require('../models/index');

  const booking = await Booking.findById('69fa1c337c409bb984e692f1');
  console.log('Booking materialStatus:', booking.materialStatus);
  console.log('Booking materialRequestId:', booking.materialRequestId);

  const request = await MaterialRequest.findOne({ 
    bookingId: '69fa1c337c409bb984e692f1' 
  }).populate('items.itemId');
  
  if (!request) {
    console.log('No material request found');
    mongoose.disconnect();
    return;
  }

  console.log('\nMaterial Request ID:', request._id);
  console.log('Status:', request.status);
  console.log('\nItems requested:');
  request.items.forEach(item => {
    console.log(
      '-', item.itemId?.name || item.itemId,
      '| Type:', item.itemType,
      '| Qty:', item.requestedQty
    );
  });

  mongoose.disconnect();
});