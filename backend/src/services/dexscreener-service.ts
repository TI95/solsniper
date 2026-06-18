import axios from 'axios';
import { Candidate } from './filter';
import { WORKER } from '../config/trading-config';

interface BoostedToken {
  chainId: string;
  tokenAddress: string;
  amount: number;
}

const BOOSTS_URL = 'https://api.dexscreener.com/token-boosts/latest/v1';
const PAIRS_URL = 'https://api.dexscreener.com/token-pairs/v1';

export async function fetchCandidates(): Promise<Candidate[]> {
  try {
    const res = await axios.get<BoostedToken[]>(BOOSTS_URL);
    if (!Array.isArray(res.data)) {
      console.error('Expected boosts array, got:', res.data);
      return [];
    }
    const boosted = res.data.filter((t) => t.amount >= 10 && t.chainId);
    const pairs = await Promise.all(
      boosted.map(async (t) => {
        try {
          const r = await axios.get<Candidate[]>(`${PAIRS_URL}/${t.chainId}/${t.tokenAddress}`);
          return r.data;
        } catch (e) {
          console.error(`Pair info error for ${t.tokenAddress}:`, e);
          return [] as Candidate[];
        }
      })
    );
    return pairs.flat();
  } catch (e) {
    console.error('fetchCandidates error:', e);
    return [];
  }
}

// Shared, process-wide cache: the boosted-token list is the same for every user,
// so we refetch from DexScreener at most once per WORKER.CANDIDATE_REFRESH_MS
// instead of on every ~5s worker loop (avoids rate-limiting).
let candidateCache: { at: number; data: Candidate[] } | null = null;

/**
 * Candidates with throttled refresh: returns the cached list while it is younger
 * than WORKER.CANDIDATE_REFRESH_MS, otherwise refetches. `now` is injectable for tests.
 */
export async function getCandidates(now: number = Date.now()): Promise<Candidate[]> {
  if (candidateCache && now - candidateCache.at < WORKER.CANDIDATE_REFRESH_MS) {
    return candidateCache.data;
  }
  const data = await fetchCandidates();
  candidateCache = { at: now, data };
  return data;
}

/** Test seam: clears the throttle cache so each test starts fresh. */
export function resetCandidateCache(): void {
  candidateCache = null;
}
