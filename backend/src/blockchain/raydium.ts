import { Keypair, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import axios from 'axios';
import { API_URLS } from '@raydium-io/raydium-sdk-v2';
import { getConnection, getRaydiumPriorityFee } from './connection';
import { SOL_MINT } from '../config/trading-config';

export interface RaydiumSwapCompute {
  id: string;
  success: boolean;
  data: { inputAmount: string; outputAmount: string };
}

export class LiquidErrorRaydium extends Error {
  constructor(public msg: string) {
    super(msg);
  }
}

async function buyToken(
  owner: Keypair,
  outputMint: string,
  amount: number,
  slippage: number,
  priorityFee: number
): Promise<{ txId: string; swapResponse: RaydiumSwapCompute }> {
  const connection = getConnection();
  const inputMint = SOL_MINT;
  const txVersion = 'V0';

  const { data: swapResponse } = await axios.get<RaydiumSwapCompute>(
    `${API_URLS.SWAP_HOST}/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippage * 100}&txVersion=${txVersion}`
  );

  const { data: swapTransactions } = await axios.post<{
    data: { transaction: string }[];
  }>(`${API_URLS.SWAP_HOST}/transaction/swap-base-in`, {
    computeUnitPriceMicroLamports: String(priorityFee),
    swapResponse,
    txVersion,
    wallet: owner.publicKey.toBase58(),
    wrapSol: true,
    unwrapSol: false,
  });

  if (!swapTransactions.data) throw new Error('Invalid response format');

  const txs = swapTransactions.data.map((tx) =>
    VersionedTransaction.deserialize(Buffer.from(tx.transaction, 'base64'))
  );

  let lastTxId = '';
  for (const transaction of txs) {
    transaction.sign([owner]);
    const txId = await connection.sendTransaction(transaction, { skipPreflight: true });
    lastTxId = txId;
    const { lastValidBlockHeight, blockhash } = await connection.getLatestBlockhash({
      commitment: 'finalized',
    });
    await connection.confirmTransaction({ blockhash, lastValidBlockHeight, signature: txId }, 'confirmed');
  }
  return { txId: lastTxId, swapResponse };
}

async function sellToken(
  owner: Keypair,
  inputMint: string,
  amount: number,
  slippage: number,
  priorityFee: number
): Promise<string> {
  const connection = getConnection();
  const outputMint = SOL_MINT;
  const txVersion = 'V0';

  const inputTokenAcc = await getAssociatedTokenAddress(new PublicKey(inputMint), owner.publicKey);
  const outputTokenAcc = await getAssociatedTokenAddress(new PublicKey(outputMint), owner.publicKey);

  const { data: swapResponse } = await axios.get<{
    id: string; success: boolean; version: string; msg?: string;
  }>(
    `${API_URLS.SWAP_HOST}/compute/swap-base-out?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippage * 100}&txVersion=${txVersion}`
  );

  if (!swapResponse.success) {
    if (swapResponse.msg?.includes('INSUFFICIENT_LIQUIDITY')) {
      throw new LiquidErrorRaydium(swapResponse.msg);
    }
    throw new Error('swapResponse error: ' + swapResponse.msg);
  }

  const { data: swapTransactions } = await axios.post<{ data: { transaction: string }[] }>(
    `${API_URLS.SWAP_HOST}/transaction/swap-base-out`,
    {
      computeUnitPriceMicroLamports: String(priorityFee),
      swapResponse,
      txVersion,
      wallet: owner.publicKey.toBase58(),
      wrapSol: false,
      unwrapSol: true,
      inputAccount: inputTokenAcc.toBase58(),
      outputAccount: outputTokenAcc.toBase58(),
    }
  );

  if (!swapTransactions.data) throw new Error('Invalid response format');

  const txs = swapTransactions.data.map((tx) =>
    VersionedTransaction.deserialize(Buffer.from(tx.transaction, 'base64'))
  );

  let lastTxId = '';
  for (const transaction of txs) {
    transaction.sign([owner]);
    const txId = await connection.sendTransaction(transaction, { skipPreflight: true });
    lastTxId = txId;
    const { lastValidBlockHeight, blockhash } = await connection.getLatestBlockhash({ commitment: 'finalized' });
    await connection.confirmTransaction({ blockhash, lastValidBlockHeight, signature: txId }, 'confirmed');
  }
  if (!lastTxId) throw new Error('Failed to send transaction');
  return lastTxId;
}

async function txSucceeded(signature: string): Promise<boolean> {
  try {
    const res = await getConnection().getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });
    if (!res) return false;
    return !res.meta?.err;
  } catch {
    return false;
  }
}

/** Buy `amountInLamports` worth of SOL into `tokenAddress`. Returns swap compute. */
export async function raydiumBuy(
  owner: Keypair,
  tokenAddress: string,
  amountInLamports: number
): Promise<RaydiumSwapCompute> {
  let priorityFee = await getRaydiumPriorityFee();
  let retry = 0;
  const MAX = 1;
  while (retry <= MAX) {
    try {
      const { txId, swapResponse } = await buyToken(owner, tokenAddress, amountInLamports, 10, priorityFee);
      if (await txSucceeded(txId)) return swapResponse;
      retry++;
    } catch (e) {
      if (e instanceof Error && e.message.includes('TransactionExpiredBlockheightExceededError')) {
        priorityFee = 2500000;
      }
      retry++;
    }
  }
  throw new Error('Raydium buy failed after retries');
}

/** Sell `amountInLamports` (SOL-out base) of `tokenAddress`. Returns txId. */
export async function raydiumSell(
  owner: Keypair,
  tokenAddress: string,
  amountInLamports: number
): Promise<string> {
  let priorityFee = await getRaydiumPriorityFee();
  let retry = 0;
  const MAX = 2;
  while (retry <= MAX) {
    try {
      const txId = await sellToken(owner, tokenAddress, amountInLamports, 10, priorityFee);
      if (await txSucceeded(txId)) return txId;
      retry++;
    } catch (e) {
      if (e instanceof LiquidErrorRaydium) throw e;
      if (e instanceof Error && e.message.includes('TransactionExpiredBlockheightExceededError')) {
        priorityFee = 2500000;
        retry++;
        continue;
      }
      retry++;
    }
  }
  throw new Error('Raydium sell failed after retries');
}
