import { Trade } from '../models/trade-model';

export interface PnlPoint {
  t: string; // ISO closedAt
  cumulativePnlUSD: number;
}

export interface PnlKpis {
  totalPnlUSD: number;
  trades: number;
  wins: number; // realizedPnlUSD > 0
  losses: number; // realizedPnlUSD < 0
  winRate: number; // wins / trades, 0 when trades === 0
  bestUSD: number; // max realizedPnlUSD, 0 when empty
  worstUSD: number; // min realizedPnlUSD, 0 when empty
}

export interface PnlAnalytics {
  series: PnlPoint[];
  kpis: PnlKpis;
}

type TradeLike = Pick<Trade, 'realizedPnlUSD' | 'closedAt'>;

export function buildPnlAnalytics(trades: TradeLike[]): PnlAnalytics {
  const sorted = [...trades].sort(
    (a, b) => new Date(a.closedAt).getTime() - new Date(b.closedAt).getTime()
  );

  let cumulative = 0;
  const series: PnlPoint[] = sorted.map((trade) => {
    cumulative += trade.realizedPnlUSD;
    return { t: new Date(trade.closedAt).toISOString(), cumulativePnlUSD: cumulative };
  });

  const pnls = sorted.map((trade) => trade.realizedPnlUSD);
  const wins = pnls.filter((p) => p > 0).length;
  const losses = pnls.filter((p) => p < 0).length;
  const trades_ = sorted.length;

  return {
    series,
    kpis: {
      totalPnlUSD: cumulative,
      trades: trades_,
      wins,
      losses,
      winRate: trades_ === 0 ? 0 : wins / trades_,
      bestUSD: pnls.length ? Math.max(...pnls) : 0,
      worstUSD: pnls.length ? Math.min(...pnls) : 0,
    },
  };
}
