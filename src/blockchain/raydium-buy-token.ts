import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import axios from 'axios';
import { API_URLS } from '@raydium-io/raydium-sdk-v2';
import { SwapCompute } from '@/types/swap-compute';
 

const privateKeyArray = new Uint8Array(
  import.meta.env.VITE_PRIVATE_KEY.split(',').map(Number)
);
export const owner: Keypair = Keypair.fromSecretKey(privateKeyArray);
export const connection = new Connection('https://stylish-falling-glade.solana-mainnet.quiknode.pro/01796c91dbb4b4e0a971e5fe3457980aed1ac4b9');

 

  const buyToken = async (
    outputMint: string,
    amount: number,
    slippage: number,
    priorityFee: number // Принимаем priorityFee как параметр
  ): Promise<{ txId: string; swapResponse: SwapCompute }> => {
    const inputMint = 'So11111111111111111111111111111111111111112'; // SOL
    const txVersion = 'V0';
    const isInputSol = true; // Входной токен — SOL
    const isOutputSol = false; // Выходной токен — не SOL
    const isV0Tx = true;

  const { data: swapResponse } = await axios.get<SwapCompute>(
    `${API_URLS.SWAP_HOST}/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippage * 100}&txVersion=${txVersion}`
  );

  console.log('Swap Response:', swapResponse);

  const { data: swapTransactions } = await axios.post<{
    id: string;
    version: string;
    success: boolean;
    data: { transaction: string }[];
  }>(`${API_URLS.SWAP_HOST}/transaction/swap-base-in`, {
    computeUnitPriceMicroLamports: String(priorityFee),
    swapResponse,
    txVersion,
    wallet: owner.publicKey.toBase58(),
    wrapSol: isInputSol,
    unwrapSol: isOutputSol,
  });

  if (!swapTransactions.data) {
    console.error('Invalid response format:', swapTransactions);
    throw new Error("Invalid response format");
  }

  const allTxBuf = swapTransactions.data.map((tx) => Buffer.from(tx.transaction, 'base64'));
  const allTransactions = allTxBuf.map((txBuf) =>
    isV0Tx ? VersionedTransaction.deserialize(txBuf) : Transaction.from(txBuf)
  );

  let lastTxId = '';
  for (const tx of allTransactions) {
    const transaction = tx as VersionedTransaction;
    transaction.sign([owner]);
    const txId = await connection.sendTransaction(transaction, { skipPreflight: true });
    lastTxId = txId;

    const { lastValidBlockHeight, blockhash } = await connection.getLatestBlockhash({
      commitment: 'finalized',
    });

    await connection.confirmTransaction(
      {
        blockhash,
        lastValidBlockHeight,
        signature: txId,
      },
      'confirmed'
    );
  }

  return { txId: lastTxId, swapResponse };
};

const checkTransactionStatus = async (signature: string): Promise<boolean> => {
  try {
    const response = await connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!response) {
      console.log("Транзакция не найдена или не подтверждена.");
      return false;
    }

    if (response.meta?.err) {
      console.log("❌ Транзакция завершилась с ошибкой:", response.meta.err);
      return false;
    } else {
      console.log("✅ Транзакция успешна.");
      // Проверяем, есть ли токен в soldTokens
   
      return true; // Транзакция успешна, и токен не продан ранее
    }
  } catch (error) {
    console.error("Ошибка при проверке статуса транзакции:", error);
    return false;
  }
};

export const apibuyToken = async (tokenAddress: PublicKey, tokenAmount: number): Promise<SwapCompute> => {
  const MAX_RETRIES = 1; // Максимальное количество попыток
  let retryCount = 0;

  // Получаем начальное значение комиссии из API
  const { data } = await axios.get<{
    id: string;
    success: boolean;
    data: { default: { vh: number; h: number; m: number } };
  }>(`${API_URLS.BASE_HOST}${API_URLS.PRIORITY_FEE}`);

  let priorityFee = data.data.default.h; // Начальное значение комиссии из API

  while (retryCount <= MAX_RETRIES) {
    try {
      const outputMint = tokenAddress.toBase58();
      const amount = tokenAmount;
      const slippage = 10;

      console.log('Buying Token for SOL...');
      const { txId, swapResponse } = await buyToken(outputMint, amount, slippage, priorityFee);

      // Проверяем статус транзакции
      const isTransactionSuccessful = await checkTransactionStatus(txId);

      if (isTransactionSuccessful) {
        console.log('✅ Покупка успешно завершена.');
        return swapResponse;
      } else {
        console.log(`Попытка ${retryCount + 1} неудачна. Повторяем...`);
        retryCount++;
      }
    } catch (error) {
      console.error('Ошибка при покупке:', error);

      // Если ошибка связана с истечением времени транзакции
      if (error instanceof Error && error.message.includes("TransactionExpiredBlockheightExceededError")) {
        console.log("❌ Транзакция истекла, увеличиваем priorityFee и повторяем попытку...");
        priorityFee = 2500000; // Увеличиваем комиссию до 2,500,000 лампортов
        retryCount++;
        continue;
      }

      // Для других ошибок увеличиваем счетчик попыток
      retryCount++;
    }
  }

  throw new Error("Не удалось выполнить покупку после максимального количества попыток");
  
};
  //apibuyToken( new PublicKey('4MpXgiYj9nEvN1xZYZ4qgB6zq5r2JMRy54WaQu5fpump'), 20000)
