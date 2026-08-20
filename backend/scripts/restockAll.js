const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const { InventoryItem } = require('../models/index');
  const result = await InventoryItem.updateMany(
    { type: 'consumable', quantity: 0 },
    { $set: { quantity: 50, costPerUnit: 200 } }
  );
  console.log('Restocked items:', result.modifiedCount);
  mongoose.disconnect();
});