export const TRADING = {
  BUY_AMOUNT_SOL: 0.015,
  SELL_FRACTION: 0.95,
  TAKE_PROFIT_MULT: 1.35,
  STOP_LOSS_MULT: 0.70,
  DUST_MULT: 0.10,
  MAX_OPEN_POSITIONS: 1,
  BUY_COOLDOWN_SEC: 30,
  MAX_TOKEN_AGE_SEC: 60 * 25,
} as const;

export const FILTER = {
  CHAIN_ID: 'solana',
  ALLOWED_DEXES: ['raydium', 'pumpswap'] as const,
  MIN_LIQUIDITY_USD: 25000,
  MAX_MARKET_CAP_USD: 1300000,
  MIN_BOOSTS: 50,
} as const;

export const WORKER = {
  LOOP_INTERVAL_MS: 5000, // sell/price check cadence
  CANDIDATE_REFRESH_MS: 60000, // candidate refresh cadence
} as const;

export const SOL_MINT = 'So11111111111111111111111111111111111111112';
