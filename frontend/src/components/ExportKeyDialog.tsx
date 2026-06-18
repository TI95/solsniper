import { useState } from 'react';
import { exportSecret } from '@/api/wallet-api';

export default function ExportKeyDialog() {
  const [password, setPassword] = useState('');
  const [secretKey, setSecretKey] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await exportSecret(password);
      setSecretKey(res.secretKey);
      setPassword(''); // re-auth secret: drop it immediately
    } catch (e: any) {
      setMessage(`❌ ${e?.response?.data?.message || 'Ошибка экспорта'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (secretKey) {
      await navigator.clipboard.writeText(secretKey);
      setMessage('Скопировано');
    }
  };

  const hide = () => {
    setSecretKey(null);
    setMessage('');
  };

  return (
    <div className="p-4 max-w-md">
      <h2 className="text-lg font-bold mb-2">Экспорт приватного ключа</h2>

      {secretKey ? (
        <div>
          <p className="text-sm text-red-600 mb-2">
            ⚠️ Никому не показывайте этот ключ. Любой, кто его получит, контролирует кошелёк.
          </p>
          <p className="break-all border border-gray-300 rounded-xl px-3 py-2 bg-gray-50">
            {secretKey}
          </p>
          <div className="mt-2 flex gap-2">
            <button onClick={handleCopy} className="px-3 py-1 bg-blue-600 text-white rounded-lg">
              Скопировать
            </button>
            <button onClick={hide} className="px-3 py-1 bg-gray-300 rounded-lg">
              Скрыть
            </button>
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium mb-1">Пароль аккаунта</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 mb-2"
            placeholder="Подтвердите паролем"
          />
          <button
            onClick={handleExport}
            disabled={loading || password.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? 'Проверка...' : 'Показать ключ'}
          </button>
        </div>
      )}

      {message && <p className="mt-3 text-sm">{message}</p>}
    </div>
  );
}
