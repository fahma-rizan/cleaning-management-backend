const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  require('../models/index');
  const Equipment = require('../models/Equipment');
  const MaterialRequest = require('../models/MaterialRequest');
  const Booking = require('../models/Booking');
  const CompletionReport = require('../models/CompletionReport');
  const { InventoryItem } = require('../models/index');

  // Reset all equipment to available
  await Equipment.updateMany({}, { 
    $set: { status: 'available', assignedTo: null } 
  });
  console.log('All equipment reset to available');

  // Reset all consumable stock to 50
  await InventoryItem.updateMany(
    { type: 'consumable' },
    { $set: { quantity: 50 } }
  );
  console.log('All consumable stock reset to 50');

  // Delete all completion reports
  await CompletionReport.deleteMany({});
  console.log('All completion reports deleted');

  // Delete all material requests except the 5 demo ones
  // Keep only requests from the demo bookings (created May 7)
  const cutoff = new Date('2026-05-07T00:00:00.000Z');
  await MaterialRequest.deleteMany({ createdAt: { $lt: cutoff } });
  
  // Delete all bookings except demo ones
  await Booking.deleteMany({ createdAt: { $lt: cutoff } });
  
  const remaining = await MaterialRequest.countDocuments();
  console.log('Remaining material requests:', remaining);

  console.log('\nDemo reset complete. Ready for presentation.');
  mongoose.disconnect();
});