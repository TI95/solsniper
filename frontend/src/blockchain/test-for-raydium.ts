import { Connection, Keypair, PublicKey, VersionedTransaction, Transaction } from '@solana/web3.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// --- Настройка ключей и соединения ---
const privateKeyString = process.env.VITE_PRIVATE_KEY;
if (!privateKeyString) throw new Error('VITE_PRIVATE_KEY is not defined');

const privateKeyArray = new Uint8Array(privateKeyString.split(',').map(Number));
export const owner = Keypair.fromSecretKey(privateKeyArray);

export const QUICKNODE_ENDPOINT = process.env.VITE_QUICKNODE_ENDPOINT!;
export const connection = new Connection(QUICKNODE_ENDPOINT, 'confirmed');

// --- Константы ---
const SWAP_API_URL = 'https://swap-v2.solanatracker.io/swap';
const SOL_MINT = 'So11111111111111111111111111111111111111112';

// --- Типы ---
interface SwapResponse {
  txn: string;
  rate: {
    amountIn: number;
    amountOut: number;
    minAmountOut: number;
    currentPrice: number;
    executionPrice: number;
    priceImpact: number;
    fee: number;
    baseCurrency: {
      mint: string;
      decimals: number;
    };
    quoteCurrency: {
      mint: string;
      decimals: number;
    };
    platformFee: number;
    platformFeeUI: number;
  };
  timeTaken: number;
  type: 'legacy' | 'v0';
}

// --- Функция отправки и подтверждения транзакции ---
const confirmTransaction = async (signature: string) => {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

  await connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight,
  }, 'confirmed');

  const txResult = await connection.getTransaction(signature, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  });

  if (txResult?.meta?.err) {
    throw new Error(`Transaction failed: ${txResult.meta.err}`);
  }

  console.log('✅ Transaction confirmed successfully');
};

// --- Отправка swap-запроса ---
export const swapToken = async (
  outputMint: string,
  amount: number,
  slippage: number,
  priorityFee: number,
  inputMint = SOL_MINT
): Promise<{ txId: string; swapResponse: SwapResponse }> => {
  try {
    const { data: swapResponse } = await axios.post<SwapResponse>(SWAP_API_URL, {
      from: inputMint,
      to: outputMint,
      amount,
      slippage,
      payer: owner.publicKey.toBase58(),
      priorityFee,
      feeType: 'add',
    });

    console.log('Swap Response:', swapResponse);

    const serializedTransaction = Buffer.from(swapResponse.txn, 'base64');
    let transaction: VersionedTransaction | Transaction;

    if (swapResponse.type === 'v0') {
      transaction = VersionedTransaction.deserialize(serializedTransaction);
    } else {
      transaction = Transaction.from(serializedTransaction);
    }

    let txId: string;
    if (transaction instanceof VersionedTransaction) {
      transaction.sign([owner]);
      txId = await connection.sendTransaction(transaction, { skipPreflight: true });
    } else {
      transaction.sign(owner);
      txId = await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: true });
    }

    console.log('Transaction sent:', txId);
    await confirmTransaction(txId);
    return { txId, swapResponse };
  } catch (error) {
    console.error('Error in swapToken:', error);
    throw error;
  }
};

// --- Универсальная функция покупки/продажи ---
export const apiSwapToken = async (
  tokenAddress: PublicKey,
  amount: number,
  direction: 'buy' | 'sell',
  maxRetries = 3
): Promise<SwapResponse> => {
  let retryCount = 0;
  let priorityFee = 0.000005;

  while (retryCount < maxRetries) {
    try {
      console.log(`Attempt ${retryCount + 1} to ${direction} token...`);

      const isBuying = direction === 'buy';
      const inputMint = isBuying ? SOL_MINT : tokenAddress.toBase58();
      const outputMint = isBuying ? tokenAddress.toBase58() : SOL_MINT;

      const { txId, swapResponse } = await swapToken(
        outputMint,
        amount,
        10,
        priorityFee,
        inputMint
      );

      console.log(`✅ ${direction.toUpperCase()} transaction successful:`, txId);
      return swapResponse;

    } catch (error) {
      console.error(`Attempt ${retryCount + 1} failed:`, error);

      priorityFee *= 2;
      retryCount++;

      if (retryCount >= maxRetries) {
        throw new Error(`Failed to ${direction} token after ${maxRetries} attempts`);
      }

      console.log(`Retrying with increased priority fee: ${priorityFee} SOL...`);
    }
  }

  throw new Error('Unexpected error in apiSwapToken');
};

// --- Пример использования ---
const example = async () => {
  const tokenPubkey = new PublicKey('LZboYF8CPRYiswZFLSQusXEaMMwMxuSA5VtjGPtpump');

  // Купить токен на 0.001 SOL
  await apiSwapToken(tokenPubkey, 150, 'sell');

  // Продать 10 токенов
  // await apiSwapToken(tokenPubkey, 10, 'sell');
};

// example();
