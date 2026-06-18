import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../../app';
import tokenService from '../../services/token-service';
import { UserModel } from '../../models/user-model';
import { WalletModel } from '../../models/wallet-model';
import { FilterConfigModel } from '../../models/filter-config-model';

let mongod: MongoMemoryServer;

const validFilter = { minLiquidityUSD: 25000, maxMarketCapUSD: 1300000, maxAgeMinutes: 25, minBoosts: 50 };

async function makeUser(email: string) {
  const user = await UserModel.create({ email, password: 'x', isActivated: true });
  const { accessToken } = tokenService.generateTokens({ id: user._id.toString(), email, isActivated: true });
  return { id: user._id.toString(), token: accessToken };
}

async function giveWallet(userId: string) {
  await WalletModel.create({
    user: userId,
    publicKey: 'pk',
    encryptedSecret: 'e',
    iv: 'i',
    authTag: 't',
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
  await WalletModel.deleteMany({});
  await FilterConfigModel.deleteMany({});
});

describe('POST /bot/start filter gate', () => {
  it('blocks bot start when no filter is configured', async () => {
    const a = await makeUser('a@e.com');
    await giveWallet(a.id);
    const res = await request(app).post('/api/bot/start').set('Authorization', `Bearer ${a.token}`);
    expect(res.status).toBe(400);
  });

  it('allows bot start once a filter exists', async () => {
    const a = await makeUser('a@e.com');
    await giveWallet(a.id);
    await request(app).put('/api/filter').set('Authorization', `Bearer ${a.token}`).send(validFilter);
    const res = await request(app).post('/api/bot/start').set('Authorization', `Bearer ${a.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ botEnabled: true });
  });
});
