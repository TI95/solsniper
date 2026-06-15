import axios from 'axios';
import { Candidate } from './filter';

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
