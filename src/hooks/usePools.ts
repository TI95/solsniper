import { useEffect, useState } from "react";
import { getPools } from "../api/dex-screener-api";
import { TokenPairProfile } from "../types/dex-screener-pair";

export const usePools = (): TokenPairProfile[] | null => {
  const [pools, setPools] = useState<TokenPairProfile[] | null>(null);

  const fetchPools = async () => {
    const data = await getPools();
    setPools(data);
  };

  useEffect(() => {

    fetchPools();

    const intervalId = setInterval(() => {
      fetchPools();
    }, 20000);

    return () => {
      clearInterval(intervalId);
    }
  }, []);

   return pools;
};


