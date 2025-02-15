import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
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

interface SwapCompute {
    id: string;
    success: true;
    version: 'V0' | 'V1';
    openTime?: undefined;
    msg: undefined;
    data: {
        swapType: 'BaseIn' | 'BaseOut';
        inputMint: string;
        inputAmount: string;
        outputMint: string;
        outputAmount: string;
        otherAmountThreshold: string;
        slippageBps: number;
        priceImpactPct: number;
        routePlan: {
            poolId: string;
            inputMint: string;
            outputMint: string;
            feeMint: string;
            feeRate: number;
            feeAmount: string;
        }[];
    };
}

/**
 * Функция для продажи токена на SOL
 * @param outputMint - Адрес токена, который покупается
 * @param amount - Количество токенов для продажи (в минимальных единицах)
 * @param slippage - Процент slippage
 */
const buyToken = async (outputMint: string, amount: number, slippage: number): Promise<SwapCompute> => {
    const priorityFee = 1300000;
    const inputMint = 'So11111111111111111111111111111111111111112'; // SOL
    const txVersion = 'V0';
    const isInputSol = true; // Входной токен — SOL
    const isOutputSol = false; // Выходной токен — не SOL
    const isV0Tx = true;
  
    // Получаем данные для обмена (используем swap-base-in)
    const { data: swapResponse } = await axios.get<SwapCompute>(
      `${API_URLS.SWAP_HOST}/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippage * 100}&txVersion=${txVersion}`
    );
  
    console.log('Swap Response:', swapResponse);
  
    // Получаем транзакции для обмена
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
  
    //console.log('Swap Transactions Response:', swapTransactions);
  
    if (!swapTransactions.data) {
      console.error('Invalid response format:', swapTransactions);
      throw new Error("Invalid response format");
    }
  
    // Десериализуем транзакции
    const allTxBuf = swapTransactions.data.map((tx) => Buffer.from(tx.transaction, 'base64'));
    const allTransactions = allTxBuf.map((txBuf) =>
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
  
    return swapResponse; // Возвращаем swapResponse типа SwapCompute
  };



  export const apibuyToken = async (tokenAddress: PublicKey, tokenAmount: number): Promise<SwapCompute> => {
    try {
      const outputMint = tokenAddress.toBase58(); // Токен, который покупается
      const amount = tokenAmount; // Количество токенов для покупки (в наименьших единицах)
      const slippage = 10; // Slippage в процентах
  
      console.log('Buying Token for SOL...');
      const buyResponse = await buyToken(outputMint, amount, slippage);
      return buyResponse; // Возвращаем ответ от buyToken
    } catch (error) {
      console.error('Error during buy:', error);
      throw error; // Пробрасываем ошибку, чтобы обработать её в useAutoTrade
    }
  };

  //apibuyToken( new PublicKey('GL8DFZXKhfmoKf3gAQhv5wAkzKFYSBMYgz9wfT5wpump'), 20000)
