import mongoose   from 'mongoose';
import bcrypt     from 'bcryptjs';
import dotenv     from 'dotenv';
dotenv.config();

import Admin from '../models/Admin';

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI!);
  console.log('Connected');

  const existing = await Admin.findOne({ isSuperAdmin: true });
  if (existing) {
    console.log('Super Admin already exists — skipping');
    process.exit(0);
  }

  const hash = await bcrypt.hash('SuperAdmin@2026!', 10);
  await Admin.create({
    name:         'Super Admin',
    email:        'superadmin@cloudlaundry.lk',
    password:     hash,
    phone:        '+94 77 123 6547',
    address:      '13 Main Street, Colombo 02',
    role:         'Super Admin',
    status:       'Active',
    isSuperAdmin: true,
  });

  console.log('Super Admin seeded successfully');
  process.exit(0);
};

seed().catch(err => { console.error(err); process.exit(1); });