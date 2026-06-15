import { Schema, model, Types } from 'mongoose';
import { DexId } from './position-model';

export type TradeReason = 'take_profit' | 'stop_loss' | 'manual' | 'dust';

export interface Trade {
  user: Types.ObjectId;
  tokenAddress: string;
  dexId: DexId;
  buyPriceUSD: number;
  sellPriceUSD: number;
  amount: number;
  realizedPnlUSD: number;
  reason: TradeReason;
  txId: string;
  closedAt: Date;
}

const TradeSchema = new Schema<Trade>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tokenAddress: { type: String, required: true },
  dexId: { type: String, enum: ['raydium', 'pumpswap'], required: true },
  buyPriceUSD: { type: Number, required: true },
  sellPriceUSD: { type: Number, required: true },
  amount: { type: Number, required: true },
  realizedPnlUSD: { type: Number, required: true },
  reason: { type: String, enum: ['take_profit', 'stop_loss', 'manual', 'dust'], required: true },
  txId: { type: String, default: '' },
  closedAt: { type: Date, default: Date.now },
});

TradeSchema.index({ user: 1, closedAt: -1 });

export const TradeModel = model<Trade>('Trade', TradeSchema);
