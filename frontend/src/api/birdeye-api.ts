//birdeye api for new createad tokens

import axios from "axios";
import { TokenItem } from "@/types/birdete-token-item";
import { TokenPairProfile } from "@/types/dex-screener-pair";
import { AllTokenData } from "@/types/all-token-data";

export const getTokensList = async (): Promise<TokenPairProfile[]> => {
  const now = Math.floor(Date.now() / 1000);
  const oneMinutesAgo = now - 60;
  const response = await axios.get<{ data: { items: TokenItem[] } }>(
    `https://public-api.birdeye.so/defi/v2/tokens/new_listing?time_to=${oneMinutesAgo}&limit=10&meme_platform_enabled=false`,
    {
      headers: {
        accept: 'application/json',
        'x-chain': 'solana',
        'X-API-KEY': '6ee39442cb2e4c17a72b854de3f97816',
      },
    }
  );

  console.log('New Listed Tokens:', response.data.data.items);
  return await getTokenPairInfo(response.data.data.items);
};

async function getTokenPairInfo(data: TokenItem[]): Promise<TokenPairProfile[]> {
  const pairsArray = await Promise.all(
    data.map(async (element) => {
      try {
        const response = await axios.get<TokenPairProfile[]>(
          `https://api.dexscreener.com/token-pairs/v1/solana/${element.address}`
        );

        // Проверяем, есть ли данные
        if (response.data && response.data.length > 0) {
          // Добавляем проверку наличия социальных сетей для каждой пары
          const pairsWithSocials = await Promise.all(
            response.data.map(async (pair) => {
              //const hasSocials = await allTokenData(pair.baseToken.address);
              return {
                ...pair,
                //hasSocials,
              };
            })
          );
          return pairsWithSocials;
        } else {
          console.warn(`No pairs found for token: ${element.address}`);
          return []; // Возвращаем пустой массив, если данных нет
        }
      } catch (error) {
        console.log(`Error fetching pair info for token: ${element.address}`, error);
        return []; // Возвращаем пустой массив в случае ошибки
      }
    })
  );

  // Объединяем все массивы пар в один массив
  return pairsArray.flat();
}

/*export const allTokenData = async (tokenAddress: string): Promise<boolean> => {
  try {
    const response = await axios.get<{ data: AllTokenData; success: boolean }>(
      `https://public-api.birdeye.so/defi/token_overview?address=${tokenAddress}`,
      {
        headers: {
          accept: 'application/json',
          'x-chain': 'solana',
          'X-API-KEY': '6ee39442cb2e4c17a72b854de3f97816',
        },
      }
    );
    console.log(response)
    // Проверяем наличие социальных сетей
    const extensions = response.data.data.data.extensions;
    const tokenHasSocials = !!(
      extensions?.twitter ||
      extensions?.telegram ||
      extensions?.website
    );

    return tokenHasSocials;
  } catch (error) {
    console.error(`Error fetching token data for address: ${tokenAddress}`,);
    return false; // В случае ошибки возвращаем false
  }
};

*/

