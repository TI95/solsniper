import api from './axiosInstance';

export interface FilterValues {
  minLiquidityUSD: number;
  maxMarketCapUSD: number;
  maxAgeMinutes: number;
  minBoosts: number;
}

export const getFilter = async (): Promise<FilterValues | null> => {
  const res = await api.get<FilterValues | null>('/filter');
  return res.data;
};

export const saveFilter = async (values: FilterValues): Promise<FilterValues> => {
  const res = await api.put<FilterValues>('/filter', values);
  return res.data;
};
