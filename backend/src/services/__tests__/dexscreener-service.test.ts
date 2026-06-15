import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { fetchCandidates } from '../dexscreener-service';

vi.mock('axios');

describe('fetchCandidates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('flattens pair info for boosted tokens', async () => {
    (axios.get as any).mockImplementation((url: string) => {
      if (url.includes('/token-boosts/latest')) {
        return Promise.resolve({
          data: [{ chainId: 'solana', tokenAddress: 'T1', amount: 20 }],
        });
      }
      return Promise.resolve({
        data: [{ chainId: 'solana', dexId: 'raydium', baseToken: { address: 'T1', name: 'A' } }],
      });
    });
    const out = await fetchCandidates();
    expect(out).toHaveLength(1);
    expect(out[0].baseToken.address).toBe('T1');
  });

  it('returns [] when boosts response is not an array', async () => {
    (axios.get as any).mockResolvedValue({ data: { error: 'x' } });
    expect(await fetchCandidates()).toEqual([]);
  });
});
