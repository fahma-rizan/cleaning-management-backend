const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const User = require('../models/User');
  
  // Find the staff user
  const user = await User.findOne({ email: 'staff@cloudlaundry.lk' });
  if (!user) {
    console.log('Staff user not found');
    mongoose.disconnect();
    return;
  }
  
  console.log('Found user:', user.email, '| role:', user.role);
  
  // Set new password directly on the document
  // This triggers the pre-save bcrypt hook
  user.password = 'Staff@1234';
  await user.save();
  
  console.log('Password updated successfully');
  console.log('Try logging in with: staff@cloudlaundry.lk / Staff@1234');
  
  mongoose.disconnect();
});