import mongoose from 'mongoose';
import dotenv   from 'dotenv';
dotenv.config();

import Booking  from '../models/Booking';
import Customer from '../models/Customer';

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI!);
  console.log('Connected');

  const count = await Booking.countDocuments();
  if (count > 0) { console.log('Bookings already exist — skipping'); process.exit(0); }

  const customer = await Customer.findOne();
  if (!customer) { console.log('No customers — run seedCustomers first'); process.exit(1); }

  const today    = new Date();
  const fmt      = (d: Date) => d.toISOString().split('T')[0];
  const days     = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return fmt(d); };
  const months   = (n: number) => { const d = new Date(); d.setMonth(d.getMonth() - n); return fmt(d); };

  const parseScheduledAt = (dateStr: string, timeRange: string) => {
    const start = (timeRange || '').split('-')[0].trim();
    const m = start.match(/(\d{1,2}):(\d{2})(AM|PM)/i);
    if (!m) {
      const parts = dateStr.split('-').map(Number);
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    let hour = parseInt(m[1], 10);
    const minute = parseInt(m[2], 10);
    const ampm = m[3].toUpperCase();
    if (ampm === 'PM' && hour !== 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    const [y, mo, d] = dateStr.split('-').map(Number);
    return new Date(y, mo - 1, d, hour, minute, 0);
  };

  const bookingsData = [
    // Today's bookings
    { bookingId: `BK-${Date.now()}01`, customerId: customer._id, customerName: customer.name, customerEmail: customer.email, serviceId: '1', serviceName: 'House Deep Cleaning',   serviceType: 'Home/Office Cleaning', serviceCategory: 'House Deep Cleaning', date: fmt(today), time: '9:00AM - 11:00AM',  address: 'Colombo 05', price: 4500, paidAmount: 4500, balanceAmount: 0,    status: 'completed',       paymentMethod: 'card', paymentMethodName: 'Credit Card',       paymentStatus: 'paid',    assignedStaffName: '', assignedStaffEmail: '', assignedTeam: [] },
    { bookingId: `BK-${Date.now()}02`, customerId: customer._id, customerName: customer.name, customerEmail: customer.email, serviceId: '2', serviceName: 'Washing & Pressing',       serviceType: 'Laundry',              serviceCategory: 'Washing & Pressing',   date: fmt(today), time: '02:00PM - 04:00PM', address: 'Colombo 03', price: 1200, paidAmount: 0,    balanceAmount: 1200, status: 'confirmed-unpaid', paymentMethod: 'cod',  paymentMethodName: 'Cash on Delivery',  paymentStatus: 'pending', assignedStaffName: '', assignedStaffEmail: '', assignedTeam: [] },
    { bookingId: `BK-${Date.now()}03`, customerId: customer._id, customerName: customer.name, customerEmail: customer.email, serviceId: '3', serviceName: 'Sofa Cleaning',         serviceType: 'Sofa/Upholstery',      serviceCategory: 'Sofa Cleaning',       date: fmt(today), time: '09:00AM - 10:00AM', address: 'Colombo 07', price: 3500, paidAmount: 0,    balanceAmount: 3500, status: 'pending',         paymentMethod: 'cod',  paymentMethodName: 'Cash on Delivery',  paymentStatus: 'pending', assignedStaffName: '', assignedStaffEmail: '', assignedTeam: [] },
    { bookingId: `BK-${Date.now()}04`, customerId: customer._id, customerName: customer.name, customerEmail: customer.email, serviceId: '1', serviceName: 'House Deep Cleaning',   serviceType: 'Home/Office Cleaning', serviceCategory: 'House Deep Cleaning', date: fmt(today), time: '11:00AM - 01:00PM', address: 'Colombo 02', price: 8000, paidAmount: 8000, balanceAmount: 0,    status: 'completed',       paymentMethod: 'card', paymentMethodName: 'Credit Card',       paymentStatus: 'paid',    assignedStaffName: '', assignedStaffEmail: '', assignedTeam: [] },
    { bookingId: `BK-${Date.now()}05`, customerId: customer._id, customerName: customer.name, customerEmail: customer.email, serviceId: '4', serviceName: 'Commercial Cleaning',       serviceType: 'Home/Office Cleaning', serviceCategory: 'Commercial Cleaning',     date: fmt(today), time: '08:00AM - 10:00AM', address: 'Colombo 01', price: 5000, paidAmount: 0,    balanceAmount: 5000, status: 'cancelled',       paymentMethod: 'cod',  paymentMethodName: 'Cash on Delivery',  paymentStatus: 'pending', assignedStaffName: '', assignedStaffEmail: '', assignedTeam: [] },
    // Past bookings for charts
    { bookingId: `BK-${Date.now()}06`, customerId: customer._id, customerName: customer.name, customerEmail: customer.email, serviceId: '2', serviceName: 'Washing & Pressing',       serviceType: 'Laundry',              serviceCategory: 'Washing & Pressing',   date: days(5),    time: '10:00AM - 12:00PM', address: 'Colombo 05', price: 2200, paidAmount: 2200, balanceAmount: 0, status: 'completed', paymentMethod: 'card', paymentMethodName: 'Credit Card', paymentStatus: 'paid', assignedStaffName: '', assignedStaffEmail: '', assignedTeam: [] },
    { bookingId: `BK-${Date.now()}07`, customerId: customer._id, customerName: customer.name, customerEmail: customer.email, serviceId: '1', serviceName: 'House Deep Cleaning',   serviceType: 'Home/Office Cleaning', serviceCategory: 'House Deep Cleaning', date: days(10),   time: '02:00PM - 04:00PM', address: 'Colombo 03', price: 5500, paidAmount: 5500, balanceAmount: 0, status: 'completed', paymentMethod: 'card', paymentMethodName: 'Credit Card', paymentStatus: 'paid', assignedStaffName: '', assignedStaffEmail: '', assignedTeam: [] },
    { bookingId: `BK-${Date.now()}08`, customerId: customer._id, customerName: customer.name, customerEmail: customer.email, serviceId: '5', serviceName: 'Curtain Cleaning',      serviceType: 'Curtain',              serviceCategory: 'Curtain Cleaning',    date: months(1),  time: '09:00AM - 10:00AM', address: 'Colombo 07', price: 1800, paidAmount: 1800, balanceAmount: 0, status: 'completed', paymentMethod: 'cash', paymentMethodName: 'Cash',        paymentStatus: 'paid', assignedStaffName: '', assignedStaffEmail: '', assignedTeam: [] },
    { bookingId: `BK-${Date.now()}09`, customerId: customer._id, customerName: customer.name, customerEmail: customer.email, serviceId: '3', serviceName: 'Sofa Cleaning',         serviceType: 'Sofa/Upholstery',      serviceCategory: 'Sofa Cleaning',       date: months(1),  time: '11:00AM - 01:00PM', address: 'Colombo 02', price: 4200, paidAmount: 4200, balanceAmount: 0, status: 'completed', paymentMethod: 'card', paymentMethodName: 'Credit Card', paymentStatus: 'paid', assignedStaffName: '', assignedStaffEmail: '', assignedTeam: [] },
    { bookingId: `BK-${Date.now()}10`, customerId: customer._id, customerName: customer.name, customerEmail: customer.email, serviceId: '1', serviceName: 'House Deep Cleaning',   serviceType: 'Home/Office Cleaning', serviceCategory: 'House Deep Cleaning', date: months(2),  time: '10:00AM - 12:00PM', address: 'Colombo 05', price: 6800, paidAmount: 6800, balanceAmount: 0, status: 'completed', paymentMethod: 'card', paymentMethodName: 'Credit Card', paymentStatus: 'paid', assignedStaffName: '', assignedStaffEmail: '', assignedTeam: [] },
    { bookingId: `BK-${Date.now()}11`, customerId: customer._id, customerName: customer.name, customerEmail: customer.email, serviceId: '2', serviceName: 'Washing & Pressing',       serviceType: 'Laundry',              serviceCategory: 'Washing & Pressing',   date: months(2),  time: '02:00PM - 04:00PM', address: 'Colombo 03', price: 2100, paidAmount: 2100, balanceAmount: 0, status: 'completed', paymentMethod: 'cash', paymentMethodName: 'Cash',        paymentStatus: 'paid', assignedStaffName: '', assignedStaffEmail: '', assignedTeam: [] },
    { bookingId: `BK-${Date.now()}12`, customerId: customer._id, customerName: customer.name, customerEmail: customer.email, serviceId: '4', serviceName: 'Commercial Cleaning',       serviceType: 'Home/Office Cleaning', serviceCategory: 'Commercial Cleaning',     date: months(3),  time: '09:00AM - 10:00AM', address: 'Colombo 01', price: 9500, paidAmount: 9500, balanceAmount: 0, status: 'completed', paymentMethod: 'card', paymentMethodName: 'Credit Card', paymentStatus: 'paid', assignedStaffName: '', assignedStaffEmail: '', assignedTeam: [] },
    { bookingId: `BK-${Date.now()}13`, customerId: customer._id, customerName: customer.name, customerEmail: customer.email, serviceId: '1', serviceName: 'House Deep Cleaning',   serviceType: 'Home/Office Cleaning', serviceCategory: 'House Deep Cleaning', date: months(4),  time: '11:00AM - 01:00PM', address: 'Colombo 02', price: 7200, paidAmount: 7200, balanceAmount: 0, status: 'completed', paymentMethod: 'card', paymentMethodName: 'Credit Card', paymentStatus: 'paid', assignedStaffName: '', assignedStaffEmail: '', assignedTeam: [] },
    { bookingId: `BK-${Date.now()}14`, customerId: customer._id, customerName: customer.name, customerEmail: customer.email, serviceId: '2', serviceName: 'Washing & Pressing',       serviceType: 'Laundry',              serviceCategory: 'Washing & Pressing',   date: months(5),  time: '10:00AM - 12:00PM', address: 'Colombo 05', price: 3300, paidAmount: 3300, balanceAmount: 0, status: 'completed', paymentMethod: 'cash', paymentMethodName: 'Cash',        paymentStatus: 'paid', assignedStaffName: '', assignedStaffEmail: '', assignedTeam: [] },
    { bookingId: `BK-${Date.now()}15`, customerId: customer._id, customerName: customer.name, customerEmail: customer.email, serviceId: '3', serviceName: 'Sofa Cleaning',         serviceType: 'Sofa/Upholstery',      serviceCategory: 'Sofa Cleaning',       date: months(6),  time: '02:00PM - 04:00PM', address: 'Colombo 07', price: 5100, paidAmount: 5100, balanceAmount: 0, status: 'completed', paymentMethod: 'cash', paymentMethodName: 'Cash',        paymentStatus: 'paid', assignedStaffName: '', assignedStaffEmail: '', assignedTeam: [] },
  ];

  const bookingsWithScheduled = bookingsData.map(b => ({ ...b, scheduledAt: parseScheduledAt(b.date, b.time) }));

  await Booking.insertMany(bookingsWithScheduled);

  console.log('Bookings seeded successfully');
  process.exit(0);
};

seed().catch(err => { console.error(err); process.exit(1); });