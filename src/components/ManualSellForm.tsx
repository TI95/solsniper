import { apiSellToken } from '@/blockchain/raydium-sell-token';
import React, { useState } from 'react';

const SellTokenForm: React.FC = () => {
  const [tokenAddress, setTokenAddress] = useState('');
  const [amountSol, setAmountSol] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultMessage, setResultMessage] = useState('');

  const handleSell = async () => {
    setLoading(true);
    setResultMessage('');
    try {
      const solAmount = parseFloat(amountSol);
      if (!tokenAddress || isNaN(solAmount) || solAmount <= 0) {
        setResultMessage('❌ Введите корректный адрес токена и количество в SOL.');
        setLoading(false);
        return;
      }

      const lamportsAmount = Math.round(solAmount * 1_000_000_000); // 1 SOL = 1_000_000_000 lamports

      await apiSellToken(tokenAddress, lamportsAmount);
      setResultMessage('✅ Продажа успешно завершена.');
    } catch (error: any) {
      setResultMessage(`❌ Ошибка при продаже: ${error.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-2xl shadow-lg">
      <h2 className="text-xl font-bold mb-4">Продажа токена</h2>
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
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Количество (в SOL)</label>
        <input
          type="number"
          value={amountSol}
          onChange={(e) => setAmountSol(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-3 py-2"
          placeholder="Например: 0.01"
          step="0.000000001"
        />
      </div>
      <button
        onClick={handleSell}
        disabled={loading}
        className="w-full bg-blue-600 text-white font-semibold py-2 rounded-xl hover:bg-blue-700 transition"
      >
        {loading ? 'Обработка...' : 'Продать'}
      </button>
      {resultMessage && (
        <p className="mt-4 text-sm text-center text-gray-800">{resultMessage}</p>
      )}
    </div>
  );
};

export default SellTokenForm;
