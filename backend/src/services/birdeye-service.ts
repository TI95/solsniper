import axios from 'axios';
import { SOL_MINT } from '../config/trading-config';

function headers() {
  return {
    accept: 'application/json',
    'x-chain': 'solana',
    'X-API-KEY': process.env.BIRDEYE_API_KEY as string,
  };
}

export async function getTokenPrice(
  tokenAddress: string
): Promise<{ value: number; priceInNative: number }> {
  try {
    const url = `${process.env.BIRDEYE_PRICE_API}${tokenAddress}`;
    const res = await axios.get(url, { headers: headers() });
    const data = (res.data as { data: { value: number; priceInNative: number } }).data;
    return { value: data.value, priceInNative: data.priceInNative };
  } catch (e) {
    console.error('Birdeye price error:', e);
    return { value: 0, priceInNative: 0 };
  }
}

export async function getSOLPrice(): Promise<number> {
  try {
    const url = `${process.env.BIRDEYE_PRICE_API}${SOL_MINT}`;
    const res = await axios.get(url, { headers: headers() });
    return (res.data as { data: { value: number } }).data.value;
  } catch (e) {
    console.error('Birdeye SOL price error:', e);
    return 0;
  }
}
