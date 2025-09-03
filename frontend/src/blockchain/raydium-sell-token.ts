import { Connection, Keypair, VersionedTransaction, PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import axios from 'axios';
import { API_URLS } from '@raydium-io/raydium-sdk-v2';
 

const privateKeyArray = new Uint8Array(
  import.meta.env.VITE_PRIVATE_KEY.split(',').map(Number)
);
export const owner: Keypair = Keypair.fromSecretKey(privateKeyArray);
const QUICKNODE_ENDPOINT = import.meta.env.VITE_QUICKNODE_ENDPOINT;
export const connection = new Connection(QUICKNODE_ENDPOINT);


interface SwapResponse {
  id: string;
  success: boolean;
  version: string;
  msg?: string;
  data?: any; // если есть поле data — можно уточнить
}


/**
 * Функция для продажи токена на SOL
 * @param inputMint - Адрес токена, который продаётся
 * @param amount - Количество токенов для продажи (в минимальных единицах)
 * @param slippage - Процент slippage
 */
export class LiquidErrorRaydium extends Error {
  id: string;
  success: boolean;
  version: string;
  msg: string;

  constructor(id: string, success: boolean, version: string, msg: string) {
    super(msg); // Вызов конструктора родительского класса Error
    this.id = id;
    this.success = success;
    this.version = version;
    this.msg = msg;
  }
}
  /**
   * vh: very high
   * h: high
   * m: medium
   */
 
  const sellToken = async (
    inputMint: string,
    amount: number,
    slippage: number,
    priorityFee: number // Принимаем priorityFee как параметр
  ): Promise<string> => {
    const outputMint = 'So11111111111111111111111111111111111111112'; // SOL
    const txVersion = 'V0';
    const isInputSol = false; // Входной токен — не SOL
    const isOutputSol = true; // Выходной токен — SOL
    const isV0Tx = true;

  // Получаем адреса токен-аккаунтов
  const inputTokenAcc = await getAssociatedTokenAddress(
    new PublicKey(inputMint),
    owner.publicKey
  );
  const outputTokenAcc = await getAssociatedTokenAddress(
    new PublicKey(outputMint),
    owner.publicKey
  );

  console.log('Input Token Account:', inputTokenAcc.toBase58());
  console.log('Output Token Account:', outputTokenAcc.toBase58());

  // Получаем данные для обмена
  const { data: swapResponse } = await axios.get<SwapResponse>(
    `${API_URLS.SWAP_HOST}/compute/swap-base-out?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippage * 100}&txVersion=${txVersion}`
  );

  console.log('Swap Response:', swapResponse);

  // Проверяем, есть ли ошибка в ответе
  if (!swapResponse.success) {
    if (swapResponse.msg && swapResponse.msg.includes("INSUFFICIENT_LIQUIDITY")) {
      console.log("❌ Недостаточно ликвидности, прекращаем попытки продажи.");
      throw new LiquidErrorRaydium(swapResponse.id, swapResponse.success, swapResponse.version, swapResponse.msg);
    } else {
      console.error("Ошибка в swapResponse:", swapResponse.msg);
      throw new Error("Ошибка в swapResponse: " + swapResponse.msg);
    }
  }

  // Получаем транзакции для обмена
  const { data: swapTransactions } = await axios.post<{
    id: string;
    version: string;
    success: boolean;
    data: { transaction: string }[];
  }>(
    `${API_URLS.SWAP_HOST}/transaction/swap-base-out`,
    {
      computeUnitPriceMicroLamports: String(priorityFee),
      swapResponse,
      txVersion,
      wallet: owner.publicKey.toBase58(),
      wrapSol: isInputSol,
      unwrapSol: isOutputSol,
      inputAccount: inputTokenAcc.toBase58(),
      outputAccount: outputTokenAcc.toBase58(),
    }
  );

  console.log('Swap Transactions Response:', swapTransactions);

  if (!swapTransactions.data) {
    console.error('Invalid response format:', swapTransactions);
    throw new Error("Invalid response format"); // Выбрасываем ошибку, если данные отсутствуют
  }

  // Десериализуем транзакции
  const allTxBuf = swapTransactions.data.map((tx: { transaction: string }) => Buffer.from(tx.transaction, 'base64'));
  const allTransactions = allTxBuf.map((txBuf: Buffer) =>
    isV0Tx ? VersionedTransaction.deserialize(txBuf) : Transaction.from(txBuf)
  );

  // Отправляем транзакции
  let lastTxId = '';

  for (const tx of allTransactions) {
    const transaction = tx as VersionedTransaction;
    transaction.sign([owner]);
    const txId = await connection.sendTransaction(transaction, { skipPreflight: true });
    lastTxId = txId; // Сохраняем txId последней транзакции

    const { lastValidBlockHeight, blockhash } = await connection.getLatestBlockhash({
      commitment: 'finalized',
    });

    console.log(`Transaction sending..., txId: ${txId}`);
    await connection.confirmTransaction(
      {
        blockhash,
        lastValidBlockHeight,
        signature: txId,
      },
      'confirmed'
    );
    console.log(`Transaction confirmed`);
  }

  if (!lastTxId) {
    throw new Error("Не удалось отправить транзакцию"); // Выбрасываем ошибку, если txId отсутствует
  }

  return lastTxId; // Возвращаем txId
};

const checkTransactionStatus = async (signature: string): Promise<boolean> => {
  try {
    const response = await connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0, // Указываем поддержку версии 0
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
      return true;
    }
  } catch (error) {
    console.error("Ошибка при проверке статуса транзакции:", error);
    return false;
  }
};

export const apiSellToken = async (tokenAddress: string, amountInLamports: number): Promise<void> => {
  const MAX_RETRIES = 2; // Максимальное количество попыток
  let retryCount = 0;

  // Получаем начальное значение комиссии из API
  const { data } = await axios.get<{
    id: string;
    success: boolean;
    data: { default: { vh: number; h: number; m: number } };
  }>(`${API_URLS.BASE_HOST}${API_URLS.PRIORITY_FEE}`);

  let priorityFee = data.data.default.vh; // Начальное значение комиссии из API

  while (retryCount <= MAX_RETRIES) { // Цикл попыток
    try {
      const slippage = 10; // Slippage в процентах

      console.log('Selling Token for SOL...');
      const txId = await sellToken(tokenAddress, amountInLamports, slippage, priorityFee);

      // Проверяем статус транзакции
      const isTransactionSuccessful = await checkTransactionStatus(txId);

      if (isTransactionSuccessful) {
        console.log('✅ Продажа успешно завершена.');
        return; // Выходим, если транзакция успешна
      } else {
        console.log(`Попытка ${retryCount + 1} неудачна. Повторяем...`);
        retryCount++; // Увеличиваем счетчик попыток
      }
    } catch (error) {
      console.error('Ошибка при продаже:', error);

      // Если ошибка связана с недостатком ликвидности, прекращаем попытки
      if (error instanceof LiquidErrorRaydium && error.msg.includes("INSUFFICIENT_LIQUIDITY")) {
        console.log("❌ Недостаточно ликвидности, прекращаем попытки продажи.");
        throw error; // Пробрасываем ошибку, чтобы удалить токен
      }

      // Если ошибка связана с истечением времени транзакции
      if (error instanceof Error && error.message.includes("TransactionExpiredBlockheightExceededError")) {
        console.log("❌ Транзакция истекла, увеличиваем priorityFee и повторяем попытку...");
        priorityFee = 2500000; // Увеличиваем комиссию до 2,500,000 лампортов
        retryCount++; // Увеличиваем счетчик попыток
        continue;
      }

      // Для других ошибок увеличиваем счетчик попыток
      retryCount++;
    }
  }

  // Если все попытки исчерпаны, выбрасываем ошибку
  throw new Error("Не удалось выполнить продажу после максимального количества попыток");
};

  //apiSellToken('K72GZwe5MmX7WtqGRrP4wKYQkFEfhkbpkH6fnGGpump', 28000000)