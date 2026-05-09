import mongoose   from 'mongoose';
import dotenv     from 'dotenv';
dotenv.config();

import Customer from '../models/Customer';

//add mock customers to test
const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI!);
  console.log('Connected');

  const count = await Customer.countDocuments();
  if (count > 0) {
    console.log('Customers already exist — skipping');
    process.exit(0);
  }

  await Customer.insertMany([
    { name: 'Nimali Perera',   email: 'nimali@gmail.com',   phone: '+94 77 111 2233', totalBookings: 12, totalSpent: 24500, loyaltyPoints: 245, status: 'active',   lastBooking: new Date('2026-04-20') },
    { name: 'Kasun Silva',     email: 'kasun@gmail.com',    phone: '+94 76 333 4455', totalBookings: 5,  totalSpent: 8750,  loyaltyPoints: 87,  status: 'active',   lastBooking: new Date('2026-04-15') },
    { name: 'Dilani Fernando', email: 'dilani@gmail.com',   phone: '+94 71 555 6677', totalBookings: 3,  totalSpent: 4200,  loyaltyPoints: 42,  status: 'inactive', lastBooking: new Date('2026-03-10') },
    { name: 'Ruwan Bandara',   email: 'ruwan@gmail.com',    phone: '+94 77 777 8899', totalBookings: 8,  totalSpent: 15600, loyaltyPoints: 156, status: 'active',   lastBooking: new Date('2026-04-22') },
    { name: 'Sachini Jayawardena', email: 'sachini@gmail.com', phone: '+94 70 999 0011', totalBookings: 1, totalSpent: 1500, loyaltyPoints: 15, status: 'blocked', lastBooking: new Date('2026-02-05') },
  ]);

  console.log('Customers seeded successfully');
  process.exit(0);
};

seed().catch(err => { console.error(err); process.exit(1); });