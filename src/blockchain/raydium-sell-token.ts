import { Connection, Keypair, VersionedTransaction, PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import axios from 'axios';
import { API_URLS } from '@raydium-io/raydium-sdk-v2';

const privateKeyArray = new Uint8Array([
  138, 26, 252, 178, 76, 60, 179, 129, 41, 151, 195, 21, 198, 136,
  81, 14, 144, 224, 113, 228, 245, 9, 246, 144, 112, 184, 205, 96,
  243, 182, 14, 97, 129, 53, 227, 124, 22, 66, 149, 89, 3, 214, 87,
  215, 109, 41, 164, 54, 130, 181, 44, 210, 253, 86, 136, 168, 200,
  200, 114, 48, 137, 204, 148, 218,
]);
export const owner: Keypair = Keypair.fromSecretKey(privateKeyArray);
export const connection = new Connection('https://stylish-falling-glade.solana-mainnet.quiknode.pro/01796c91dbb4b4e0a971e5fe3457980aed1ac4b9');

/**
 * Функция для продажи токена на SOL
 * @param inputMint - Адрес токена, который продаётся
 * @param amount - Количество токенов для продажи (в минимальных единицах)
 * @param slippage - Процент slippage
 */
const sellToken = async (inputMint: string, amount: number, slippage: number) => {
  const priorityFee = 1500000;
  const outputMint = 'So11111111111111111111111111111111111111112'; // SOL
  const txVersion = 'V0';
  const isInputSol = false; // Входной токен — не SOL
  const isOutputSol = true; // Выходной токен — SOL
  const isV0Tx = true;

       // get statistical transaction fee from API
  /**
   * vh: very high
   * h: high
   * m: medium
   */
  /////////////////////////////////////////////////////////////
  const { data } = await axios.get<{
    id: string
    success: boolean
    data: { default: { vh: number; h: number; m: number } }
  }>(`${API_URLS.BASE_HOST}${API_URLS.PRIORITY_FEE}`)
///////////////////////////////////////////////////////////////

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
  const { data: swapResponse } = await axios.get(
    `${API_URLS.SWAP_HOST}/compute/swap-base-out?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippage * 100}&txVersion=${txVersion}`
  );

  console.log('Swap Response:', swapResponse);

  // Получаем транзакции для обмена
  const { data: swapTransactions } = await axios.post<{
    id: string;
    version: string;
    success: boolean;
    data: { transaction: string }[];
  }>(
    `${API_URLS.SWAP_HOST}/transaction/swap-base-out`,
    {
      //computeUnitPriceMicroLamports: String(data.data.default.h),
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
    return;
  }

  // Десериализуем транзакции
  const allTxBuf = swapTransactions.data.map((tx: { transaction: string }) => Buffer.from(tx.transaction, 'base64'));
  const allTransactions = allTxBuf.map((txBuf: Buffer) =>
    isV0Tx ? VersionedTransaction.deserialize(txBuf) : Transaction.from(txBuf)
  );

  console.log(`Total ${allTransactions.length} transactions`, swapTransactions);

  // Отправляем транзакции
  for (const tx of allTransactions) {
    const transaction = tx as VersionedTransaction;
    transaction.sign([owner]);
    const txId = await connection.sendTransaction(transaction, { skipPreflight: true });
    const { lastValidBlockHeight, blockhash } = await connection.getLatestBlockhash({
      commitment: 'finalized',
    });

    console.log(`Transaction sending..., txId: ${txId}`);

    // Ждем подтверждения транзакции
    const confirmation = await connection.confirmTransaction(
      {
        blockhash,
        lastValidBlockHeight,
        signature: txId,
      },
      'confirmed'
    );

    if (confirmation.value.err) {
      console.error(`❌ Транзакция ${txId} не удалась:`, confirmation.value.err);
      throw new Error("Транзакция не удалась");
    } else {
      console.log(`✅ Транзакция ${txId} успешно подтверждена`);
    }
  }
};



  export const apiSellToken = async (tokenAddress: string, amountInLamports: number) => {
    try {
      const slippage = 10; // Slippage в процентах
  
      console.log('Selling Token for SOL...');
      await sellToken(tokenAddress, amountInLamports, slippage);
    } catch (error) {
      console.error('Error during sell:', error);
      throw error; // Пробрасываем ошибку, чтобы обработать её в useAutoTrade
    }
  };