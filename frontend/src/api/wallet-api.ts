import api from './axiosInstance';

export interface WalletView {
  publicKey: string;
  botEnabled: boolean;
}

export const saveWallet = async (secretKey: string): Promise<{ publicKey: string }> => {
  const res = await api.post<{ publicKey: string }>('/wallet', { secretKey });
  return res.data;
};

export const getWallet = async (): Promise<WalletView | null> => {
  const res = await api.get<WalletView | null>('/wallet');
  return res.data;
};

export const deleteWallet = async (): Promise<void> => {
  await api.delete('/wallet');
};

export const startBot = async (): Promise<{ botEnabled: boolean }> => {
  const res = await api.post<{ botEnabled: boolean }>('/bot/start');
  return res.data;
};

export const stopBot = async (): Promise<{ botEnabled: boolean }> => {
  const res = await api.post<{ botEnabled: boolean }>('/bot/stop');
  return res.data;
};

export const generateWallet = async (): Promise<{ publicKey: string }> => {
  const res = await api.post<{ publicKey: string }>('/wallet/generate');
  return res.data;
};

export const getBalance = async (): Promise<{ lamports: number; sol: number }> => {
  const res = await api.get<{ lamports: number; sol: number }>('/wallet/balance');
  return res.data;
};

export const withdrawSol = async (
  password: string,
  destination: string,
  amountSol: number | null,
  max: boolean
): Promise<{ txId: string }> => {
  const res = await api.post<{ txId: string }>('/wallet/withdraw', {
    password,
    destination,
    amountSol: amountSol ?? undefined,
    max,
  });
  return res.data;
};

export const exportSecret = async (password: string): Promise<{ secretKey: string }> => {
  const res = await api.post<{ secretKey: string }>('/wallet/export', { password });
  return res.data;
};

export const manualSell = async (
  tokenAddress: string,
  amount: number,
  platform: 'raydium' | 'pumpfun'
): Promise<{ txId: string }> => {
  const res = await api.post<{ txId: string }>('/sell/manual', { tokenAddress, amount, platform });
  return res.data;
};

export interface PositionView {
  _id: string;
  tokenAddress: string;
  dexId: 'raydium' | 'pumpswap';
  amount: number;
  buyPriceUSD: number;
  totalCostUSD: number;
  openedAt: string;
}

export interface TradeView {
  _id: string;
  tokenAddress: string;
  buyPriceUSD: number;
  sellPriceUSD: number;
  realizedPnlUSD: number;
  reason: string;
  closedAt: string;
}

export const getPositions = async (): Promise<PositionView[]> => {
  const res = await api.get<PositionView[]>('/positions');
  return res.data;
};

export const getTrades = async (): Promise<TradeView[]> => {
  const res = await api.get<TradeView[]>('/trades');
  return res.data;
};
