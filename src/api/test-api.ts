import { Connection, ParsedInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

// Подключение к вашему RPC
export const connection = new Connection('https://stylish-falling-glade.solana-mainnet.quiknode.pro/01796c91dbb4b4e0a971e5fe3457980aed1ac4b9', 'confirmed');

// Интерфейс для информации о новом токене
interface NewTokenInfo {
  mintAddress: string;
  decimals: number;
  transactionSignature: string;
}

// Расширенный тип для tx.transaction
interface ExtendedParsedTransaction {
  signatures: string[];
  message: {
    instructions: ParsedInstruction[];
    accountKeys: any[];
  };
}

// Функция для анализа транзакций в блоке на создание новых токенов
async function checkBlockForNewTokens(blockHeight: number): Promise<NewTokenInfo[]> {
  try {
    const block = await connection.getParsedBlock(blockHeight, {
      maxSupportedTransactionVersion: 0,
    });

    if (!block || !block.transactions) {
      console.log(`Блок ${blockHeight} не содержит транзакций`);
      return [];
    }

    const newTokens: NewTokenInfo[] = [];

    for (const tx of block.transactions) {
      if (!tx.meta || tx.meta.err) continue; // Пропускаем, если нет meta или транзакция неуспешна

      const signature = tx.transaction.signatures[0];
      // Приведение через unknown для обхода ошибки типизации
      const transaction = tx.transaction as unknown as ExtendedParsedTransaction;
      const instructions = transaction.message.instructions;

      for (const ix of instructions) {
        if (ix.programId.equals(TOKEN_PROGRAM_ID)) {
          const parsed = ix.parsed;
          if (parsed && parsed.type === 'initializeMint') {
            const mintAddress = parsed.info.mint;
            const decimals = parsed.info.decimals;

            newTokens.push({
              mintAddress,
              decimals,
              transactionSignature: signature,
            });

            console.log(`Найден новый токен: ${mintAddress} (Decimals: ${decimals}) в транзакции ${signature}`);
          }
        }
      }
    }

    return newTokens;
  } catch (error) {
    console.error(`Ошибка при анализе блока ${blockHeight}:`, error);
    return [];
  }
}

// Основная функция для отслеживания новых блоков
async function monitorNewBlocks(): Promise<void> {
  try {
    const initialBlockHeight = await connection.getBlockHeight();
    let lastBlockHeight = initialBlockHeight;
    console.log(`Старт отслеживания с блока: ${lastBlockHeight}`);

    setInterval(async () => {
      try {
        const currentBlockHeight = await connection.getBlockHeight();

        if (currentBlockHeight > lastBlockHeight) {
          console.log(`Обнаружен новый блок: ${currentBlockHeight}`);

          const newTokens = await checkBlockForNewTokens(currentBlockHeight);

          if (newTokens.length > 0) {
            console.log(`В блоке ${currentBlockHeight} создано ${newTokens.length} новых токенов:`);
            newTokens.forEach((token) => {
              console.log(`- Mint: ${token.mintAddress}, Decimals: ${token.decimals}, Транзакция: ${token.transactionSignature}`);
            });
          } else {
            console.log(`В блоке ${currentBlockHeight} новых токенов не создано`);
          }

          lastBlockHeight = currentBlockHeight;
        }
      } catch (error) {
        console.error('Ошибка в интервале:', error);
      }
    }, 2000); // Проверка каждые 2 секунды
  } catch (error) {
    console.error('Ошибка при запуске monitorNewBlocks:', error);
    throw error;
  }
}

// Запуск мониторинга
monitorNewBlocks().catch((err) => console.error('Ошибка при запуске:', err));