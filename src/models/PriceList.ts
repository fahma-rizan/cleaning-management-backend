import mongoose, { Schema, Document } from 'mongoose';

export interface IPriceList extends Document {
  serviceId:   number;
  serviceName: string;
  category:    string;
  pricingType: string;
  pricing:     any;
}

const PriceListSchema = new Schema<IPriceList>({
  serviceId:   { type: Number, required: true, unique: true },
  serviceName: { type: String, required: true },
  category:    { type: String, required: true },
  pricingType: { type: String, required: true },
  pricing:     { type: Schema.Types.Mixed, required: true },
}, { timestamps: true });

export default mongoose.model<IPriceList>('PriceList', PriceListSchema);