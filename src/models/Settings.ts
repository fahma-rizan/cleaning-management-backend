import mongoose, { Schema, Document } from 'mongoose';

export interface ISettings extends Document {
  general: {
    businessHours:      { start: string; end: string };
    operatingDays:      string[];
    cancellationPolicy: string;
    durations:          { home: number; laundry: number; sofa: number };
    holidays:           { date: string; name: string }[];
  };
  business: {
    name:    string;
    address: string;
    email:   string;
    phone:   string;
  };
  updatedBy?: mongoose.Types.ObjectId;
}

const SettingsSchema = new Schema<ISettings>({
  general: {
    businessHours:      { start: { type: String, default: '09:00' }, end: { type: String, default: '18:00' } },
    operatingDays:      { type: [String], default: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] },
    cancellationPolicy: { type: String, default: '2' },
    durations:          { home: { type: Number, default: 120 }, laundry: { type: Number, default: 60 }, sofa: { type: Number, default: 90 } },
    holidays:           { type: [{ date: String, name: String }], default: [] },
  },
  business: {
    name:    { type: String, default: 'Cloud Laundry.lk' },
    address: { type: String, default: '' },
    email:   { type: String, default: '' },
    phone:   { type: String, default: '' },
  },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
}, { timestamps: true });

export default mongoose.model<ISettings>('Settings', SettingsSchema);