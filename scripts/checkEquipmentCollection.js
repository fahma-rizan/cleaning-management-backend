const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const db = mongoose.connection.db;
  
  const equipmentCount = await db.collection('equipment').countDocuments();
  const inventoryCount = await db.collection('inventoryitems').countDocuments();
  
  console.log('Documents in equipment collection:', equipmentCount);
  console.log('Documents in inventoryitems collection:', inventoryCount);
  
  const sampleEquipment = await db.collection('equipment').findOne();
  console.log('\nSample from equipment collection:');
  console.log(sampleEquipment);
  
  const sampleInventory = await db.collection('inventoryitems').findOne({ type: 'equipment' });
  console.log('\nSample equipment from inventoryitems collection:');
  console.log(sampleInventory);

  mongoose.disconnect();
});