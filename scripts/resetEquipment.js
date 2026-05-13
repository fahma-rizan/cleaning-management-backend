const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  require('../models/index');
  const Equipment = require('../models/Equipment');
  
  const result = await Equipment.updateMany(
    { status: 'in_use' },
    { $set: { status: 'available', assignedTo: null } }
  );
  
  console.log('Equipment reset to available:', result.modifiedCount);
  mongoose.disconnect();
});