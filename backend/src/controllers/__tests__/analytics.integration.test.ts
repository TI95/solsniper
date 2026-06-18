import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../../app';
import tokenService from '../../services/token-service';
import { UserModel } from '../../models/user-model';
import { TradeModel } from '../../models/trade-model';

let mongod: MongoMemoryServer;

async function makeUser(email: string) {
  const user = await UserModel.create({ email, password: 'x', isActivated: true });
  const { accessToken } = tokenService.generateTokens({
    id: user._id.toString(),
    email,
    isActivated: true,
  });
  return { id: user._id.toString(), token: accessToken };
}

async function addTrade(userId: string, realizedPnlUSD: number, closedAt: string) {
  await TradeModel.create({
    user: userId,
    tokenAddress: 'TokenMint111',
    dexId: 'raydium',
    buyPriceUSD: 1,
    sellPriceUSD: 2,
    amount: 1,
    realizedPnlUSD,
    reason: 'take_profit',
    txId: 'sig',
    closedAt: new Date(closedAt),
  });
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
beforeEach(async () => {
  await UserModel.deleteMany({});
  await TradeModel.deleteMany({});
});

describe('GET /api/analytics/pnl', () => {
  it('rejects unauthenticated request', async () => {
    const res = await request(app).get('/api/analytics/pnl');
    expect(res.status).toBe(401);
  });

  it('returns empty analytics when user has no trades', async () => {
    const a = await makeUser('a@e.com');
    const res = await request(app)
      .get('/api/analytics/pnl')
      .set('Authorization', `Bearer ${a.token}`);
    expect(res.status).toBe(200);
    expect(res.body.series).toEqual([]);
    expect(res.body.kpis.totalPnlUSD).toBe(0);
    expect(res.body.kpis.trades).toBe(0);
  });

  it('returns cumulative series and kpis for the user', async () => {
    const a = await makeUser('a@e.com');
    await addTrade(a.id, 5, '2026-06-01T00:00:00Z');
    await addTrade(a.id, -2, '2026-06-02T00:00:00Z');
    const res = await request(app)
      .get('/api/analytics/pnl')
      .set('Authorization', `Bearer ${a.token}`);
    expect(res.status).toBe(200);
    expect(res.body.series.map((p: { cumulativePnlUSD: number }) => p.cumulativePnlUSD)).toEqual([5, 3]);
    expect(res.body.kpis.totalPnlUSD).toBe(3);
    expect(res.body.kpis.trades).toBe(2);
  });

  it('does not leak another user trades (IDOR)', async () => {
    const a = await makeUser('a@e.com');
    const b = await makeUser('b@e.com');
    await addTrade(b.id, 100, '2026-06-01T00:00:00Z');

    const res = await request(app)
      .get('/api/analytics/pnl')
      .set('Authorization', `Bearer ${a.token}`);
    expect(res.status).toBe(200);
    expect(res.body.series).toEqual([]);
    expect(res.body.kpis.totalPnlUSD).toBe(0);
  });
});
