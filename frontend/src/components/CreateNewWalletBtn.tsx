import { useEffect, useState } from 'react';
import { saveWallet, getWallet, deleteWallet } from '@/api/wallet-api';

export default function WalletGenerator() {
  const [secret, setSecret] = useState('');
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getWallet()
      .then((w) => setPublicKey(w?.publicKey ?? null))
      .catch(() => setPublicKey(null));
  }, []);

  const handleSave = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await saveWallet(secret.trim());
      setPublicKey(res.publicKey);
      setSecret(''); // never keep the secret in memory longer than needed
      setMessage('✅ Кошелёк сохранён');
    } catch (e: any) {
      setMessage(`❌ ${e?.response?.data?.message || 'Ошибка сохранения кошелька'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await deleteWallet();
      setPublicKey(null);
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

      <label className="block text-sm font-medium mb-1">
        Приватный ключ (массив байт через запятую или base58)
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
