const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const { MaterialRequest, InventoryItem } = require('../models/index');

  const requests = await MaterialRequest.find({ status: 'pending' })
    .sort({ createdAt: -1 })
    .limit(5);

  console.log('Latest 5 pending material requests:\n');

  for (const req of requests) {
    console.log('Request ID:', req._id);
    console.log('Total items:', req.items.length);
    console.log('Consumables:', req.items.filter(i => i.itemType === 'consumable').length);
    console.log('Items:');
    for (const item of req.items) {
      const found = await InventoryItem.findById(item.itemId);
      const name  = found?.name || 'Not found';
      console.log(`  - ${name} | ${item.itemType} | qty: ${item.requestedQty}`);
    }
    console.log();
  }

  mongoose.disconnect();
});