import { PnlKpis } from '@/api/analytics-api';

/** USD with sign, 2 decimals. Local helper — formatThousands is digits-only. */
const formatUsd = (v: number): string =>
  `${v < 0 ? '-' : ''}$${Math.abs(v).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const PnlStats = ({ kpis }: { kpis: PnlKpis }) => {
  const cards: { label: string; value: string; tone?: 'pos' | 'neg' }[] = [
    { label: 'Итоговый PnL', value: formatUsd(kpis.totalPnlUSD), tone: kpis.totalPnlUSD >= 0 ? 'pos' : 'neg' },
    { label: 'Сделок', value: String(kpis.trades) },
    { label: 'Win-rate', value: `${(kpis.winRate * 100).toFixed(1)}%` },
    { label: 'Лучшая', value: formatUsd(kpis.bestUSD), tone: kpis.bestUSD >= 0 ? 'pos' : 'neg' },
    { label: 'Худшая', value: formatUsd(kpis.worstUSD), tone: kpis.worstUSD >= 0 ? 'pos' : 'neg' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
      {cards.map((c) => (
        <div key={c.label} className="rounded-lg border border-gray-200 p-3">
          <div className="text-xs text-gray-500">{c.label}</div>
          <div
            className={`text-lg font-semibold ${
              c.tone === 'pos' ? 'text-green-600' : c.tone === 'neg' ? 'text-red-600' : ''
            }`}
          >
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
};

export default PnlStats;
