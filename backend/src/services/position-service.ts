import { PositionModel, Position, DexId } from '../models/position-model';
import { TradeModel, TradeReason } from '../models/trade-model';
import { realizedPnlUSD } from './pnl';

export interface OpenPositionInput {
  tokenAddress: string;
  dexId: DexId;
  amount: number;
  amountRaw: number;
  decimals: number;
  buyPriceUSD: number;
  buyPriceSOL: number;
  totalCostUSD: number;
  txId: string;
}

class PositionService {
  async openPosition(userId: string, input: OpenPositionInput) {
    return PositionModel.create({ ...input, user: userId, status: 'open' });
  }

  async countOpen(userId: string): Promise<number> {
    return PositionModel.countDocuments({ user: userId, status: 'open' });
  }

  async hasOpenForToken(userId: string, tokenAddress: string): Promise<boolean> {
    const n = await PositionModel.countDocuments({ user: userId, status: 'open', tokenAddress });
    return n > 0;
  }

  async getOpenPositions(userId: string): Promise<Position[]> {
    return PositionModel.find({ user: userId, status: 'open' });
  }

  async getTrades(userId: string) {
    return TradeModel.find({ user: userId }).sort({ closedAt: -1 });
  }

  /** Marks the position closed and records a Trade. `amount` sold == position.amount * SELL_FRACTION upstream. */
  async closePosition(positionId: string, sellPriceUSD: number, reason: TradeReason, txId: string) {
    const pos = await PositionModel.findById(positionId);
    if (!pos) throw new Error('Position not found');
    pos.status = 'closed';
    await pos.save();
    return TradeModel.create({
      user: pos.user,
      tokenAddress: pos.tokenAddress,
      dexId: pos.dexId,
      buyPriceUSD: pos.buyPriceUSD,
      sellPriceUSD,
      amount: pos.amount,
      realizedPnlUSD: realizedPnlUSD(pos.buyPriceUSD, sellPriceUSD, pos.amount),
      reason,
      txId,
    });
  }
}

export default new PositionService();
