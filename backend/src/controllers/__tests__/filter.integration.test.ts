import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../../app';
import tokenService from '../../services/token-service';
import { UserModel } from '../../models/user-model';
import { FilterConfigModel } from '../../models/filter-config-model';

let mongod: MongoMemoryServer;

const validFilter = { minLiquidityUSD: 25000, maxMarketCapUSD: 1300000, maxAgeMinutes: 25, minBoosts: 50 };

async function makeUser(email: string) {
  const user = await UserModel.create({ email, password: 'x', isActivated: true });
  const { accessToken } = tokenService.generateTokens({
    id: user._id.toString(),
    email,
    isActivated: true,
  });
  return { id: user._id.toString(), token: accessToken };
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
  await FilterConfigModel.deleteMany({});
});

describe('filter endpoints', () => {
  it('rejects unauthenticated PUT /filter', async () => {
    const res = await request(app).put('/api/filter').send(validFilter);
    expect(res.status).toBe(401);
  });

  it('saves and reads back a filter', async () => {
    const a = await makeUser('a@e.com');
    const put = await request(app)
      .put('/api/filter')
      .set('Authorization', `Bearer ${a.token}`)
      .send(validFilter);
    expect(put.status).toBe(200);
    expect(put.body).toMatchObject(validFilter);

    const get = await request(app).get('/api/filter').set('Authorization', `Bearer ${a.token}`);
    expect(get.status).toBe(200);
    expect(get.body).toMatchObject(validFilter);
  });

  it('returns null when no filter configured', async () => {
    const a = await makeUser('a@e.com');
    const get = await request(app).get('/api/filter').set('Authorization', `Bearer ${a.token}`);
    expect(get.status).toBe(200);
    expect(get.body).toBeNull();
  });

  it('rejects an invalid filter (maxMarketCapUSD = 0) with 400', async () => {
    const a = await makeUser('a@e.com');
    const res = await request(app)
      .put('/api/filter')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ ...validFilter, maxMarketCapUSD: 0 });
    expect(res.status).toBe(400);
  });

  it('does not leak or overwrite another user filter (IDOR)', async () => {
    const a = await makeUser('a@e.com');
    const b = await makeUser('b@e.com');

    // B saves a filter
    await request(app).put('/api/filter').set('Authorization', `Bearer ${b.token}`).send(validFilter);

    // A has no filter of its own
    const aGet = await request(app).get('/api/filter').set('Authorization', `Bearer ${a.token}`);
    expect(aGet.body).toBeNull();

    // A saving its own does not touch B's
    await request(app)
      .put('/api/filter')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ ...validFilter, minBoosts: 1 });
    const bGet = await request(app).get('/api/filter').set('Authorization', `Bearer ${b.token}`);
    expect(bGet.body).toMatchObject({ minBoosts: 50 });
  });
});
