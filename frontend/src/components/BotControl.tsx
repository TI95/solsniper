import { useEffect, useState } from 'react';
import { getWallet, startBot, stopBot } from '@/api/wallet-api';
import { getFilter } from '@/api/filter-api';

export default function BotControl() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [hasFilter, setHasFilter] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getWallet()
      .then((w) => setEnabled(w?.botEnabled ?? false))
      .catch(() => setEnabled(false));
    getFilter()
      .then((f) => setHasFilter(f !== null))
      .catch(() => setHasFilter(false));
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

  const startDisabled = !enabled && !hasFilter;

  return (
    <div className="p-4">
      <p className="mb-2">Бот: <b>{enabled ? 'ВКЛ' : 'ВЫКЛ'}</b></p>
      <button
        onClick={toggle}
        disabled={loading || startDisabled}
        className={`px-4 py-2 rounded-lg text-white disabled:opacity-50 ${enabled ? 'bg-red-600' : 'bg-green-600'}`}
      >
        {loading ? '...' : enabled ? 'Остановить бота' : 'Запустить бота'}
      </button>
      {startDisabled && (
        <p className="mt-2 text-sm text-gray-600">Настройте фильтр, чтобы запустить бота.</p>
      )}
    </div>
  );
}
