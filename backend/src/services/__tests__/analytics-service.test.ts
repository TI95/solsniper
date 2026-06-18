import { describe, it, expect } from 'vitest';
import { buildPnlAnalytics } from '../analytics-service';

const t = (realizedPnlUSD: number, iso: string) => ({
  realizedPnlUSD,
  closedAt: new Date(iso),
});

describe('buildPnlAnalytics', () => {
  it('empty input => empty series and zeroed kpis', () => {
    const out = buildPnlAnalytics([]);
    expect(out.series).toEqual([]);
    expect(out.kpis).toEqual({
      totalPnlUSD: 0,
      trades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      bestUSD: 0,
      worstUSD: 0,
    });
  });

  it('single trade => single cumulative point', () => {
    const out = buildPnlAnalytics([t(5, '2026-06-01T00:00:00Z')]);
    expect(out.series).toEqual([{ t: '2026-06-01T00:00:00.000Z', cumulativePnlUSD: 5 }]);
    expect(out.kpis.totalPnlUSD).toBe(5);
    expect(out.kpis.trades).toBe(1);
    expect(out.kpis.wins).toBe(1);
    expect(out.kpis.winRate).toBe(1);
  });

  it('accumulates in closedAt order even when input is unordered', () => {
    const out = buildPnlAnalytics([
      t(10, '2026-06-03T00:00:00Z'),
      t(-4, '2026-06-01T00:00:00Z'),
      t(6, '2026-06-02T00:00:00Z'),
    ]);
    expect(out.series.map((p) => p.cumulativePnlUSD)).toEqual([-4, 2, 12]);
    expect(out.series[0].t).toBe('2026-06-01T00:00:00.000Z');
  });

  it('mixed win/loss/zero => correct kpis (zero is neither win nor loss)', () => {
    const out = buildPnlAnalytics([
      t(8, '2026-06-01T00:00:00Z'),
      t(-3, '2026-06-02T00:00:00Z'),
      t(0, '2026-06-03T00:00:00Z'),
    ]);
    expect(out.kpis).toEqual({
      totalPnlUSD: 5,
      trades: 3,
      wins: 1,
      losses: 1,
      winRate: 1 / 3,
      bestUSD: 8,
      worstUSD: -3,
    });
  });

  it('all losses => best is the least-bad (still negative)', () => {
    const out = buildPnlAnalytics([
      t(-2, '2026-06-01T00:00:00Z'),
      t(-9, '2026-06-02T00:00:00Z'),
    ]);
    expect(out.kpis.bestUSD).toBe(-2);
    expect(out.kpis.worstUSD).toBe(-9);
    expect(out.kpis.wins).toBe(0);
    expect(out.kpis.losses).toBe(2);
  });
});
