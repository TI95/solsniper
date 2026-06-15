import { Keypair, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import axios from 'axios';
import { getConnection } from './connection';
import { SOL_MINT } from '../config/trading-config';

interface SwapResponse {
  txn: string;
  type: 'v0' | 'legacy';
}

const SWAP_API_URL = 'https://swap-v2.solanatracker.io/swap';

async function confirm(signature: string): Promise<void> {
  const connection = getConnection();
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
  const res = await connection.getTransaction(signature, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  });
  if (res?.meta?.err) throw new Error(`Transaction failed: ${JSON.stringify(res.meta.err)}`);
}

async function swap(
  owner: Keypair,
  outputMint: string,
  amount: number,
  slippage: number,
  priorityFee: number,
  inputMint: string
): Promise<string> {
  const connection = getConnection();
  const { data: swapResponse } = await axios.post<SwapResponse>(SWAP_API_URL, {
    from: inputMint,
    to: outputMint,
    amount,
    slippage,
    payer: owner.publicKey.toBase58(),
    priorityFee,
    feeType: 'add',
  });

  const serialized = Buffer.from(swapResponse.txn, 'base64');
  let txId: string;
  if (swapResponse.type === 'v0') {
    const transaction = VersionedTransaction.deserialize(serialized);
    transaction.sign([owner]);
    txId = await connection.sendTransaction(transaction, { skipPreflight: true });
  } else {
    const transaction = Transaction.from(serialized);
    transaction.sign(owner);
    txId = await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: true });
  }
  await confirm(txId);
  return txId;
}

/** Buy (spend `amount` SOL) or sell (spend `amount` tokens) via solanatracker. Returns txId. */
export async function pumpfunSwap(
  owner: Keypair,
  tokenAddress: string,
  amount: number,
  direction: 'buy' | 'sell',
  maxRetries = 3
): Promise<string> {
  let retry = 0;
  let priorityFee = 0.000005;
  while (retry < maxRetries) {
    try {
      const isBuy = direction === 'buy';
      const inputMint = isBuy ? SOL_MINT : tokenAddress;
      const outputMint = isBuy ? tokenAddress : SOL_MINT;
      return await swap(owner, outputMint, amount, 10, priorityFee, inputMint);
    } catch (e) {
      console.error(`pumpfun ${direction} attempt ${retry + 1} failed:`, e);
      priorityFee *= 2;
      retry++;
      if (retry >= maxRetries) throw new Error(`pumpfun ${direction} failed after ${maxRetries} attempts`);
    }
  }
  throw new Error('Unexpected error in pumpfunSwap');
}

export { PublicKey };
