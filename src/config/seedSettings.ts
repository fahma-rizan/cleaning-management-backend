import mongoose from 'mongoose';
import dotenv   from 'dotenv';
dotenv.config();

import Settings from '../models/Settings';

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI!);
  const exists = await Settings.findOne();
  if (exists) { console.log('Settings already exist — skipping'); process.exit(0); }
  await Settings.create({});
  console.log('Settings seeded with defaults');
  process.exit(0);
};

seed().catch(err => { console.error(err); process.exit(1); });