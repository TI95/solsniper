import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { parseSecretKey } from '../../utils/keypair';

vi.mock('../../blockchain/connection', () => ({
  getConnection: vi.fn(() => ({ getBalance: vi.fn().mockResolvedValue(2_000_000_000) })),
}));
vi.mock('../../blockchain/transfer', () => ({
  transferSol: vi.fn().mockResolvedValue('SIG_OK'),
}));

import app from '../../app';
import tokenService from '../../services/token-service';
import { UserModel } from '../../models/user-model';
import { WalletModel } from '../../models/wallet-model';

let mongod: MongoMemoryServer;
const DEST = 'So11111111111111111111111111111111111111112'; // valid 32-byte base58 pubkey (wrapped SOL mint)

async function makeUser(email: string, password = 'pw-secret-123') {
  const user = await UserModel.create({
    email,
    password: await bcrypt.hash(password, 12),
    isActivated: true,
  });
  const { accessToken } = tokenService.generateTokens({
    id: user._id.toString(),
    email,
    isActivated: true,
  });
  return { id: user._id.toString(), token: accessToken, password };
}

beforeAll(async () => {
  process.env.WALLET_ENCRYPTION_KEY = '0'.repeat(64);
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
});

describe('wallet management endpoints', () => {
  it('rejects unauthenticated requests on all four endpoints', async () => {
    expect((await request(app).post('/api/wallet/generate')).status).toBe(401);
    expect((await request(app).get('/api/wallet/balance')).status).toBe(401);
    expect((await request(app).post('/api/wallet/withdraw').send({})).status).toBe(401);
    expect((await request(app).post('/api/wallet/export').send({})).status).toBe(401);
  });

  it('generate creates a wallet and GET /wallet shows its public key', async () => {
    const a = await makeUser('a@e.com');
    const gen = await request(app)
      .post('/api/wallet/generate')
      .set('Authorization', `Bearer ${a.token}`);
    expect(gen.status).toBe(200);
    expect(typeof gen.body.publicKey).toBe('string');

    const view = await request(app).get('/api/wallet').set('Authorization', `Bearer ${a.token}`);
    expect(view.body.publicKey).toBe(gen.body.publicKey);
  });

  it('balance returns sol for the stored wallet', async () => {
    const a = await makeUser('a@e.com');
    await request(app).post('/api/wallet/generate').set('Authorization', `Bearer ${a.token}`);
    const res = await request(app)
      .get('/api/wallet/balance')
      .set('Authorization', `Bearer ${a.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ lamports: 2_000_000_000, sol: 2 });
  });

  it('export with the correct password returns the wallet secret', async () => {
    const a = await makeUser('a@e.com');
    const gen = await request(app)
      .post('/api/wallet/generate')
      .set('Authorization', `Bearer ${a.token}`);
    const res = await request(app)
      .post('/api/wallet/export')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ password: a.password });
    expect(res.status).toBe(200);
    expect(parseSecretKey(res.body.secretKey).publicKey.toBase58()).toBe(gen.body.publicKey);
  });

  it('export with a wrong password is rejected with 400', async () => {
    const a = await makeUser('a@e.com');
    await request(app).post('/api/wallet/generate').set('Authorization', `Bearer ${a.token}`);
    const res = await request(app)
      .post('/api/wallet/export')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ password: 'wrong' });
    expect(res.status).toBe(400);
  });

  it('withdraw with the correct password transfers and returns a txId', async () => {
    const a = await makeUser('a@e.com');
    await request(app).post('/api/wallet/generate').set('Authorization', `Bearer ${a.token}`);
    const res = await request(app)
      .post('/api/wallet/withdraw')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ password: a.password, destination: DEST, amountSol: 0.5 });
    expect(res.status).toBe(200);
    expect(res.body.txId).toBe('SIG_OK');
  });

  it('withdraw with a wrong password is rejected with 400', async () => {
    const a = await makeUser('a@e.com');
    await request(app).post('/api/wallet/generate').set('Authorization', `Bearer ${a.token}`);
    const res = await request(app)
      .post('/api/wallet/withdraw')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ password: 'wrong', destination: DEST, amountSol: 0.5 });
    expect(res.status).toBe(400);
  });

  it("export is scoped per user — A gets A's secret, never B's (IDOR)", async () => {
    const a = await makeUser('a@e.com');
    const b = await makeUser('b@e.com');
    const genA = await request(app)
      .post('/api/wallet/generate')
      .set('Authorization', `Bearer ${a.token}`);
    const genB = await request(app)
      .post('/api/wallet/generate')
      .set('Authorization', `Bearer ${b.token}`);
    expect(genA.body.publicKey).not.toBe(genB.body.publicKey);

    const exportA = await request(app)
      .post('/api/wallet/export')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ password: a.password });
    const pk = parseSecretKey(exportA.body.secretKey).publicKey.toBase58();
    expect(pk).toBe(genA.body.publicKey);
    expect(pk).not.toBe(genB.body.publicKey);
  });
});
