import api from './axiosInstance';

export interface PnlPoint {
  t: string;
  cumulativePnlUSD: number;
}

export interface PnlKpis {
  totalPnlUSD: number;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  bestUSD: number;
  worstUSD: number;
}

export interface PnlAnalytics {
  series: PnlPoint[];
  kpis: PnlKpis;
}

export const getPnlAnalytics = async (): Promise<PnlAnalytics> => {
  const res = await api.get<PnlAnalytics>('/analytics/pnl');
  return res.data;
};
