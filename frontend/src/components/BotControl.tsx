import { useEffect, useState } from 'react';
import { getWallet, startBot, stopBot } from '@/api/wallet-api';

export default function BotControl() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getWallet()
      .then((w) => setEnabled(w?.botEnabled ?? false))
      .catch(() => setEnabled(false));
  }, []);

  const toggle = async () => {
    setLoading(true);
    try {
      const res = enabled ? await stopBot() : await startBot();
      setEnabled(res.botEnabled);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (enabled === null) return <p className="p-4">Загрузка состояния бота...</p>;

  return (
    <div className="p-4">
      <p className="mb-2">Бот: <b>{enabled ? 'ВКЛ' : 'ВЫКЛ'}</b></p>
      <button
        onClick={toggle}
        disabled={loading}
        className={`px-4 py-2 rounded-lg text-white ${enabled ? 'bg-red-600' : 'bg-green-600'}`}
      >
        {loading ? '...' : enabled ? 'Остановить бота' : 'Запустить бота'}
      </button>
    </div>
  );
}
