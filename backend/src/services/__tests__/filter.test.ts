import { describe, it, expect } from 'vitest';
import { passesFilter, dedupeByBaseToken, Candidate } from '../filter';
import { FilterValues } from '../../models/filter-config-model';

const now = Date.now();
const filter: FilterValues = {
  minLiquidityUSD: 25000,
  maxMarketCapUSD: 1300000,
  maxAgeMinutes: 25,
  minBoosts: 50,
};

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
    expect(passesFilter(make({}), now, filter)).toBe(true);
  });
  it('rejects wrong chain', () => {
    expect(passesFilter(make({ chainId: 'ethereum' }), now, filter)).toBe(false);
  });
  it('rejects disallowed dex', () => {
    expect(passesFilter(make({ dexId: 'orca' as any }), now, filter)).toBe(false);
  });
  it('rejects liquidity below the filter', () => {
    expect(passesFilter(make({ liquidity: { usd: 24999 } }), now, filter)).toBe(false);
  });
  it('accepts liquidity exactly at the filter', () => {
    expect(passesFilter(make({ liquidity: { usd: 25000 } }), now, filter)).toBe(true);
  });
  it('rejects market cap above the filter', () => {
    expect(passesFilter(make({ marketCap: 1300001 }), now, filter)).toBe(false);
  });
  it('rejects boosts below the filter', () => {
    expect(passesFilter(make({ boosts: { active: 49 } }), now, filter)).toBe(false);
  });
  it('rejects a token older than maxAgeMinutes', () => {
    expect(passesFilter(make({ pairCreatedAt: now - 26 * 60 * 1000 }), now, filter)).toBe(false);
  });
  it('accepts a token within maxAgeMinutes', () => {
    expect(passesFilter(make({ pairCreatedAt: now - 24 * 60 * 1000 }), now, filter)).toBe(true);
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
