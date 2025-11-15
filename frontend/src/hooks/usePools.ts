import { useEffect, useState } from "react";
import { TokenPairProfile } from "@/types/dex-screener-pair";
import { latestBoostedTokens } from "@/api/boosted-tokens-api";

export const usePools = (): TokenPairProfile[] | null => {
  const [pools, setPools] = useState<TokenPairProfile[] | null>(null);

  const fetchPools = async () => {
    try {
      const data = await latestBoostedTokens(); // Теперь latestBoostedTokens возвращает TokenPairProfile[] или null
      setPools(data); // Устанавливаем данные в состояние
    } catch (error) {
      console.error("Error fetching pools:", error);
      setPools(null); // В случае ошибки устанавливаем null
    }
  };

  useEffect(() => {
    fetchPools(); // Вызываем fetchPools при монтировании компонента

    const intervalId = setInterval(() => {
      fetchPools(); // Обновляем данные каждую минуту
    }, 60000);
     
    return () => {
      clearInterval(intervalId); // Очищаем интервал при размонтировании компонента
    };
  }, []);

  return pools; // Возвращаем данные
};

