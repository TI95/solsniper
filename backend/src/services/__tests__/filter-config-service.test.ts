import { describe, it, expect } from 'vitest';
import { validateFilterValues } from '../filter-config-service';
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
