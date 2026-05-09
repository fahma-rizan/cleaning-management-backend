import mongoose, { Schema, Document } from 'mongoose';

export interface IReview extends Document {
  customerId:   mongoose.Types.ObjectId;
  customerName: string;
  serviceName:  string;
  rating:       number;
  content:      string;
  status:       'Pending' | 'Approved' | 'Hidden';
  createdAt:    Date;
}

const ReviewSchema = new Schema<IReview>({
  customerId:   { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  customerName: { type: String, required: true },
  serviceName:  { type: String, required: true },
  rating:       { type: Number, required: true, min: 1, max: 5 },
  content:      { type: String, default: '' },
  status:       { type: String, enum: ['Pending', 'Approved', 'Hidden'], default: 'Pending' },
}, { timestamps: true });

export default mongoose.model<IReview>('Review', ReviewSchema);