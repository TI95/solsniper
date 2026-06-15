import { Connection } from '@solana/web3.js';
import axios from 'axios';
import { API_URLS } from '@raydium-io/raydium-sdk-v2';

let _connection: Connection | null = null;

export function getConnection(): Connection {
  if (!_connection) {
    const endpoint = process.env.QUICKNODE_ENDPOINT;
    if (!endpoint) throw new Error('QUICKNODE_ENDPOINT is not defined');
    _connection = new Connection(endpoint);
  }
  return _connection;
}

/** Raydium "very high" priority fee (lamports), used as the starting fee. */
export async function getRaydiumPriorityFee(): Promise<number> {
  const { data } = await axios.get<{
    data: { default: { vh: number; h: number; m: number } };
  }>(`${API_URLS.BASE_HOST}${API_URLS.PRIORITY_FEE}`);
  return data.data.default.vh;
}
