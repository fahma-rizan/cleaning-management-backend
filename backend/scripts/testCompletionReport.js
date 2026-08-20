const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const { Booking, User, MaterialRequest, InventoryItem } = require('../models/index');
  const materialRequestService = require('../services/materialRequestService');
  const completionReportService = require('../services/completionReportService');

  const customer = await User.findOne({ role: 'customer' });
  const admin = await User.findOne({ role: 'admin' });

  const booking = await Booking.create({
    customerId:       customer._id,
    serviceType:      'house_deep_cleaning',
    subType:          'normal',
    usageFactor:      'square_feet',
    usageFactorValue: 500,
    scheduledDate:    new Date('2026-05-10'),
    materialStatus:   'pending_materials',
    jobLead:          customer._id,
  });
  console.log('1. Booking created:', booking._id);

  await materialRequestService.calculateMaterialNeeds(booking._id);
  const request = await MaterialRequest.findOne({ bookingId: booking._id });
  console.log('2. Material request created:', request._id);

  await materialRequestService.approveMaterialRequest(request._id, admin._id);
  console.log('3. Material request approved');

  const cleanerBefore = await InventoryItem.findOne({ name: 'All-purpose cleaner' });
  console.log('4. Stock after approval:', cleanerBefore.quantity, 'L');

  const consumables = request.items
    .filter(i => i.itemType === 'consumable')
    .map(i => ({
      itemId:       i.itemId,
      allocatedQty: i.requestedQty,
      reportedUsed: Math.floor(i.requestedQty * 0.8),
    }));

  const report = await completionReportService.submitReport(
    booking._id,
    customer._id,
    { consumables }
  );
  console.log('5. Report submitted:', report._id);
  console.log('   Status:', report.status);
  console.log('   isLocked:', report.isLocked);
  console.log('   Flagged items:', report.usageItems.filter(i => i.flagged).length);

  await completionReportService.verifyReport(report._id, admin._id, true, null);
  console.log('6. Report approved by admin');

  const cleanerAfter = await InventoryItem.findOne({ name: 'All-purpose cleaner' });
  console.log('7. Stock after return:', cleanerAfter.quantity, 'L');

  const finalBooking = await Booking.findById(booking._id);
  console.log('8. Final materialStatus:', finalBooking.materialStatus);

  mongoose.disconnect();
});