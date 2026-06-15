import React, { useState } from 'react';
import { manualSell } from '@/api/wallet-api';
 

const SellTokenForm: React.FC = () => {
  const [platform, setPlatform] = useState<'raydium' | 'pumpfun'>('raydium');
  const [tokenAddress, setTokenAddress] = useState('');
  const [amount, setAmount] = useState(''); // универсальное поле
  const [loading, setLoading] = useState(false);
  const [resultMessage, setResultMessage] = useState('');

  const handleSell = async () => {
    setLoading(true);
    setResultMessage('');
    try {
      if (!tokenAddress) {
        setResultMessage('❌ Введите корректный адрес токена.');
        setLoading(false);
        return;
      }
      const numeric =
        platform === 'raydium' ? parseFloat(amount.replace(',', '.')) : parseInt(amount, 10);
      if (isNaN(numeric) || numeric <= 0) {
        setResultMessage(
          platform === 'raydium' ? '❌ Введите количество в SOL.' : '❌ Введите количество токенов.'
        );
        setLoading(false);
        return;
      }
      const res = await manualSell(tokenAddress, numeric, platform);
      setResultMessage(`✅ Продажа отправлена. txId: ${res.txId}`);
    } catch (error: any) {
      setResultMessage(`❌ Ошибка при продаже: ${error?.response?.data?.message || error.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-2xl shadow-lg">
      <h2 className="text-xl font-bold mb-4">Продажа токена в ручную</h2>

      {/* Выбор платформы */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Платформа</label>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as 'raydium' | 'pumpfun')}
          className="w-full border border-gray-300 rounded-xl px-3 py-2"
        >
          <option value="raydium">Raydium</option>
          <option value="pumpfun">Pumpfun</option>
        </select>
      </div>

      {/* Адрес токена */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Адрес токена</label>
        <input
          type="text"
          value={tokenAddress}
          onChange={(e) => setTokenAddress(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-3 py-2"
          placeholder="Введите адрес токена"
        />
      </div>

      {/* Количество */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">
          {platform === 'raydium' ? 'Количество (в SOL)' : 'Количество токенов'}
        </label>
        <input
          type="text"
          value={amount}
          onChange={(e) => {
            const value = e.target.value;
            if (platform === 'raydium') {
              // до 9 знаков после точки
              if (/^\d*\.?\d{0,9}$/.test(value) || value === '') {
                setAmount(value);
              }
            } else {
              // только целые числа
              if (/^\d*$/.test(value) || value === '') {
                setAmount(value);
              }
            }
          }}
          className="w-full border border-gray-300 rounded-xl px-3 py-2"
          placeholder={
            platform === 'raydium' ? 'Например: 0.01' : 'Например: 1000'
          }
        />
      </div>

      {/* Кнопка */}
      <button
        onClick={handleSell}
        disabled={loading}
        className="w-full bg-blue-600 text-white font-semibold py-2 rounded-xl hover:bg-blue-700 transition"
      >
        {loading ? 'Обработка...' : 'Продать'}
      </button>

      {/* Сообщение */}
      {resultMessage && (
        <p className="mt-4 text-sm text-center text-gray-800">{resultMessage}</p>
      )}
    </div>
  );
};

export default SellTokenForm;
