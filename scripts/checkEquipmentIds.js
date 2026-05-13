const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const { InventoryItem } = require('../models/index');

  const ids = [
    '69f9e6db3b8b892db12a3d6a',
    '69f9e6db3b8b892db12a3d7c',
    '69f9e6db3b8b892db12a3d86',
    '69f9e6db3b8b892db12a3daa',
    '69f9e6db3b8b892db12a3d8e'
  ];

  for (const id of ids) {
    const item = await InventoryItem.findById(id);
    console.log(id, '->', item ? item.name : 'NOT FOUND in InventoryItem');
  }

  mongoose.disconnect();
});