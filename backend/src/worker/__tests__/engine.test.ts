import { describe, it, expect } from 'vitest';
import { sellDecision } from '../engine';
import { TRADING } from '../../config/trading-config';

describe('sellDecision', () => {
  const buy = 2;

  it('take_profit at +35% or more', () => {
    expect(sellDecision(buy, buy * TRADING.TAKE_PROFIT_MULT)).toBe('take_profit');
    expect(sellDecision(buy, buy * 2)).toBe('take_profit');
  });

  it('stop_loss at -30% or worse (but above dust)', () => {
    expect(sellDecision(buy, buy * TRADING.STOP_LOSS_MULT)).toBe('stop_loss');
  });

  it('dust at -90% or worse', () => {
    expect(sellDecision(buy, buy * TRADING.DUST_MULT)).toBe('dust');
    expect(sellDecision(buy, buy * 0.01)).toBe('dust');
  });

  it('hold in between', () => {
    expect(sellDecision(buy, buy)).toBe('hold');
    expect(sellDecision(buy, buy * 1.1)).toBe('hold');
  });
});
