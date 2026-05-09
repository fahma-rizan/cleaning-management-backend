import mongoose, { Schema, Document } from 'mongoose';

interface INote {
  adminId:   mongoose.Types.ObjectId;
  adminName: string;
  note:      string;
  createdAt: Date;
}

export interface IComplaint extends Document {
  title:          string;
  description:    string;
  customerId:     mongoose.Types.ObjectId;
  customerName:   string;
  serviceName:    string;
  serviceDate:    Date;
  assignedStaff?: mongoose.Types.ObjectId;
  assignedStaffName?: string;
  priority:       'High' | 'Medium' | 'Low';
  status:         'Pending' | 'In Progress' | 'Resolved';
  notes:          INote[];
  createdAt:      Date;
}

const NoteSchema = new Schema<INote>({
  adminId:   { type: Schema.Types.ObjectId, ref: 'Admin' },
  adminName: { type: String, required: true },
  note:      { type: String, required: true },
  createdAt: { type: Date, default: () => new Date() },
});

const ComplaintSchema = new Schema<IComplaint>({
  title:             { type: String, required: true },
  description:       { type: String, default: '' },
  customerId:        { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  customerName:      { type: String, required: true },
  serviceName:       { type: String, required: true },
  serviceDate:       { type: Date, required: true },
  assignedStaff:     { type: Schema.Types.ObjectId, ref: 'Staff', default: null },
  assignedStaffName: { type: String, default: '' },
  priority:          { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' },
  status:            { type: String, enum: ['Pending', 'In Progress', 'Resolved'], default: 'Pending' },
  notes:             { type: [NoteSchema], default: [] },
}, { timestamps: true });

export default mongoose.model<IComplaint>('Complaint', ComplaintSchema);