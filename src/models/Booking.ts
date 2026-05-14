import mongoose, { Schema, Document } from 'mongoose';

export interface IBooking extends Document {
  bookingId:          string;
  customerId:         mongoose.Types.ObjectId;
  customerName:       string;
  customerEmail:      string;
  serviceId:          string;
  serviceName:        string;
  serviceType:        string;
  serviceCategory:    string;
  date:               string;
  time:               string;
  address:            string;
  price:              number;
  paidAmount:         number;
  balanceAmount:      number;
  status:             string;
  paymentMethod:      string;
  paymentMethodName:  string;
  paymentStatus:      string;
  assignedStaffId?:   mongoose.Types.ObjectId;
  assignedStaffName:  string;
  assignedStaffEmail: string;
  assignedTeam:       { staffId: mongoose.Types.ObjectId; staffName: string; staffEmail: string }[];
  scheduledAt?:       Date;
  createdAt:          Date;
  updatedAt:          Date;
}

const BookingSchema = new Schema<IBooking>({
  scheduledAt:        { type: Date, default: null },
  bookingId:          { type: String, required: true, unique: true },
  customerId:         { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  customerName:       { type: String, required: true },
  customerEmail:      { type: String, default: '' },
  serviceId:          { type: String, default: '' },
  serviceName:        { type: String, required: true },
  serviceType:        { type: String, default: '' },
  serviceCategory:    { type: String, default: '' },
  date:               { type: String, required: true },
  time:               { type: String, default: '' },
  address:            { type: String, default: '' },
  price:              { type: Number, required: true },
  paidAmount:         { type: Number, default: 0 },
  balanceAmount:      { type: Number, default: 0 },
  status:             { type: String, default: 'pending' },
  paymentMethod:      { type: String, default: 'cash' },
  paymentMethodName:  { type: String, default: '' },
  paymentStatus:      { type: String, default: 'pending' },
  assignedStaffId:    { type: Schema.Types.ObjectId, ref: 'Staff', default: null },
  assignedStaffName:  { type: String, default: '' },
  assignedStaffEmail: { type: String, default: '' },
  assignedTeam: [{
    staffId:    { type: Schema.Types.ObjectId, ref: 'Staff' },
    staffName:  { type: String },
    staffEmail: { type: String },
  }],
}, { timestamps: true });

export default mongoose.model<IBooking>('Booking', BookingSchema);