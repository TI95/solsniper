import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import filterConfigService, { validateFilterValues } from '../filter-config-service';
import { FilterConfigModel } from '../../models/filter-config-model';
import ApiError from '../../exceptions/api-errors';

const valid = { minLiquidityUSD: 25000, maxMarketCapUSD: 1300000, maxAgeMinutes: 25, minBoosts: 50 };

describe('validateFilterValues', () => {
  it('accepts a valid filter', () => {
    expect(validateFilterValues(valid)).toEqual(valid);
  });
  it('accepts minLiquidityUSD = 0 and minBoosts = 0', () => {
    const v = { ...valid, minLiquidityUSD: 0, minBoosts: 0 };
    expect(validateFilterValues(v)).toEqual(v);
  });
  it('rejects a missing field', () => {
    expect(() => validateFilterValues({ ...valid, minBoosts: undefined })).toThrow(ApiError);
  });
  it('rejects a non-numeric field', () => {
    expect(() => validateFilterValues({ ...valid, maxMarketCapUSD: '5' })).toThrow(ApiError);
  });
  it('rejects maxMarketCapUSD = 0', () => {
    expect(() => validateFilterValues({ ...valid, maxMarketCapUSD: 0 })).toThrow(ApiError);
  });
  it('rejects maxAgeMinutes = 0', () => {
    expect(() => validateFilterValues({ ...valid, maxAgeMinutes: 0 })).toThrow(ApiError);
  });
  it('rejects non-integer maxAgeMinutes', () => {
    expect(() => validateFilterValues({ ...valid, maxAgeMinutes: 1.5 })).toThrow(ApiError);
  });
  it('rejects negative minLiquidityUSD', () => {
    expect(() => validateFilterValues({ ...valid, minLiquidityUSD: -1 })).toThrow(ApiError);
  });
  it('rejects non-integer minBoosts', () => {
    expect(() => validateFilterValues({ ...valid, minBoosts: 1.5 })).toThrow(ApiError);
  });
  it('rejects negative minBoosts', () => {
    expect(() => validateFilterValues({ ...valid, minBoosts: -1 })).toThrow(ApiError);
  });
});

let mongod: MongoMemoryServer;
const userId = new mongoose.Types.ObjectId().toString();

describe('filter-config-service CRUD', () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await FilterConfigModel.deleteMany({});
  });

  it('getForUser returns null when nothing saved', async () => {
    expect(await filterConfigService.getForUser(userId)).toBeNull();
    expect(await filterConfigService.hasForUser(userId)).toBe(false);
  });

  it('saveForUser persists and getForUser reads back', async () => {
    const saved = await filterConfigService.saveForUser(userId, valid);
    expect(saved).toEqual(valid);
    expect(await filterConfigService.getForUser(userId)).toEqual(valid);
    expect(await filterConfigService.hasForUser(userId)).toBe(true);
  });

  it('saveForUser upserts (one doc per user)', async () => {
    await filterConfigService.saveForUser(userId, valid);
    await filterConfigService.saveForUser(userId, { ...valid, minBoosts: 99 });
    expect(await FilterConfigModel.countDocuments({ user: userId })).toBe(1);
    expect((await filterConfigService.getForUser(userId))!.minBoosts).toBe(99);
  });

  it('saveForUser rejects invalid input', async () => {
    await expect(filterConfigService.saveForUser(userId, { ...valid, maxMarketCapUSD: 0 })).rejects.toThrow(ApiError);
  });
});
