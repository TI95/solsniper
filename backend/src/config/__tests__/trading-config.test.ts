import { describe, it, expect } from 'vitest';
import { TRADING, FILTER } from '../trading-config';

describe('trading config', () => {
  it('exposes trade constants', () => {
    expect(TRADING.BUY_AMOUNT_SOL).toBe(0.015);
    expect(TRADING.TAKE_PROFIT_MULT).toBe(1.35);
    expect(TRADING.STOP_LOSS_MULT).toBe(0.70);
    expect(TRADING.MAX_OPEN_POSITIONS).toBe(1);
  });

  it('exposes filter constants', () => {
    expect(FILTER.CHAIN_ID).toBe('solana');
    expect(FILTER.ALLOWED_DEXES).toContain('raydium');
    expect(FILTER.ALLOWED_DEXES).toContain('pumpswap');
  });
});
