 export type TokenPairProfile = {

    chainId: string;
    dexId: string;
    url: string;
    pairAddress: string;
    labels: string[];
    baseToken: {
      address: string;
      name: string;
      symbol: string;
    };
    quoteToken: {
      address: string;
      name: string;
      symbol: string;
    };
    priceNative: string;
    priceUsd: string;
    liquidity: {
      usd: number;
      base: number;
      quote: number;
    };
    fdv: number;
    marketCap: number;
    pairCreatedAt: number;
    info: {
      imageUrl: string;
      websites: {
        url: string;
      }[];
      socials: {
        platform: string;
        handle: string;
      }[];
    };
    hasSocials?: boolean;
    boosts: {
      active: number;
    };

};
