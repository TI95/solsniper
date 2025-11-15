import { TokenPairProfile } from "@/types/dex-screener-pair";


interface UsePoolFilterReturn {
    filterPools: (pools: TokenPairProfile[]) => TokenPairProfile[];
    getUniquePools: (pools: TokenPairProfile[]) => TokenPairProfile[];
}

export const usePoolFilter = (): UsePoolFilterReturn => {
    const getUniquePools = (pools: TokenPairProfile[]): TokenPairProfile[] => {
        const uniquePoolsMap = new Map<string, TokenPairProfile>();
        pools.forEach(pool => {
            if (!uniquePoolsMap.has(pool.baseToken.address)) {
                uniquePoolsMap.set(pool.baseToken.address, pool);
            }
        });
        return Array.from(uniquePoolsMap.values());
    };

    const filterPools = (pools: TokenPairProfile[]): TokenPairProfile[] => {
        const nowInSeconds = Math.floor(Date.now() / 1000);
        const oneHourAgo = nowInSeconds - 60 * 25; //20 def

        return pools.filter((pool: TokenPairProfile) =>
            pool.chainId === 'solana' &&
            (pool.dexId === 'raydium' || pool.dexId === 'pumpswap') &&
            pool.liquidity.usd >= 25000 &&
            pool.marketCap <= 1300000 &&
            pool.boosts.active >= 5000 &&
            Math.floor(pool.pairCreatedAt / 1000) >= oneHourAgo
        );
    };
    return { filterPools, getUniquePools };
}