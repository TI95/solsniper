import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { getTokenPrice, getSOLPrice } from '../birdeye-service';

vi.mock('axios');

describe('birdeye-service', () => {
  beforeEach(() => {
    process.env.BIRDEYE_API_KEY = 'k';
    process.env.BIRDEYE_PRICE_API = 'https://api.test/price?address=';
    vi.clearAllMocks();
  });

  it('returns value + priceInNative', async () => {
    (axios.get as any).mockResolvedValue({ data: { data: { value: 1.5, priceInNative: 0.01 } } });
    const r = await getTokenPrice('MINT');
    expect(r).toEqual({ value: 1.5, priceInNative: 0.01 });
  });

  it('returns zeros on error', async () => {
    (axios.get as any).mockRejectedValue(new Error('boom'));
    const r = await getTokenPrice('MINT');
    expect(r).toEqual({ value: 0, priceInNative: 0 });
  });

  it('getSOLPrice returns value', async () => {
    (axios.get as any).mockResolvedValue({ data: { data: { value: 210 } } });
    expect(await getSOLPrice()).toBe(210);
  });
});
