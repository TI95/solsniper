import { useEffect, useState } from 'react';
import { getFilter, saveFilter, FilterValues } from '@/api/filter-api';
import { formatThousands, parseThousands } from '@/utils/format-number';

type FormState = {
  minLiquidityUSD: string; // formatted with thousands separators
  maxMarketCapUSD: string; // formatted with thousands separators
  maxAgeMinutes: string;
  minBoosts: string;
};

const EMPTY: FormState = { minLiquidityUSD: '', maxMarketCapUSD: '', maxAgeMinutes: '', minBoosts: '' };

export default function FilterSettings() {
  const [applied, setApplied] = useState<FilterValues | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getFilter()
      .then((f) => {
        setApplied(f);
        if (f) {
          setForm({
            minLiquidityUSD: formatThousands(f.minLiquidityUSD),
            maxMarketCapUSD: formatThousands(f.maxMarketCapUSD),
            maxAgeMinutes: String(f.maxAgeMinutes),
            minBoosts: String(f.minBoosts),
          });
        }
      })
      .catch(() => setApplied(null));
  }, []);

  const setMoney = (key: 'minLiquidityUSD' | 'maxMarketCapUSD') => (raw: string) =>
    setForm((s) => ({ ...s, [key]: formatThousands(raw) }));

  const setInt = (key: 'maxAgeMinutes' | 'minBoosts') => (raw: string) =>
    setForm((s) => ({ ...s, [key]: raw.replace(/\D/g, '') }));

  const handleSave = async () => {
    setLoading(true);
    setMessage('');
    try {
      const values: FilterValues = {
        minLiquidityUSD: parseThousands(form.minLiquidityUSD),
        maxMarketCapUSD: parseThousands(form.maxMarketCapUSD),
        maxAgeMinutes: parseThousands(form.maxAgeMinutes),
        minBoosts: parseThousands(form.minBoosts),
      };
      const saved = await saveFilter(values);
      setApplied(saved);
      setMessage('✅ Фильтр сохранён');
    } catch (e: any) {
      setMessage(`❌ ${e?.response?.data?.message || 'Ошибка сохранения фильтра'}`);
    } finally {
      setLoading(false);
    }
  };

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    placeholder: string
  ) => (
    <label className="block mb-3">
      <span className="block text-sm font-medium mb-1">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="numeric"
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-xl px-3 py-2"
      />
    </label>
  );

  return (
    <div className="p-4 max-w-md">
      <h2 className="text-lg font-bold mb-2">Фильтр кандидатов</h2>

      <div className="mb-4 p-3 rounded-xl bg-gray-100 text-sm">
        <p className="font-semibold mb-1">Применённый фильтр</p>
        {applied ? (
          <ul className="space-y-0.5">
            <li>Мин. ликвидность: ${formatThousands(applied.minLiquidityUSD)}</li>
            <li>Макс. капитализация: ${formatThousands(applied.maxMarketCapUSD)}</li>
            <li>Макс. возраст: {applied.maxAgeMinutes} мин</li>
            <li>Мин. бусты: {applied.minBoosts}</li>
          </ul>
        ) : (
          <p className="text-gray-600">Фильтр не настроен.</p>
        )}
      </div>

      {field('Мин. ликвидность ($)', form.minLiquidityUSD, setMoney('minLiquidityUSD'), 'напр. 25,000')}
      {field('Макс. капитализация ($)', form.maxMarketCapUSD, setMoney('maxMarketCapUSD'), 'напр. 1,300,000')}
      {field('Макс. возраст (минуты)', form.maxAgeMinutes, setInt('maxAgeMinutes'), 'напр. 25')}
      {field('Мин. бусты', form.minBoosts, setInt('minBoosts'), 'напр. 50')}

      <button
        onClick={handleSave}
        disabled={loading}
        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
      >
        {loading ? 'Сохранение...' : 'Сохранить фильтр'}
      </button>
      {message && <p className="mt-3 text-sm">{message}</p>}
    </div>
  );
}
