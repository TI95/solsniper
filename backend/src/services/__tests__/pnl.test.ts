import { describe, it, expect } from 'vitest';
import { realizedPnlUSD } from '../pnl';

describe('realizedPnlUSD', () => {
  it('computes profit for amount sold', () => {
    // bought at $2, sold at $3, 10 tokens => $10 profit
    expect(realizedPnlUSD(2, 3, 10)).toBe(10);
  });

  it('computes loss', () => {
    expect(realizedPnlUSD(2, 1, 10)).toBe(-10);
  });

  it('zero amount => zero pnl', () => {
    expect(realizedPnlUSD(2, 3, 0)).toBe(0);
  });
});
