
import { SwapResponse } from '@/types/swap-response';
import { Connection, Keypair, PublicKey, VersionedTransaction, Transaction } from '@solana/web3.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// --- Настройка ключей и соединения ---
/*const privateKeyArray = new Uint8Array(
  process.env.VITE_PRIVATE_KEY!.split(',').map(Number)
); */

const privateKeyArray = new Uint8Array([108, 251, 143, 173, 213, 5, 198, 239, 70, 98, 23, 59, 116, 242, 200, 81, 182, 96, 103, 28, 238, 183, 202, 103, 181, 160, 113, 99, 206, 94, 193, 171, 255, 133, 65, 216, 172, 95, 54, 97, 208, 233, 124, 62, 135, 189, 108, 192, 229, 58, 74, 251, 237, 215, 167, 204, 33, 242, 159, 149, 187, 245, 130, 187]);
export const owner: Keypair = Keypair.fromSecretKey(privateKeyArray);
//const QUICKNODE_ENDPOINT = process.env.VITE_QUICKNODE_ENDPOINT!;
const QUICKNODE_ENDPOINT = "https://stylish-falling-glade.solana-mainnet.quiknode.pro/01796c91dbb4b4e0a971e5fe3457980aed1ac4b9";

export const connection = new Connection(QUICKNODE_ENDPOINT);

// --- Константы ---
const SWAP_API_URL = 'https://swap-v2.solanatracker.io/swap';
const SOL_MINT = 'So11111111111111111111111111111111111111112';



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
        throw new Error(`Transaction failed: ${JSON.stringify(txResult.meta.err, null, 2)}`);
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
export const apiPumpfunSwapToken = async (
    tokenAddress: PublicKey,
    amount: number,
    direction: 'buy' | 'sell',
    maxRetries = 3
): Promise<SwapResponse> => {
    let retryCount = 0;
    let priorityFee = 0.00004;

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
    const tokenPubkey = new PublicKey('YrJEAT1TyQfDvaY1SmBWWHLAethSp8bbQjoRJccpump');

    // Купить токен на 0.001 SOL
    await apiPumpfunSwapToken(tokenPubkey, 0.00003, 'buy');

    // Продать 10 токенов
    // await apiPumpfunSwapToken(tokenPubkey, 10, 'sell');
};

example();

