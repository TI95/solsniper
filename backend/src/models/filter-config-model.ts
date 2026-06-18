import { Schema, model, Types } from 'mongoose';

export interface FilterValues {
  minLiquidityUSD: number;
  maxMarketCapUSD: number;
  maxAgeMinutes: number;
  minBoosts: number;
}

export interface FilterConfig extends FilterValues {
  user: Types.ObjectId;
  updatedAt: Date;
}

const FilterConfigSchema = new Schema<FilterConfig>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  minLiquidityUSD: { type: Number, required: true },
  maxMarketCapUSD: { type: Number, required: true },
  maxAgeMinutes: { type: Number, required: true },
  minBoosts: { type: Number, required: true },
  updatedAt: { type: Date, default: Date.now },
});

export const FilterConfigModel = model<FilterConfig>('FilterConfig', FilterConfigSchema);
