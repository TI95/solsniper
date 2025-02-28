import React from "react";
import { TokenPairProfile } from "../types/dex-screener-pair";
import { usePools } from "../hooks/usePools";

const CoinsList: React.FC = () => {
  const pools = usePools();

  if (!pools) {
    return <div>Loading or no pools available...</div>;
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

  const nowInSeconds = Math.floor(Date.now() / 1000);
  const oneHourAgo = nowInSeconds - 60 * 20; // 1 час = 3600 секунд

  // Убираем дубликаты токенов
  const uniquePools = pools.filter(
    (pool, index, self) =>
      index === self.findIndex((p) => p.baseToken.address === pool.baseToken.address)
  );

  const filteredPools = uniquePools.filter(
    (pool: TokenPairProfile) =>
      pool.chainId === 'solana' &&
    pool.dexId === 'raydium' &&
    pool.liquidity.usd >= 25000 &&
    pool.marketCap <= 1000000 &&
    pool.boosts.active >= 10 &&
    Math.floor(pool.pairCreatedAt / 1000) >= oneHourAgo
  );

  return (
    <div className="">
      {filteredPools.length > 0 ? (
        filteredPools.map((pool: TokenPairProfile) => (
          <div key={pool.baseToken.address}>
            <a href={pool.url} target="_blank" rel="noopener noreferrer">
              Link
            </a>
            <p>Token Name: {pool.baseToken.name}</p>
            <p className="font-semibold text-amber-400">
              Token CA: {pool.baseToken.address}
            </p>
            <p>Создано в: {formatDateTime(pool.pairCreatedAt)}</p>
            <p className="mb-5">
              Прошло время с момента создания: {getTimeDifference(pool.pairCreatedAt)}
            </p>
            <p>
               Бустов у Токена: {pool.boosts.active}
            </p>
          </div>
        ))
      ) : (
        <div>Нет подходящих токенов</div>
      )}
    </div>
  );
};

export default CoinsList;


