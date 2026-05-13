const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  require('../models/index');
  const { Booking, User, MaterialRequest } = require('../models/index');
  const completionReportService = require('../services/completionReportService');

  const booking = await Booking.findOne({ 
    materialStatus: 'materials_approved' 
  }).sort({ createdAt: -1 });

  if (!booking) {
    console.log('No approved booking found.');
    mongoose.disconnect();
    return;
  }

  console.log('Using booking:', booking._id);
  console.log('Service:', booking.serviceType, '/', booking.subType);

  const customer = await User.findById(booking.customerId);
  const request = await MaterialRequest.findOne({ bookingId: booking._id });

  if (!request) {
    console.log('No material request found');
    mongoose.disconnect();
    return;
  }

  const consumables = request.items
    .filter(i => i.itemType === 'consumable')
    .map(i => ({
      itemId:       i.itemId,
      allocatedQty: i.requestedQty,
      reportedUsed: Math.ceil(i.requestedQty * 0.8),
    }));

  const equipment = request.items
    .filter(i => i.itemType === 'equipment')
    .map(i => ({
      equipmentId: i.itemId,
      condition:   'good',
    }));

  const report = await completionReportService.submitReport(
    booking._id,
    customer._id,
    { consumables, equipment }
  );

  console.log('\nReport submitted!');
  console.log('Report ID:', report._id);
  console.log('Status:', report.status);
  console.log('isLocked:', report.isLocked);
  console.log('Flagged items:', report.usageItems.filter(i => i.flagged).length);

  mongoose.disconnect();
});