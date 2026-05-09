import mongoose from 'mongoose';
import dotenv   from 'dotenv';
dotenv.config();

import Review    from '../models/Review';
import Complaint from '../models/Complaint';
import Customer  from '../models/Customer';

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI!);
  console.log('Connected');

  // Get a real customer id
  const customer = await Customer.findOne();
  if (!customer) {
    console.log('No customers found — run seedCustomers first');
    process.exit(1);
  }

  const reviewCount = await Review.countDocuments();
  if (reviewCount === 0) {
    await Review.insertMany([
      { customerId: customer._id, customerName: 'Nimali Perera',   serviceName: 'Deep Cleaning',  rating: 5, content: 'Excellent service!',        status: 'Approved' },
      { customerId: customer._id, customerName: 'Kasun Silva',     serviceName: 'Washing',         rating: 4, content: 'Good but a bit slow.',      status: 'Pending'  },
      { customerId: customer._id, customerName: 'Ruwan Bandara',   serviceName: 'Pressing',        rating: 3, content: 'Average experience.',        status: 'Pending'  },
      { customerId: customer._id, customerName: 'Dilani Fernando', serviceName: 'Deep Cleaning',   rating: 5, content: 'Will use again!',            status: 'Approved' },
      { customerId: customer._id, customerName: 'Sachini J.',      serviceName: 'Dry Cleaning',    rating: 2, content: 'Items returned with stain.', status: 'Hidden'   },
    ]);
    console.log('Reviews seeded');
  } else {
    console.log('Reviews already exist — skipping');
  }

  const complaintCount = await Complaint.countDocuments();
  if (complaintCount === 0) {
    await Complaint.insertMany([
      {
        title: 'Damaged clothing item', description: 'My shirt was returned with a tear.',
        customerId: customer._id, customerName: 'Nimali Perera',
        serviceName: 'Washing', serviceDate: new Date('2026-04-10'),
        priority: 'High', status: 'Pending', notes: [],
      },
      {
        title: 'Late delivery', description: 'Order was 2 days late.',
        customerId: customer._id, customerName: 'Kasun Silva',
        serviceName: 'Deep Cleaning', serviceDate: new Date('2026-04-05'),
        priority: 'Medium', status: 'In Progress', notes: [],
      },
      {
        title: 'Wrong items returned', description: 'Received someone else\'s clothes.',
        customerId: customer._id, customerName: 'Ruwan Bandara',
        serviceName: 'Dry Cleaning', serviceDate: new Date('2026-03-28'),
        priority: 'High', status: 'Resolved', notes: [],
      },
    ]);
    console.log('Complaints seeded');
  } else {
    console.log('Complaints already exist — skipping');
  }

  process.exit(0);
};

seed().catch(err => { console.error(err); process.exit(1); });