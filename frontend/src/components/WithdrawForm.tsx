import { useState } from 'react';
import { withdrawSol } from '@/api/wallet-api';

export default function WithdrawForm() {
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [max, setMax] = useState(false);
  const [password, setPassword] = useState('');
  const [txId, setTxId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit =
    !loading &&
    password.length > 0 &&
    destination.trim().length > 0 &&
    (max || Number(amount) > 0);

  const handleWithdraw = async () => {
    setLoading(true);
    setMessage('');
    setTxId(null);
    try {
      const amountSol = max ? null : Number(amount);
      const res = await withdrawSol(password, destination.trim(), amountSol, max);
      setTxId(res.txId);
      setPassword(''); // re-auth secret: drop it immediately
      setMessage('✅ Вывод отправлен');
    } catch (e: any) {
      setMessage(`❌ ${e?.response?.data?.message || 'Ошибка вывода'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-md">
      <h2 className="text-lg font-bold mb-2">Вывод SOL</h2>

      <label className="block text-sm font-medium mb-1">Адрес получателя</label>
      <input
        value={destination}
        onChange={(e) => setDestination(e.target.value)}
        className="w-full border border-gray-300 rounded-xl px-3 py-2 mb-2"
        placeholder="Solana-адрес"
      />

      <label className="block text-sm font-medium mb-1">Сумма (SOL)</label>
      <div className="flex items-center gap-2 mb-2">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={max}
          className="flex-1 border border-gray-300 rounded-xl px-3 py-2 disabled:bg-gray-100"
          placeholder="0.0"
        />
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={max} onChange={(e) => setMax(e.target.checked)} />
          Max
        </label>
      </div>

      <label className="block text-sm font-medium mb-1">Пароль аккаунта</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full border border-gray-300 rounded-xl px-3 py-2 mb-2"
        placeholder="Подтвердите паролем"
      />

      <button
        onClick={handleWithdraw}
        disabled={!canSubmit}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
      >
        {loading ? 'Отправка...' : 'Вывести'}
      </button>

      {txId && (
        <p className="mt-3 text-sm break-all">
          Транзакция:{' '}
          <a
            href={`https://solscan.io/tx/${txId}`}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 underline"
          >
            {txId}
          </a>
        </p>
      )}
      {message && <p className="mt-3 text-sm">{message}</p>}
    </div>
  );
}
