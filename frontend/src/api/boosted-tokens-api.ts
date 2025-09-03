//dex screener boosted tokens API

import { BoostedToken } from "@/types/boosted-token";
import { DexScreenerBoostedTokensResponse } from "@/types/boosted-tokens-response";
import { TokenPairProfile } from "@/types/dex-screener-pair";
import axios from "axios";




export const latestBoostedTokens = async (): Promise<TokenPairProfile[] | null> => {
  try {
    const response = await axios.get<DexScreenerBoostedTokensResponse>(
      `https://api.dexscreener.com/token-boosts/latest/v1`
    );

    if (!Array.isArray(response.data)) {
      console.error('Expected an array, got:', response.data);
      return null;
    }
    // Фильтруем токены по условию
    const filteredTokens = response.data.filter(
      (token: BoostedToken) => token.amount >= 10 && token.chainId
    );


    // Получаем информацию о парах для отфильтрованных токенов
    const tokenPairs = await getTokenPairInfo(filteredTokens);

    //console.log('Token Pairs:', tokenPairs);
    return tokenPairs; // Возвращаем данные
  } catch (error) {
    console.error('Error fetching latest boosted tokens:', error);
    return null; // В случае ошибки возвращаем null
  }
};

async function getTokenPairInfo(data: BoostedToken[]): Promise<TokenPairProfile[]> {
  const pairsArray = await Promise.all(
    data.map(async (token) => {
      try {
        const response = await axios.get<TokenPairProfile[] >(
          `https://api.dexscreener.com/token-pairs/v1/${token.chainId}/${token.tokenAddress}`
        );

        return response.data;
      } catch (error) {
        console.error(`Error fetching pair info for token: ${token.tokenAddress}`, error);
        return []; // Возвращаем пустой массив в случае ошибки
      }
    })
  );

  return pairsArray.flat();
}

