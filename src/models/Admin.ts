import mongoose, { Schema, Document } from 'mongoose';

export type AdminRole = 'Super Admin' | 'Main Admin' | 'Operations Manager' | 'Customer Support';

export interface IAdmin extends Document {
  name:         string;
  email:        string;
  password:     string;
  phone:        string;
  address:      string;
  role:         AdminRole;
  status:       'Active' | 'Inactive';
  isSuperAdmin: boolean;
  lastActive:   Date;
  createdBy?:   mongoose.Types.ObjectId;
}

const AdminSchema = new Schema<IAdmin>({
  name:         { type: String, required: true },
  email:        { type: String, required: true, unique: true },
  password:     { type: String, required: true },
  phone:        { type: String, default: '' },
  address:      { type: String, default: '' },
  role:         { type: String, enum: ['Super Admin', 'Main Admin', 'Operations Manager', 'Customer Support'], required: true },
  status:       { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  isSuperAdmin: { type: Boolean, default: false },
  lastActive:   { type: Date, default: () => new Date() },
  createdBy:    { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
}, { timestamps: true });

export default mongoose.model<IAdmin>('Admin', AdminSchema);