
import { model, Schema, Types } from 'mongoose';


export interface BoughtTokensData   {
    user: Types.ObjectId;
    totalCost: number;
    amount: number;
    amountInLamports: number;
    decimals: number;
    buyPriceInUSD: number;
    dexId: 'raydium' | 'pumpswap';
}

const TokensDataScema = new Schema<BoughtTokensData>({
    user: {type: Schema.Types.ObjectId, ref: 'User'},
    totalCost: { type: Number, required: true },
    amount: { type: Number, required: true },
    amountInLamports: { type: Number, required: true },
    decimals: { type: Number, required: true },
    buyPriceInUSD: { type: Number, required: true },
    dexId: { type: String, enum: ['raydium', 'pumpswap'], required: true },
}
)

export const TokensDataModel = model<BoughtTokensData>('TokensData', TokensDataScema)