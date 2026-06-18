import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { fetchCandidates, getCandidates, resetCandidateCache } from '../dexscreener-service';
import { WORKER } from '../../config/trading-config';

vi.mock('axios');

const boostCallCount = () =>
  (axios.get as any).mock.calls.filter((c: any[]) =>
    String(c[0]).includes('/token-boosts/latest')
  ).length;

function mockBoosts() {
  (axios.get as any).mockImplementation((url: string) => {
    if (url.includes('/token-boosts/latest')) {
      return Promise.resolve({ data: [{ chainId: 'solana', tokenAddress: 'T1', amount: 20 }] });
    }
    return Promise.resolve({
      data: [{ chainId: 'solana', dexId: 'raydium', baseToken: { address: 'T1', name: 'A' } }],
    });
  });
}

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

describe('getCandidates (throttled)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCandidateCache();
  });

  it('fetches once and serves cached candidates within the refresh window', async () => {
    mockBoosts();
    const first = await getCandidates(1000);
    const within = await getCandidates(1000 + WORKER.CANDIDATE_REFRESH_MS - 1);
    expect(first).toEqual(within);
    expect(boostCallCount()).toBe(1);
  });

  it('refetches once the refresh window has elapsed', async () => {
    mockBoosts();
    await getCandidates(1000);
    await getCandidates(1000 + WORKER.CANDIDATE_REFRESH_MS);
    expect(boostCallCount()).toBe(2);
  });
});
