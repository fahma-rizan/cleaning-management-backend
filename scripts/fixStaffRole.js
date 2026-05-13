const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const User = require('../models/User');
  await User.updateOne(
    { email: 'staff@cloudlaundry.lk' },
    { $set: { role: 'staff' } }
  );
  console.log('Staff role updated to staff');
  mongoose.disconnect();
});