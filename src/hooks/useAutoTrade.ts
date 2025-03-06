import { useEffect, useState } from 'react';
import { usePools } from './usePools';
import axios from 'axios';
import { apibuyToken } from '../blockchain/raydium-buy-token';
import { apiSellToken } from '../blockchain/raydium-sell-token';
import { TokenPairProfile } from '../types/dex-screener-pair';
import { Connection, PublicKey } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';
import { LiquidErrorRaydium } from '@/types/liquid-error-raydium';

// QuickNode endpoint
const QUICKNODE_ENDPOINT =
  'https://stylish-falling-glade.solana-mainnet.quiknode.pro/01796c91dbb4b4e0a971e5fe3457980aed1ac4b9';
const connection = new Connection(QUICKNODE_ENDPOINT);

interface PurchasedToken {
  totalCost: number;
  amount: number;
  amountInLamports: number;
  decimals: number;
  buyPriceInUSD: number;
}

interface SoldToken {
  tokenAddress: string;
  buyPrice: number;
  sellPrice: number;
  profit: number;
  link: string;
}

const savePurchasedTokensToLocalStorage = (tokens: Record<string, PurchasedToken>) => {
  localStorage.setItem('purchasedTokens', JSON.stringify(tokens));
};

const loadPurchasedTokensFromLocalStorage = (): Record<string, PurchasedToken> => {
  const data = localStorage.getItem('purchasedTokens');
  return data ? JSON.parse(data) : {};
};

const savePurchasedTokensHistoryToLocalStorage = (tokens: Set<string>) => {
  const tokensArray = Array.from(tokens);
  localStorage.setItem('purchasedTokensHistory', JSON.stringify(tokensArray));
};

const loadPurchasedTokensHistoryFromLocalStorage = (): Set<string> => {
  const data = localStorage.getItem('purchasedTokensHistory');
  if (data) {
    const tokensArray = JSON.parse(data) as string[];
    return new Set(tokensArray);
  }
  return new Set();
};

const saveBlacklistedTokensToLocalStorage = (tokens: Set<string>) => {
  const tokensArray = Array.from(tokens);
  localStorage.setItem('blacklistedTokens', JSON.stringify(tokensArray));
};

const loadBlacklistedTokensFromLocalStorage = (): Set<string> => {
  const data = localStorage.getItem('blacklistedTokens');
  if (data) {
    const tokensArray = JSON.parse(data) as string[];
    return new Set(tokensArray);
  }
  return new Set();
};

const purchasedTokens: Record<string, PurchasedToken> = loadPurchasedTokensFromLocalStorage();

export const useAutoTrade = () => {
  const pools = usePools();
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [soldTokens, setSoldTokens] = useState<SoldToken[]>([]);
  const [isBuying, setIsBuying] = useState(false);
  const [lastPurchaseTime, setLastPurchaseTime] = useState<number>(0);
  const [isSelling, setIsSelling] = useState<Record<string, boolean>>({});
  const [processingTokens, setProcessingTokens] = useState<Set<string>>(new Set());
  const [soldTokensHistory, setSoldTokensHistory] = useState<Set<string>>(new Set());
  const [purchasedTokensHistory, setPurchasedTokensHistory] = useState<Set<string>>(
    loadPurchasedTokensHistoryFromLocalStorage()
  );
  const [blacklistedTokens, setBlacklistedTokens] = useState<Set<string>>(loadBlacklistedTokensFromLocalStorage());
  const [isStarted, setIsStarted] = useState(false);
  const [isStopped, setIsStopped] = useState(false);
  const [initialPrices, setInitialPrices] = useState<Record<string, number>>({});
  const solAddress = 'So11111111111111111111111111111111111111112';

  useEffect(() => {
    if (!isStarted || isStopped) return;
    savePurchasedTokensHistoryToLocalStorage(purchasedTokensHistory);
  }, [purchasedTokensHistory, isStarted, isStopped]);

  useEffect(() => {
    saveBlacklistedTokensToLocalStorage(blacklistedTokens);
  }, [blacklistedTokens]);

  const getTokenPrice = async (tokenAddress: string): Promise<{ value: number; priceInNative: number }> => {
    try {
      const response = await axios.get(`https://public-api.birdeye.so/defi/price?address=${tokenAddress}`, {
        headers: {
          accept: 'application/json',
          'x-chain': 'solana',
          'X-API-KEY': '6ee39442cb2e4c17a72b854de3f97816',
        },
      });
      return {
        value: response.data.data.value,
        priceInNative: response.data.data.priceInNative,
      };
    } catch (error) {
      console.error('❌ Ошибка получения цены:', error);
      return { value: 0, priceInNative: 0 };
    }
  };

  const getSOLPrice = async (): Promise<number> => {
    try {
      const response = await axios.get(`https://public-api.birdeye.so/defi/price?address=${solAddress}`, {
        headers: {
          accept: 'application/json',
          'x-chain': 'solana',
          'X-API-KEY': '6ee39442cb2e4c17a72b854de3f97816',
        },
      });
      return response.data.data.value;
    } catch (error) {
      console.error('❌ Ошибка получения цены SOL:', error);
      return 0;
    }
  };

  const getTokenDecimals = async (tokenAddress: string): Promise<number> => {
    const mintAccount = await getMint(connection, new PublicKey(tokenAddress));
    return mintAccount.decimals;
  };

  const calculateSellAmountInSolLamports = (
    purchasedToken: PurchasedToken,
    priceInNative: number
  ): number => {
    const sellPercentage = 0.95;
    const tokenAmountInLamports = purchasedToken.amountInLamports * sellPercentage;
    const tokenAmount = tokenAmountInLamports / Math.pow(10, purchasedToken.decimals);
    const solAmount = tokenAmount * priceInNative;
    return Math.floor(solAmount * 1e9);
  };

  useEffect(() => {
    const buyTokens = async () => {
      console.log("pools:", pools);
      if (!pools || isBuying || Object.keys(purchasedTokens).length >= 2) {
        console.log('Покупка заблокирована: нет pools, идет покупка или достигнут лимит токенов');
        return;
      }

      const nowInSeconds = Math.floor(Date.now() / 1000);
      const oneHourAgo = nowInSeconds - 60 * 20;
      const uniquePools = pools.filter(
        (pool, index, self) => index === self.findIndex((p) => p.baseToken.address === pool.baseToken.address)
      );

      const filteredPools = uniquePools.filter(
        (pool: TokenPairProfile) =>
          pool.chainId === 'solana' &&
          pool.dexId === 'raydium' &&
          pool.liquidity.usd >= 25000 &&
          pool.marketCap <= 300000 &&
          pool.boosts.active >= 100 &&
          Math.floor(pool.pairCreatedAt / 1000) >= oneHourAgo
      );
      console.log("filteredPools:", filteredPools);

      if (nowInSeconds - lastPurchaseTime < 30) {
        console.log('Слишком рано для покупки, осталось:', 30 - (nowInSeconds - lastPurchaseTime), 'секунд');
        return;
      }

      for (const pool of filteredPools) {
        if (Object.keys(purchasedTokens).length >= 2) {
          console.log('Достигнут лимит в 2 токена, покупка остановлена.');
          break;
        }

        const tokenAddress = pool.baseToken.address;

        if (purchasedTokensHistory.has(tokenAddress)) {
          console.log(`❌ Токен ${tokenAddress} уже был куплен ранее.`);
          continue;
        }
        if (blacklistedTokens.has(tokenAddress)) {
          console.log(`❌ Токен ${tokenAddress} в черном списке, пропускаем.`);
          continue;
        }

        const isTokenSold = soldTokens.some((sold) => sold.tokenAddress === tokenAddress);
        if (isTokenSold) {
          console.log(`Токен ${tokenAddress} уже был продан, пропускаем покупку`);
          continue;
        }

        if (purchasedTokens[tokenAddress] || processingTokens.has(tokenAddress)) {
          console.log(`Токен ${tokenAddress} уже куплен или в процессе, пропускаем`);
          continue;
        }

        const priceData = await getTokenPrice(tokenAddress);
        const currentPrice = priceData.value;
        if (!initialPrices[tokenAddress]) {
          setInitialPrices((prev) => ({ ...prev, [tokenAddress]: currentPrice }));
          console.log(`Установлена начальная цена для токена ${tokenAddress}: ${currentPrice}`);
          continue;
        }

        //  const initialPrice = initialPrices[tokenAddress];
       /* if (currentPrice >= initialPrice * 0.8) {
          console.log(`❌ Цена токена ${tokenAddress} не упала на 20%, пропускаем покупку.`);
          continue;
        } */
        

        const publicKey = new PublicKey(tokenAddress);
        setProcessingTokens((prev) => new Set(prev).add(tokenAddress));
        setIsBuying(true);
        console.log('Начало покупки токена:', tokenAddress);

        try {
          const decimals = await getTokenDecimals(tokenAddress);
          const buyResponse = await apibuyToken(publicKey, 11001); // 0.11 SOL

          if (!buyResponse || !buyResponse.data) {
            console.error('Ошибка: данные о покупке отсутствуют');
            continue;
          }

          const outputAmount = Number(buyResponse.data.outputAmount); // Лампорты токена
          const inputAmount = Number(buyResponse.data.inputAmount);   // Лампорты SOL
          const solPrice = await getSOLPrice();
          const amountInTokens = outputAmount / Math.pow(10, decimals); // Количество токенов
          const priceInSol = (inputAmount / 1e9) / amountInTokens; // Цена 1 токена в SOL
          const buyPriceInUSD = priceInSol * solPrice; // Цена 1 токена в USD
          const totalCost = (inputAmount / 1e9) * solPrice;

          console.log(`Покупка ${tokenAddress}:`);
          console.log(`- inputAmount: ${inputAmount / 1e9} SOL`);
          console.log(`- outputAmount: ${amountInTokens} токенов`);
          console.log(`- solPrice: ${solPrice} USD`);
          console.log(`- priceInSol: ${priceInSol} SOL`);
          console.log(`- buyPriceInUSD: ${buyPriceInUSD} USD`);
          console.log(`- totalCost: ${totalCost} USD`);
          console.log(`- Цена из API: ${priceData.value} USD`);

          purchasedTokens[tokenAddress] = {
            totalCost,
            amount: amountInTokens,
            amountInLamports: outputAmount,
            decimals,
            buyPriceInUSD,
          };
          savePurchasedTokensToLocalStorage(purchasedTokens);
          setPurchasedTokensHistory((prev) => new Set(prev).add(tokenAddress));
          console.log(`✅ Купили ${tokenAddress} по цене ${buyPriceInUSD} USD, количество: ${amountInTokens}`);
          setLastPurchaseTime(nowInSeconds);
        } catch (error) {
          console.error('Ошибка при покупке токена:', error);
          if (error instanceof Error && error.message.includes('TokenInvalidAccountOwnerError')) {
            console.log(`❌ Токен ${tokenAddress} недействителен, добавляем в черный список.`);
            setBlacklistedTokens((prev) => {
              const newSet = new Set(prev).add(tokenAddress);
              saveBlacklistedTokensToLocalStorage(newSet);
              return newSet;
            });
          }
        } finally {
          setIsBuying(false);
          setProcessingTokens((prev) => {
            const newSet = new Set(prev);
            newSet.delete(tokenAddress);
            return newSet;
          });
        }
      }
    };

    if (!pools) return;
    console.log('work');
    buyTokens();
  }, [
    pools,
    soldTokens,
    processingTokens,
    isBuying,
    lastPurchaseTime,
    soldTokensHistory,
    purchasedTokensHistory,
    isStarted,
    isStopped,
    blacklistedTokens,
    initialPrices,
  ]);

  useEffect(() => {
    const sellTokens = async () => {
      for (const tokenAddress of Object.keys(purchasedTokens)) {
        if (isSelling[tokenAddress]) {
          console.log(`Продажа токена ${tokenAddress} уже идет, пропускаем.`);
          continue;
        }
        

        const priceData = await getTokenPrice(tokenAddress);
        const currentPrice = priceData.value;
        const priceInNative = priceData.priceInNative;
        setPrices((prev) => ({ ...prev, [tokenAddress]: currentPrice }));
        const buyPriceInUSD = purchasedTokens[tokenAddress].buyPriceInUSD;

        console.log(`Текущая цена: ${currentPrice} USD, Цена покупки: ${buyPriceInUSD} USD, Цена в SOL: ${priceInNative}`);
        const sellThreshold = buyPriceInUSD * 0.8;

    
        if (currentPrice >= buyPriceInUSD * 1.2) {
          console.log(`📈 Продаем ${tokenAddress} за ${currentPrice} USD (цена выросла на 20%)`);
          setIsSelling((prev) => ({ ...prev, [tokenAddress]: true }));

          const tokenData = purchasedTokens[tokenAddress];
          const sellAmountInSolLamports = calculateSellAmountInSolLamports(tokenData, priceInNative);
          console.log(`Продаем 98% токенов за ${sellAmountInSolLamports} лампортов SOL`);

          try {
            await apiSellToken(tokenAddress, sellAmountInSolLamports);
            delete purchasedTokens[tokenAddress];
            savePurchasedTokensToLocalStorage(purchasedTokens);

            const soldToken: SoldToken = {
              tokenAddress,
              buyPrice: buyPriceInUSD,
              sellPrice: currentPrice,
              profit: currentPrice - buyPriceInUSD,
              link: `https://dexscreener.com/solana/${tokenAddress}`,
            };

            setSoldTokens((prev) => [...prev, soldToken]);
            setSoldTokensHistory((prev) => new Set(prev).add(tokenAddress));
          } catch (error) {
            console.error('❌ Ошибка при продаже токена:', error);
            if ((error as LiquidErrorRaydium).msg?.includes('INSUFFICIENT_LIQUIDITY')) {
              console.log(`❌ Токен ${tokenAddress} не может быть продан из-за недостатка ликвидности, удаляем из списка.`);
              delete purchasedTokens[tokenAddress];
              savePurchasedTokensToLocalStorage(purchasedTokens);
            } else if (error instanceof Error && error.message.includes('TransactionExpiredBlockheightExceededError')) {
              console.log(`❌ Транзакция истекла, токен ${tokenAddress} не продан.`);
              purchasedTokens[tokenAddress] = tokenData;
              savePurchasedTokensToLocalStorage(purchasedTokens);
            } else {
              console.log(`❌ Неизвестная ошибка при продаже токена ${tokenAddress}.`);
              purchasedTokens[tokenAddress] = tokenData;
              savePurchasedTokensToLocalStorage(purchasedTokens);
            }
          } finally {
            setIsSelling((prev) => ({ ...prev, [tokenAddress]: false }));
          }
        } else if (currentPrice <= sellThreshold) {
          console.log(`📉 Продаем ${tokenAddress} за ${currentPrice} USD (цена упала на 30%)`);
          setIsSelling((prev) => ({ ...prev, [tokenAddress]: true }));

          const tokenData = purchasedTokens[tokenAddress];
          const sellAmountInSolLamports = calculateSellAmountInSolLamports(tokenData, priceInNative);

          try {
            await apiSellToken(tokenAddress, sellAmountInSolLamports);
            delete purchasedTokens[tokenAddress];
            savePurchasedTokensToLocalStorage(purchasedTokens);

            const soldToken: SoldToken = {
              tokenAddress,
              buyPrice: buyPriceInUSD,
              sellPrice: currentPrice,
              profit: currentPrice - buyPriceInUSD,
              link: `https://dexscreener.com/solana/${tokenAddress}`,
            };

            setSoldTokens((prev) => [...prev, soldToken]);
            setSoldTokensHistory((prev) => new Set(prev).add(tokenAddress));
          } catch (error) {
            console.error('❌ Ошибка при продаже токена:', error);
            if ((error as LiquidErrorRaydium).msg?.includes('INSUFFICIENT_LIQUIDITY')) {
              console.log(`❌ Токен ${tokenAddress} не может быть продан из-за недостатка ликвидности, удаляем из списка.`);
              delete purchasedTokens[tokenAddress];
              savePurchasedTokensToLocalStorage(purchasedTokens);
            } else if (error instanceof Error && error.message.includes('TransactionExpiredBlockheightExceededError')) {
              console.log(`❌ Транзакция истекла, токен ${tokenAddress} не продан.`);
              purchasedTokens[tokenAddress] = tokenData;
              savePurchasedTokensToLocalStorage(purchasedTokens);
            } else {
              console.log(`❌ Неизвестная ошибка при продаже токена ${tokenAddress}.`);
              purchasedTokens[tokenAddress] = tokenData;
              savePurchasedTokensToLocalStorage(purchasedTokens);
            }
          } finally {
            setIsSelling((prev) => ({ ...prev, [tokenAddress]: false }));
          }
        } else {
          console.log(`❌ Цена токена ${tokenAddress} не соответствует условиям: ${currentPrice} USD`);
        }
      }
    };

    const interval = setInterval(sellTokens, 5000);
    return () => clearInterval(interval);
  }, [isSelling, purchasedTokens, soldTokens, soldTokensHistory, isStarted, isStopped]);

  const startAutoTrade = () => {
    setIsStarted(true);
    setIsStopped(false);
  };

  const stopAutoTrade = () => {
    setIsStopped(true);
  };

  return { prices, soldTokens, startAutoTrade, stopAutoTrade };
};