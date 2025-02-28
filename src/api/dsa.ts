import { Connection } from '@solana/web3.js';

const connection = new Connection('https://stylish-falling-glade.solana-mainnet.quiknode.pro/01796c91dbb4b4e0a971e5fe3457980aed1ac4b9');

// Адрес программы SPL Token
const SPL_TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

async function findBlocksWithNewTokens() {
  try {
    // Получаем последний слот
    const latestSlot = await connection.getSlot();

    // Получаем блок с поддержкой версии транзакций 0 и разрешением таблиц адресов
    const block = await connection.getBlock(latestSlot, {
      maxSupportedTransactionVersion: 0, // Указываем поддержку версии 0
      transactionDetails: 'full', // Получаем полные детали транзакций
      rewards: false, // Отключаем получение информации о наградах
    });

    if (!block || !block.transactions) {
      console.log('Блок не найден или не содержит транзакций.');
      return;
    }

    // Выводим информацию о блоке
    console.log(`Анализируем блок с хэшем: ${block.blockhash}`);

    // Проходим по всем транзакциям в блоке
    for (const tx of block.transactions) {
      const transaction = tx.transaction;

      // Получаем accountKeys из VersionedMessage
      const accountKeys = transaction.message.getAccountKeys();

      // Получаем инструкции из транзакции
      const instructions = transaction.message.compiledInstructions;

      // Проверяем, содержит ли транзакция инструкцию InitializeMint
      const hasInitializeMint = instructions.some((ix) => {
        const programId = accountKeys.get(ix.programIdIndex);
        return (
          programId?.toBase58() === SPL_TOKEN_PROGRAM_ID &&
          ix.data[0] === 0 // InitializeMint имеет код инструкции 0
        );
      });

      if (hasInitializeMint) {
        console.log('Найдена транзакция с созданием токена:');
        console.log('Signature:', tx.transaction.signatures[0]);
        console.log('Blockhash:', block.blockhash);
        console.log('----------------------------------------');
      }
    }
  } catch (error) {
    console.error('Ошибка при поиске блоков с токенами:', error);
  }
}

// Запуск функции каждую секунду
const interval = setInterval(findBlocksWithNewTokens, 30000);

// Остановка интервала через 10 минут (для примера)
setTimeout(() => {
  clearInterval(interval);
  console.log('Мониторинг остановлен.');
}, 10 * 60 * 1000); // 10 минут