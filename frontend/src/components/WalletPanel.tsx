import { useEffect, useState } from 'react';
import {
  saveWallet,
  getWallet,
  deleteWallet,
  generateWallet,
  getBalance,
} from '@/api/wallet-api';

interface Props {
  onWalletChange?: (publicKey: string | null) => void;
}

export default function WalletPanel({ onWalletChange }: Props) {
  const [secret, setSecret] = useState('');
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [balanceSol, setBalanceSol] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const setWallet = (pk: string | null) => {
    setPublicKey(pk);
    onWalletChange?.(pk);
  };

  useEffect(() => {
    getWallet()
      .then((w) => setWallet(w?.publicKey ?? null))
      .catch(() => setWallet(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshBalance = async () => {
    setMessage('');
    try {
      const b = await getBalance();
      setBalanceSol(b.sol);
    } catch (e: any) {
      setMessage(`❌ ${e?.response?.data?.message || 'Не удалось получить баланс'}`);
    }
  };

  // Guard destructive actions if we know the wallet still holds SOL.
  const confirmIfFunded = (action: string) => {
    if (balanceSol && balanceSol > 0) {
      return window.confirm(
        `На кошельке ${balanceSol} SOL. ${action} приведёт к потере доступа к этим средствам. Продолжить?`
      );
    }
    return true;
  };

  const handleGenerate = async () => {
    if (publicKey && !confirmIfFunded('Создание нового кошелька')) return;
    setLoading(true);
    setMessage('');
    try {
      const res = await generateWallet();
      setWallet(res.publicKey);
      setBalanceSol(null);
      setMessage('✅ Новый кошелёк создан');
    } catch (e: any) {
      setMessage(`❌ ${e?.response?.data?.message || 'Ошибка создания кошелька'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (publicKey && !confirmIfFunded('Замена кошелька')) return;
    setLoading(true);
    setMessage('');
    try {
      const res = await saveWallet(secret.trim());
      setWallet(res.publicKey);
      setBalanceSol(null);
      setSecret(''); // never keep the secret in memory longer than needed
      setMessage('✅ Кошелёк сохранён');
    } catch (e: any) {
      setMessage(`❌ ${e?.response?.data?.message || 'Ошибка сохранения кошелька'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmIfFunded('Удаление кошелька')) return;
    setLoading(true);
    setMessage('');
    try {
      await deleteWallet();
      setWallet(null);
      setBalanceSol(null);
      setMessage('Кошелёк удалён');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-md">
      <h2 className="text-lg font-bold mb-2">Кошелёк для торговли</h2>

      {publicKey ? (
        <div className="mb-4">
          <p className="break-all"><b>Public Key:</b> {publicKey}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm">
              <b>Баланс:</b> {balanceSol === null ? '—' : `${balanceSol} SOL`}
            </span>
            <button
              onClick={refreshBalance}
              disabled={loading}
              className="px-2 py-1 text-sm bg-gray-200 rounded-lg"
            >
              Обновить
            </button>
          </div>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="mt-2 px-3 py-1 bg-red-600 text-white rounded-lg"
          >
            Удалить кошелёк
          </button>
        </div>
      ) : (
        <p className="mb-2 text-sm text-gray-600">Кошелёк не привязан.</p>
      )}

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="mb-4 px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50"
      >
        {publicKey ? 'Создать новый кошелёк' : 'Создать кошелёк'}
      </button>

      <label className="block text-sm font-medium mb-1">
        Или вставьте приватный ключ (массив байт через запятую или base58)
      </label>
      <textarea
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        className="w-full border border-gray-300 rounded-xl px-3 py-2"
        rows={3}
        placeholder="Вставьте приватный ключ"
      />
      <button
        onClick={handleSave}
        disabled={loading || !secret.trim()}
        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
      >
        {loading ? 'Сохранение...' : publicKey ? 'Заменить кошелёк' : 'Сохранить кошелёк'}
      </button>

      {message && <p className="mt-3 text-sm">{message}</p>}
    </div>
  );
}
