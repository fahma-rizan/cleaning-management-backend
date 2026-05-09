import mongoose, { Schema, Document } from 'mongoose';

export interface IStaff extends Document {
  name:           string;
  email:          string;
  phone:          string;
  nic:            string;
  address:        string;
  specifications: string[];
  rating:         number;
  jobsCompleted:  number;
  status:         'Active' | 'Inactive';
  photoUrl:       string;
  createdBy?:     mongoose.Types.ObjectId;
}

const StaffSchema = new Schema<IStaff>({
  name:           { type: String, required: true },
  email:          { type: String, required: true, unique: true },
  phone:          { type: String, required: true },
  nic:            { type: String, required: true, unique: true },
  address:        { type: String, default: '' },
  specifications: { type: [String], default: [] },
  rating:         { type: Number, default: 0 },
  jobsCompleted:  { type: Number, default: 0 },
  status:         { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  photoUrl:       { type: String, default: '' },
  createdBy:      { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
}, { timestamps: true });

export default mongoose.model<IStaff>('Staff', StaffSchema);