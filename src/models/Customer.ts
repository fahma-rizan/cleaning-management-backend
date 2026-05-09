import mongoose, { Schema, Document } from 'mongoose';

export interface ICustomer extends Document {
  name:          string;
  email:         string;
  phone:         string;
  joinDate:      Date;
  totalBookings: number;
  totalSpent:    number;
  loyaltyPoints: number;
  status:        'active' | 'inactive' | 'blocked';
  lastBooking?:  Date;
}

const CustomerSchema = new Schema<ICustomer>({
  name:          { type: String, required: true },
  email:         { type: String, required: true, unique: true },
  phone:         { type: String, default: '' },
  joinDate:      { type: Date, default: () => new Date() },
  totalBookings: { type: Number, default: 0 },
  totalSpent:    { type: Number, default: 0 },
  loyaltyPoints: { type: Number, default: 0 },
  status:        { type: String, enum: ['active', 'inactive', 'blocked'], default: 'active' },
  lastBooking:   { type: Date, default: null },
}, { timestamps: true });

export default mongoose.model<ICustomer>('Customer', CustomerSchema);