
import ManualSellForm from "@/components/ManualSellForm";
import MaxWidthWrapper from "@/components/MaxWidthWrapper";
import { useAutoTrade } from "@/hooks/useAutoTrade";
import { usePools } from "@/hooks/usePools";
import { TokenPairProfile } from "@/types/dex-screener-pair";
import { getBuyPrice, saveBuyPrice } from "@/utils/localStorage";
import { useEffect, useMemo } from "react";
import Skeleton from "react-loading-skeleton";
import 'react-loading-skeleton/dist/skeleton.css'


const Dasboard = () => {

    const pools = usePools();
    const { prices, soldTokens } = useAutoTrade();

    useEffect(() => {
        Object.entries(prices).forEach(([tokenAddress, price]) => {
            saveBuyPrice(tokenAddress, price);
        });
    }, [prices]);


    const uniquePools = useMemo(() => {
        if (!pools) return [];
        return pools.filter(
            (pools, index, self) =>
                index === self.findIndex((p) => p.baseToken.address === pools.baseToken.address
                ))
    }, [pools]);



    const nowInSeconds = Math.floor(Date.now() / 1000);
    const timeFromTokenCreated = nowInSeconds - 60 * 25; // 1 час = 3600 секунд

    const filteredPools = useMemo(() => {
        return uniquePools.filter(
            (pool: TokenPairProfile) =>
                pool.chainId === 'solana' &&
                (pool.dexId === 'raydium' || pool.dexId === 'pumpswap') &&
                pool.liquidity?.usd !== undefined &&
                pool.liquidity.usd >= 25000 &&
                pool.marketCap <= 1300000 &&
                pool.boosts.active >= 50 &&
                Math.floor(pool.pairCreatedAt / 1000) >= timeFromTokenCreated
        );
    }, [uniquePools, timeFromTokenCreated]);

    if (!pools) {
        return <Skeleton count={10} />
    }


    const formatDateTime = (timestamp: number): string => {
        const date = new Date(timestamp);
        return date.toLocaleString("ru-RU", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    };

    const getTimeDifference = (timestamp: number): string => {
        const now = Date.now();
        const diff = Math.floor((now - timestamp) / 1000);

        const days = Math.floor(diff / 86400);
        const hours = Math.floor((diff % 86400) / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        const seconds = diff % 60;

        if (days > 0) return `${days} д. назад`;
        if (hours > 0) return `${hours} ч. назад`;
        if (minutes > 0) return `${minutes} м. назад`;
        return `${seconds} с. назад`;
    };

    return (
        <MaxWidthWrapper>
            <div className="">
                {filteredPools.length > 0 ? (
                    filteredPools.map((pool: TokenPairProfile) => (
                        <div key={pool.baseToken.address}>
                            <a href={pool.url} target="_blank" rel="noopener noreferrer" className="decoration-none text-blue-500 font-bold  ">
                                Link to DexScreener
                            </a>
                            <p>Token Name: {pool.baseToken.name}</p>
                            <p className="font-semibold text-amber-400 mb-5">
                                Token CA: {pool.baseToken.address}
                            </p>
                            <p>Создано в: {formatDateTime(pool.pairCreatedAt)}</p>
                            <p className="">
                                Прошло время с момента создания: {getTimeDifference(pool.pairCreatedAt)}
                            </p>
                            <p className="mb-5">
                                Бустов у Токена: {pool.boosts.active}
                            </p>
                        </div>
                    ))
                ) : (
                    <div className="text-red-500 font-bold mb-10 mt-20">Нет подходящих токенов...</div>
                )}

                <div className="mt-10 p-6 bg-white/50 rounded-2xl shadow-lg mb-10">
                    <div className="">
                        <h1 className="text-green-600 mb-20  font-bold">Токены которые бот купил</h1>
                    </div>


                    <h2 className="mb-40 font-bold">Цена покупки токена в $:</h2>
                    <ul>
                        {Object.keys(prices).map((tokenAddress) => {
                            const storedBuyPrice = getBuyPrice(tokenAddress);
                            return (
                                <li key={tokenAddress}>
                                    <strong>{tokenAddress} : ${storedBuyPrice?.toFixed(10) ?? "?"}</strong>
                                </li>
                            );
                        })}
                    </ul>

                    <h2 className="text-blue-500 text-xl mb-4">Проданные токены</h2>

                    <div className="overflow-x-auto">
                        <table className="min-w-full border border-gray-300 text-sm mb-100">
                            <thead className="bg-gray-100 text-left">
                                <tr>
                                    <th className="px-4 py-2 border-b">Token Address</th>
                                    <th className="px-4 py-2 border-b text-green-600">Цена покупки ($)</th>
                                    <th className="px-4 py-2 border-b text-red-600">Цена продажи ($)</th>
                                    <th className="px-4 py-2 border-b">Профит ($)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {soldTokens.map((soldToken, index) => {
                                    const profitClass =
                                        soldToken.profit > 0 ? "text-green-500" : "text-red-500";
                                    return (
                                        <tr key={index} className="hover:bg-gray-50">
                                            <td className="px-4 py-2 border-b break-all">{soldToken.tokenAddress}</td>
                                            <td className="px-4 py-2 border-b">${soldToken.buyPrice.toFixed(10)}</td>
                                            <td className="px-4 py-2 border-b">${soldToken.sellPrice.toFixed(10)}</td>
                                            <td className={`px-4 py-2 border-b font-semibold ${profitClass}`}>
                                                ${soldToken.profit.toFixed(10)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <ManualSellForm />

                </div>

                
            </div>
        </MaxWidthWrapper>
    );
};


export default Dasboard;