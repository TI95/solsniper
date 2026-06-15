import { describe, it, expect } from 'vitest';
import { passesFilter, dedupeByBaseToken, Candidate } from '../filter';

const now = Date.now();

function make(overrides: Partial<Candidate>): Candidate {
  return {
    chainId: 'solana',
    dexId: 'raydium',
    url: 'https://dexscreener.com/solana/x',
    baseToken: { address: 'TOKEN1', name: 'Tok' },
    liquidity: { usd: 50000 },
    marketCap: 500000,
    boosts: { active: 100 },
    pairCreatedAt: now - 60000, // 1 min ago (ms)
    ...overrides,
  };
}

describe('passesFilter', () => {
  it('passes a good candidate', () => {
    expect(passesFilter(make({}), now)).toBe(true);
  });

  it('rejects wrong chain', () => {
    expect(passesFilter(make({ chainId: 'ethereum' }), now)).toBe(false);
  });

  it('rejects disallowed dex', () => {
    expect(passesFilter(make({ dexId: 'orca' as any }), now)).toBe(false);
  });

  it('rejects low liquidity', () => {
    expect(passesFilter(make({ liquidity: { usd: 1000 } }), now)).toBe(false);
  });

  it('rejects high market cap', () => {
    expect(passesFilter(make({ marketCap: 99999999 }), now)).toBe(false);
  });

  it('rejects too few boosts', () => {
    expect(passesFilter(make({ boosts: { active: 1 } }), now)).toBe(false);
  });

  it('rejects too-old token', () => {
    expect(passesFilter(make({ pairCreatedAt: now - 60 * 60 * 1000 }), now)).toBe(false);
  });
});

describe('dedupeByBaseToken', () => {
  it('keeps one per base token address', () => {
    const a = make({});
    const b = make({});
    const c = make({ baseToken: { address: 'TOKEN2', name: 'Other' } });
    expect(dedupeByBaseToken([a, b, c])).toHaveLength(2);
  });
});
