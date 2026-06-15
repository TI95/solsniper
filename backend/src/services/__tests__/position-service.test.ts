import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import positionService from '../position-service';
import { PositionModel } from '../../models/position-model';
import { TradeModel } from '../../models/trade-model';

let mongod: MongoMemoryServer;
const userId = new mongoose.Types.ObjectId().toString();

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
beforeEach(async () => {
  await PositionModel.deleteMany({});
  await TradeModel.deleteMany({});
});

const sample = {
  tokenAddress: 'TOKEN',
  dexId: 'raydium' as const,
  amount: 100,
  amountRaw: 100_000_000,
  decimals: 6,
  buyPriceUSD: 2,
  buyPriceSOL: 0.01,
  totalCostUSD: 200,
  txId: 'tx1',
};

describe('position-service', () => {
  it('opens a position', async () => {
    const p = await positionService.openPosition(userId, sample);
    expect(p.status).toBe('open');
    expect(await positionService.countOpen(userId)).toBe(1);
  });

  it('hasOpenForToken detects duplicates', async () => {
    await positionService.openPosition(userId, sample);
    expect(await positionService.hasOpenForToken(userId, 'TOKEN')).toBe(true);
    expect(await positionService.hasOpenForToken(userId, 'OTHER')).toBe(false);
  });

  it('closePosition writes a trade with realized pnl and marks closed', async () => {
    const p = await positionService.openPosition(userId, sample);
    const trade = await positionService.closePosition(p.id, 3, 'take_profit', 'tx2');
    expect(trade.realizedPnlUSD).toBe((3 - 2) * 100);
    expect(trade.reason).toBe('take_profit');
    const reloaded = await PositionModel.findById(p.id);
    expect(reloaded!.status).toBe('closed');
    expect(await positionService.countOpen(userId)).toBe(0);
  });

  it('getOpenPositions / getTrades read back', async () => {
    const p = await positionService.openPosition(userId, sample);
    await positionService.closePosition(p.id, 1, 'stop_loss', 'tx3');
    expect(await positionService.getOpenPositions(userId)).toHaveLength(0);
    expect(await positionService.getTrades(userId)).toHaveLength(1);
  });
});
