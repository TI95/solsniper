import { Schema, model, Types } from 'mongoose';

export type DexId = 'raydium' | 'pumpswap';
export type PositionStatus = 'open' | 'closed';

export interface Position {
  user: Types.ObjectId;
  tokenAddress: string;
  dexId: DexId;
  amount: number;       // normalized token amount
  amountRaw: number;    // raw (pre-decimals) amount
  decimals: number;
  buyPriceUSD: number;
  buyPriceSOL: number;
  totalCostUSD: number;
  txId: string;
  status: PositionStatus;
  openedAt: Date;
}

const PositionSchema = new Schema<Position>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tokenAddress: { type: String, required: true },
  dexId: { type: String, enum: ['raydium', 'pumpswap'], required: true },
  amount: { type: Number, required: true },
  amountRaw: { type: Number, required: true },
  decimals: { type: Number, required: true },
  buyPriceUSD: { type: Number, required: true },
  buyPriceSOL: { type: Number, required: true },
  totalCostUSD: { type: Number, required: true },
  txId: { type: String, required: true },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  openedAt: { type: Date, default: Date.now },
});

PositionSchema.index({ user: 1, status: 1 });

export const PositionModel = model<Position>('Position', PositionSchema);
