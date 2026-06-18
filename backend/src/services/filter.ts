import { FILTER } from '../config/trading-config';
import { DexId } from '../models/position-model';
import { FilterValues } from '../models/filter-config-model';

export interface Candidate {
  chainId: string;
  dexId: string;
  url: string;
  baseToken: { address: string; name: string };
  liquidity?: { usd?: number };
  marketCap: number;
  boosts: { active: number };
  pairCreatedAt: number; // ms epoch
}

export function passesFilter(c: Candidate, nowMs: number, filter: FilterValues): boolean {
  const nowSec = Math.floor(nowMs / 1000);
  const minCreatedSec = nowSec - filter.maxAgeMinutes * 60;
  const liquidityUsd = c.liquidity?.usd ?? 0;
  return (
    c.chainId === FILTER.CHAIN_ID &&
    (FILTER.ALLOWED_DEXES as readonly string[]).includes(c.dexId) &&
    liquidityUsd >= filter.minLiquidityUSD &&
    c.marketCap <= filter.maxMarketCapUSD &&
    c.boosts.active >= filter.minBoosts &&
    Math.floor(c.pairCreatedAt / 1000) >= minCreatedSec
  );
}

export function dedupeByBaseToken(candidates: Candidate[]): Candidate[] {
  const map = new Map<string, Candidate>();
  for (const c of candidates) {
    if (!map.has(c.baseToken.address)) map.set(c.baseToken.address, c);
  }
  return Array.from(map.values());
}

export function dexIdOf(c: Candidate): DexId {
  return c.dexId as DexId;
}
