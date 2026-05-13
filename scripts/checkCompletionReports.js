const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  require('../models/index');
  const CompletionReport = require('../models/CompletionReport');
  
  const reports = await CompletionReport.find({})
    .sort({ createdAt: -1 });
  
  console.log('Total completion reports:', reports.length);
  reports.forEach(r => {
    console.log('ID:', r._id, '| status:', r.status, '| bookingId:', r.bookingId, '| created:', r.createdAt);
  });
  
  mongoose.disconnect();
});