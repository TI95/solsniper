import { useEffect, useState, useRef } from 'react';
import { usePools } from './usePools';
import axios from 'axios';
import { apibuyToken } from '../blockchain/raydium-buy-token';
import { apiSellToken } from '../blockchain/raydium-sell-token';
import { TokenPairProfile } from '../types/dex-screener-pair';
import { Connection, PublicKey } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';
import { LiquidErrorRaydium } from '@/types/liquid-error-raydium';
import { apiPumpfunSwapToken } from '../blockchain/pumpfunswap-buy';
import { SwapCompute } from '@/types/swap-compute';
import { useSelector } from 'react-redux';
import { selectAuth } from '@/store/authSlice';
import api from '../api/axiosInstance';



// QuickNode endpoint
const QUICKNODE_ENDPOINT = import.meta.env.VITE_QUICKNODE_ENDPOINT;
const connection = new Connection(QUICKNODE_ENDPOINT);
const BIRDEYE_API_KEY = import.meta.env.VITE_BIRDEYE_API_KEY;
const BIRDEYE_PRICE_API = import.meta.env.VITE_BIRDEYE_PRICE_API;
interface PurchasedToken {
  totalCost: number;
  amount: number;
  amountInLamports: number;
  decimals: number;
  buyPriceInUSD: number;
  dexId: 'raydium' | 'pumpswap';
}

interface SoldToken {
  tokenAddress: string;
  buyPrice: number;
  sellPrice: number;
  profit: number;
  link: string;
  soldAtLoss?: boolean;
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

// Инициализируем purchasedTokens пустым объектом
const purchasedTokens: Record<string, PurchasedToken> = {};

export const useAutoTrade = () => {
  const pools = usePools();
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [soldTokens, setSoldTokens] = useState<SoldToken[]>([]);
  const [isBuying, setIsBuying] = useState(false);
  const [lastPurchaseTime, setLastPurchaseTime] = useState<number>(0);
  const [isSelling, setIsSelling] = useState<Record<string, boolean>>({});
  const [processingTokens, setProcessingTokens] = useState<Set<string>>(new Set());
  const [soldTokensHistory, setSoldTokensHistory] = useState<Set<string>>(loadPurchasedTokensHistoryFromLocalStorage());
  const [purchasedTokensHistory, setPurchasedTokensHistory] = useState<Set<string>>(
    loadPurchasedTokensHistoryFromLocalStorage()
  );
  const [blacklistedTokens, setBlacklistedTokens] = useState<Set<string>>(loadBlacklistedTokensFromLocalStorage());
  const [initialPrices, setInitialPrices] = useState<Record<string, number>>({});
  const solAddress = 'So11111111111111111111111111111111111111112';
  const { accessToken } = useSelector(selectAuth);

  // Создаем ref для синхронного доступа к processingTokens
  const processingTokensRef = useRef<Set<string>>(new Set());
  processingTokensRef.current = processingTokens;

  // Очистка localStorage только при первом запуске программы
  useEffect(() => {
    const isFirstRun = localStorage.getItem('isFirstRun') === null;
    if (isFirstRun) {
      console.log('Это первый запуск программы, очищаем localStorage');
      localStorage.clear();
      savePurchasedTokensToLocalStorage(purchasedTokens);
      savePurchasedTokensHistoryToLocalStorage(new Set());
      saveBlacklistedTokensToLocalStorage(new Set());
      setPurchasedTokensHistory(new Set());
      setBlacklistedTokens(new Set());
      setSoldTokensHistory(new Set());
      localStorage.setItem('isFirstRun', 'false');
    } else {
      console.log('Это не первый запуск, localStorage не очищается');
      const loadedPurchasedTokens = loadPurchasedTokensFromLocalStorage();
      Object.assign(purchasedTokens, loadedPurchasedTokens);
      setPurchasedTokensHistory(loadPurchasedTokensHistoryFromLocalStorage());
      setBlacklistedTokens(loadBlacklistedTokensFromLocalStorage());
      setSoldTokensHistory(loadPurchasedTokensHistoryFromLocalStorage());
    }
  }, []);

  useEffect(() => {
    saveBlacklistedTokensToLocalStorage(blacklistedTokens);
  }, [blacklistedTokens]);

  const getTokenPrice = async (tokenAddress: string): Promise<{ value: number; priceInNative: number }> => {
    try {
      const response = await axios.get(BIRDEYE_PRICE_API + `${tokenAddress}`, {
        headers: {
          accept: 'application/json',
          'x-chain': 'solana',
          'X-API-KEY': BIRDEYE_API_KEY,
        },
      });
      return {
        value: (response.data as { data: { value: number; priceInNative: number } }).data.value,
        priceInNative: (response.data as { data: { value: number; priceInNative: number } }).data.priceInNative,
      };
    } catch (error) {
      console.error('❌ Ошибка получения цены:', error);
      return { value: 0, priceInNative: 0 };
    }
  };

  const getSOLPrice = async (): Promise<number> => {
    try {
      const response = await axios.get(`${BIRDEYE_PRICE_API}${solAddress}`, {
        headers: {
          accept: 'application/json',
          'x-chain': 'solana',
          'X-API-KEY': BIRDEYE_API_KEY,
        },
      });
      return (response.data as { data: { value: number } }).data.value;
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
      console.log('pools:', pools);

      // Создаем локальные копии для атомарных проверок
      const currentlyProcessing = new Set(processingTokensRef.current);
      const currentlyPurchased = Object.keys(purchasedTokens);

      if (!pools || isBuying || currentlyPurchased.length >= 1) {
        console.log('Покупка заблокирована: нет pools, идет покупка или достигнут лимит токенов');
        return;
      }

      const nowInSeconds = Math.floor(Date.now() / 1000);
      const oneHourAgo = nowInSeconds - 60 * 25; //20 def

      // Используем Map для гарантированно уникальных пулов
      const uniquePoolsMap = new Map<string, TokenPairProfile>();
      pools.forEach(pool => {
        if (!uniquePoolsMap.has(pool.baseToken.address)) {
          uniquePoolsMap.set(pool.baseToken.address, pool);
        }
      });
      const uniquePools = Array.from(uniquePoolsMap.values());

      const filteredPools = uniquePools.filter(
        (pool: TokenPairProfile) =>
          pool.chainId === 'solana' &&
          (pool.dexId === 'raydium' || pool.dexId === 'pumpswap') &&
          //pool.liquidity?.usd !== undefined &&
          pool.liquidity.usd >= 25000 &&
          pool.marketCap <= 1300000 &&
          pool.boosts.active >= 5000 &&
          Math.floor(pool.pairCreatedAt / 1000) >= oneHourAgo
      );
      console.log('filteredPools:', filteredPools);

      if (nowInSeconds - lastPurchaseTime < 30) {
        console.log('Слишком рано для покупки, осталось:', 30 - (nowInSeconds - lastPurchaseTime), 'секунд');
        return;
      }

      for (const pool of filteredPools) {
        const tokenAddress = pool.baseToken.address;

        // Детальное логирование состояния токена
        console.log('Checking token:', tokenAddress, {
          inProcessing: currentlyProcessing.has(tokenAddress),
          alreadyPurchased: currentlyPurchased.includes(tokenAddress),
          inHistory: purchasedTokensHistory.has(tokenAddress),
          blacklisted: blacklistedTokens.has(tokenAddress)
        });

        // Усиленная проверка перед покупкой
        if (
          currentlyProcessing.has(tokenAddress) ||
          currentlyPurchased.includes(tokenAddress) ||
          purchasedTokensHistory.has(tokenAddress) ||
          soldTokensHistory.has(tokenAddress) ||
          blacklistedTokens.has(tokenAddress)
        ) {
          console.log(`❌ Токен ${tokenAddress} не подходит для покупки, пропускаем`);
          continue;
        }

        // Атомарно добавляем токен в processing
        currentlyProcessing.add(tokenAddress);
        setProcessingTokens(new Set(currentlyProcessing));
        processingTokensRef.current = new Set(currentlyProcessing);

        const priceData = await getTokenPrice(tokenAddress);
        const currentPrice = priceData.value;
        if (!initialPrices[tokenAddress]) {
          setInitialPrices((prev) => ({ ...prev, [tokenAddress]: currentPrice }));
          console.log(`Установлена начальная цена для токена ${tokenAddress}: ${currentPrice}`);

          // Удаляем из processing, так как покупка не состоялась
          currentlyProcessing.delete(tokenAddress);
          setProcessingTokens(new Set(currentlyProcessing));
          processingTokensRef.current = new Set(currentlyProcessing);
          continue;
        }

        setIsBuying(true);
        console.log('Начало покупки токена:', tokenAddress);

        try {
          const decimals = await getTokenDecimals(tokenAddress);
          let buyResponse;
          if (pool.dexId === 'pumpswap') {
            console.log(`🔄 Используем pumpfun для покупки ${tokenAddress}`);
            buyResponse = await apiPumpfunSwapToken(new PublicKey(tokenAddress), 0.001, 'buy'); // 0.11 SOL
          } else {
            console.log(`🔄 Используем raydium для покупки ${tokenAddress}`);
            buyResponse = await apibuyToken(new PublicKey(tokenAddress), 15000000); // 0.11 SOL
          }

          function isSwapCompute(response: any): response is SwapCompute {
            return response && 'data' in response;
          }
          if (!buyResponse) {
            console.error('Ошибка: данные о покупке отсутствуют');
            continue;
          }

          const solPrice = await getSOLPrice();
          let outputAmount: number;       // Сколько raw-токенов
          let inputAmount: number;        // Сколько SOL в лампортах
          let amountInTokens: number;     // Сколько нормализованных токенов
          let priceInSol: number;         // Цена в SOL	
          let buyPriceInUSD: number;      // Цена в USD
          let totalCost: number;          // Общая стоимость в USD

          if (isSwapCompute(buyResponse)) {
            // SwapCompute: нужно вручную нормализовать
            outputAmount = Number(buyResponse.data.outputAmount) / 1e9;
            inputAmount = Number(buyResponse.data.inputAmount);
            amountInTokens = outputAmount / Math.pow(10, decimals);
            priceInSol = (inputAmount / 1e9) / amountInTokens;
            buyPriceInUSD = priceInSol * solPrice || 210;
            totalCost = (inputAmount / 1e9) * solPrice || 210;

          } else {
            // SwapResponse: amountOut уже в токенах
            outputAmount = buyResponse.rate.amountOut;
            inputAmount = buyResponse.rate.amountIn;
            amountInTokens = buyResponse.rate.amountOut;
            buyPriceInUSD = buyResponse.rate.price.usd;
            priceInSol = buyResponse.rate.price.quote
            totalCost = buyPriceInUSD * outputAmount;
          }

          // Пример расчётов


          console.log(`Покупка ${tokenAddress}:`);
          console.log(`- inputAmount: ${inputAmount} SOL`);
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
            dexId: pool.dexId as 'raydium' | 'pumpswap',
          };
          savePurchasedTokensToLocalStorage(purchasedTokens);

          // Отправка данных на сервер
        try {
  if (!accessToken) {
    console.error('No access token available. User must log in.');
    return;
  }
  console.log('Sending token data to server:', purchasedTokens[tokenAddress]);
  const response = await api.post('/tokens', purchasedTokens[tokenAddress], {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  console.log(`Token data saved to server for ${tokenAddress}:`, response.data);
} catch (error) {
  console.error(`Error saving token data to server for ${tokenAddress}:`, error);
}

          // Обновляем историю покупок
          setPurchasedTokensHistory((prev) => {
            const newSet = new Set(prev).add(tokenAddress);
            savePurchasedTokensHistoryToLocalStorage(newSet);
            return newSet;
          });

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
          currentlyProcessing.delete(tokenAddress);
          setProcessingTokens(new Set(currentlyProcessing));
          processingTokensRef.current = new Set(currentlyProcessing);
        }
      }
    };

    if (!pools) return;
    console.log('work');
    buyTokens();
  }, [
    pools,
    isBuying,
    lastPurchaseTime,
    initialPrices
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
        const sellThreshold = buyPriceInUSD * 0.70;

        if (currentPrice <= buyPriceInUSD * 0.10) {
          delete purchasedTokens[tokenAddress];
          savePurchasedTokensToLocalStorage(purchasedTokens);
        }

        if (currentPrice >= buyPriceInUSD * 1.35) {
          console.log(`📈 Продаем ${tokenAddress} за ${currentPrice} USD (цена выросла на 30%)`);
          setIsSelling((prev) => ({ ...prev, [tokenAddress]: true }));

          const tokenData = purchasedTokens[tokenAddress];
          const sellAmountInSolLamports = calculateSellAmountInSolLamports(tokenData, priceInNative);
          console.log(`Продаем 95% токенов за ${sellAmountInSolLamports} лампортов SOL`);

          try {
            if (tokenData.dexId === 'pumpswap') {
              await apiPumpfunSwapToken(new PublicKey(tokenAddress), tokenData.amount, 'sell');
            } else {
              await apiSellToken(tokenAddress, sellAmountInSolLamports);
            }

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
            setPurchasedTokensHistory((prev) => {
              const newSet = new Set(prev).add(tokenAddress);
              savePurchasedTokensHistoryToLocalStorage(newSet);
              return newSet;
            });
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
          console.log(`📉 Продаем ${tokenAddress} за ${currentPrice} USD (цена упала на 20%)`);
          setIsSelling((prev) => ({ ...prev, [tokenAddress]: true }));

          const tokenData = purchasedTokens[tokenAddress];
          const sellAmountInSolLamports = calculateSellAmountInSolLamports(tokenData, priceInNative);

          try {
            if (tokenData.dexId === 'pumpswap') {
              await apiPumpfunSwapToken(new PublicKey(tokenAddress), tokenData.amount, 'sell');
            } else {
              await apiSellToken(tokenAddress, sellAmountInSolLamports);
            }
            delete purchasedTokens[tokenAddress];
            savePurchasedTokensToLocalStorage(purchasedTokens);

            const soldToken: SoldToken = {
              tokenAddress,
              buyPrice: buyPriceInUSD,
              sellPrice: currentPrice,
              profit: currentPrice - buyPriceInUSD,
              link: `https://dexscreener.com/solana/${tokenAddress}`,
              soldAtLoss: true,
            };

            setSoldTokens((prev) => [...prev, soldToken]);
            setSoldTokensHistory((prev) => new Set(prev).add(tokenAddress));
            setPurchasedTokensHistory((prev) => {
              const newSet = new Set(prev).add(tokenAddress);
              savePurchasedTokensHistoryToLocalStorage(newSet);
              return newSet;
            });
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
  }, [isSelling, purchasedTokens, soldTokens, soldTokensHistory]);

  return { prices, soldTokens };
};