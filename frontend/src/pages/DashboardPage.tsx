import MaxWidthWrapper from "@/components/MaxWidthWrapper";
import ManualSellForm from "@/components/ManualSellForm";
import { getPositions, getTrades, PositionView, TradeView } from "@/api/wallet-api";
import { useEffect, useState } from "react";
import Skeleton from "react-loading-skeleton";
import 'react-loading-skeleton/dist/skeleton.css';

const Dashboard = () => {
    const [positions, setPositions] = useState<PositionView[] | null>(null);
    const [trades, setTrades] = useState<TradeView[]>([]);

    useEffect(() => {
        const load = async () => {
            try {
                const [p, t] = await Promise.all([getPositions(), getTrades()]);
                setPositions(p);
                setTrades(t);
            } catch (e) {
                console.error('Failed to load dashboard data:', e);
                setPositions([]);
            }
        };
        load();
        const id = setInterval(load, 10000);
        return () => clearInterval(id);
    }, []);

    if (positions === null) return <Skeleton count={10} />;

    return (
        <MaxWidthWrapper>
            <div className="mt-10">
                <h1 className="text-green-600 mb-4 font-bold">Открытые позиции</h1>
                {positions.length === 0 ? (
                    <p className="text-gray-500 mb-8">Открытых позиций нет.</p>
                ) : (
                    <ul className="mb-8">
                        {positions.map((p) => (
                            <li key={p._id} className="break-all mb-1">
                                {p.tokenAddress} — ${p.buyPriceUSD.toFixed(8)} ({p.dexId})
                            </li>
                        ))}
                    </ul>
                )}

                <h2 className="text-blue-500 text-xl mb-4">Закрытые сделки</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full border border-gray-300 text-sm mb-10">
                        <thead className="bg-gray-100 text-left">
                            <tr>
                                <th className="px-4 py-2 border-b">Token</th>
                                <th className="px-4 py-2 border-b text-green-600">Покупка ($)</th>
                                <th className="px-4 py-2 border-b text-red-600">Продажа ($)</th>
                                <th className="px-4 py-2 border-b">PnL ($)</th>
                                <th className="px-4 py-2 border-b">Причина</th>
                            </tr>
                        </thead>
                        <tbody>
                            {trades.map((t) => (
                                <tr key={t._id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 border-b break-all">{t.tokenAddress}</td>
                                    <td className="px-4 py-2 border-b">${t.buyPriceUSD.toFixed(8)}</td>
                                    <td className="px-4 py-2 border-b">${t.sellPriceUSD.toFixed(8)}</td>
                                    <td className={`px-4 py-2 border-b font-semibold ${t.realizedPnlUSD >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        ${t.realizedPnlUSD.toFixed(6)}
                                    </td>
                                    <td className="px-4 py-2 border-b">{t.reason}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <ManualSellForm />
            </div>
        </MaxWidthWrapper>
    );
};

export default Dashboard;
