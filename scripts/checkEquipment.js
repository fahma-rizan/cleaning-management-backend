const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const { ConsumptionRate } = require('../models/index');

  const rate = await ConsumptionRate.findOne({
    serviceType: 'house_deep_cleaning',
    subType: 'normal'
  });

  console.log('Total items in rate:', rate.items.length);
  console.log('\nAll items:');
  rate.items.forEach(item => {
    console.log('-', item.itemType, '| flatPerJob:', item.flatPerJob, '| rate:', item.ratePerUnit, '| itemId:', item.itemId);
  });

  mongoose.disconnect();
});