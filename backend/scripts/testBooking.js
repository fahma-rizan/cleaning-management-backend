const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const { Booking, User, MaterialRequest, InventoryItem } = require('../models/index');
  const getMaterialRequestService = () => require('../services/materialRequestService');

  const customer = await User.findOne({ role: 'customer' });

  const booking = await Booking.create({
    customerId:       customer._id,
    serviceType:      'house_deep_cleaning',
    subType:          'normal',
    usageFactor:      'square_feet',
    usageFactorValue: 500,
    scheduledDate:    new Date('2026-05-10'),
    materialStatus:   'pending_materials',
    bookingRef:       'TEST-' + Date.now(),
  });

  console.log('Booking created:', booking._id);

  await getMaterialRequestService().calculateMaterialNeeds(booking._id);

  const request = await MaterialRequest.findOne({ bookingId: booking._id });

  if (!request) {
    console.log('ERROR: No material request found');
    mongoose.disconnect();
    return;
  }

  console.log('\nMaterial Request ID:', request._id);
  console.log('Status:', request.status);
  console.log('Total items:', request.items.length);
  console.log('\nItems requested:');

  for (const item of request.items) {
    const found = await InventoryItem.findById(item.itemId);
    const name  = found ? found.name : 'Not found in InventoryItem';
    console.log(
      '-', name,
      '| Type:', item.itemType,
      '| Requested Qty:', item.requestedQty
    );
  }

  mongoose.disconnect();
});