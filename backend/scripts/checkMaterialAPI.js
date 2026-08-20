const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  require('../models/index');
  const MaterialRequest = require('../models/MaterialRequest');
  
  const all = await MaterialRequest.find({})
    .select('status bookingId items createdAt')
    .lean();

  console.log('All material requests:');
  all.forEach(r => {
    console.log(`ID: ${r._id} | status: ${r.status} | bookingId: ${r.bookingId} | items: ${r.items?.length} | created: ${r.createdAt}`);
  });

  mongoose.disconnect();
});