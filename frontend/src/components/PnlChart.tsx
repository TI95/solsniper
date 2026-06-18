import { PnlPoint } from '@/api/analytics-api';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const PnlChart = ({ series }: { series: PnlPoint[] }) => {
  if (series.length === 0) {
    return (
      <p className="text-gray-500 mb-8">
        Сделок пока нет — график появится после первой закрытой сделки.
      </p>
    );
  }

  // Keep the unique ISO timestamp as the x key (multiple trades can share a
  // calendar day); format it to a short date only for display.
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const data = series.map((p) => ({
    t: p.t,
    pnl: Number(p.cumulativePnlUSD.toFixed(2)),
  }));

  return (
    <div className="w-full h-64 mb-8">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="t" tickFormatter={fmtDate} />
          <YAxis />
          <Tooltip labelFormatter={fmtDate} />
          <Area type="monotone" dataKey="pnl" stroke="#16a34a" fill="#16a34a" fillOpacity={0.15} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PnlChart;
