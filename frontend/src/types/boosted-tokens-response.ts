import type { BoostedToken } from "./boosted-token";

// The DexScreener boosted-tokens endpoint returns a bare array of boosted tokens.
// This is the type of `response.data` (the generic passed to axios.get<T>), not the
// full AxiosResponse wrapper.
export type DexScreenerBoostedTokensResponse = BoostedToken[];
