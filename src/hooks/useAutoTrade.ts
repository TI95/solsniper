import { useEffect, useState } from "react";
import { usePools } from "./usePools";
import axios from "axios";
import { apibuyToken } from "../blockchain/raydium-buy-token";
import { apiSellToken } from "../blockchain/raydium-sell-token";
import { TokenPairProfile } from "../types/dex-screener-pair";
import { Connection, PublicKey } from "@solana/web3.js";
import { getMint } from '@solana/spl-token';
import { LiquidErrorRaydium } from "@/types/liquid-error-raydium";

// QuickNode endpoint
const QUICKNODE_ENDPOINT = 'https://stylish-falling-glade.solana-mainnet.quiknode.pro/01796c91dbb4b4e0a971e5fe3457980aed1ac4b9';
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

// Сохраняем purchasedTokens в localStorage
const savePurchasedTokensToLocalStorage = (tokens: Record<string, PurchasedToken>) => {
  localStorage.setItem("purchasedTokens", JSON.stringify(tokens));
};

// Загружаем purchasedTokens из localStorage
const loadPurchasedTokensFromLocalStorage = (): Record<string, PurchasedToken> => {
  const data = localStorage.getItem("purchasedTokens");
  return data ? JSON.parse(data) : {};
};

// Сохраняем purchasedTokensHistory в localStorage
const savePurchasedTokensHistoryToLocalStorage = (tokens: Set<string>) => {
  const tokensArray = Array.from(tokens); // Преобразуем Set в массив
  localStorage.setItem("purchasedTokensHistory", JSON.stringify(tokensArray));
};

// Загружаем purchasedTokensHistory из localStorage
const loadPurchasedTokensHistoryFromLocalStorage = (): Set<string> => {
  const data = localStorage.getItem("purchasedTokensHistory");
  if (data) {
    const tokensArray = JSON.parse(data) as string[]; // Преобразуем массив обратно в Set
    return new Set(tokensArray);
  }
  return new Set(); // Если данных нет, возвращаем пустой Set
};

// Сохраняем blacklistedTokens в localStorage
const saveBlacklistedTokensToLocalStorage = (tokens: Set<string>) => {
  const tokensArray = Array.from(tokens);
  localStorage.setItem("blacklistedTokens", JSON.stringify(tokensArray));
};

// Загружаем blacklistedTokens из localStorage
const loadBlacklistedTokensFromLocalStorage = (): Set<string> => {
  const data = localStorage.getItem("blacklistedTokens");
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
    loadPurchasedTokensHistoryFromLocalStorage() // Инициализация из localStorage
  );
  const [blacklistedTokens, setBlacklistedTokens] = useState<Set<string>>(loadBlacklistedTokensFromLocalStorage());
  const [isStarted, setIsStarted] = useState(false); // Состояние для отслеживания запуска
  const [isStopped, setIsStopped] = useState(false); // Состояние для отслеживания остановки
  const [initialPrices, setInitialPrices] = useState<Record<string, number>>({}); // Начальные цены токенов
  const solAddress = 'So11111111111111111111111111111111111111112';

  // Сохраняем purchasedTokensHistory в localStorage при изменении
  useEffect(() => {
    if (!isStarted || isStopped) return;

    savePurchasedTokensHistoryToLocalStorage(purchasedTokensHistory);
  }, [purchasedTokensHistory]);

  // Сохраняем blacklistedTokens в localStorage при изменении
  useEffect(() => {
    saveBlacklistedTokensToLocalStorage(blacklistedTokens);
  }, [blacklistedTokens]);

 /* const getTokenPrice = async (tokenAddress: string): Promise<number> => {
    try {
      const response = await axios.get(`https://api.dexscreener.com/tokens/v1/${tokenAddress}`);
      return response.data[0]?.priceUsd || 0;
    } catch (error) {
      console.error("❌ Ошибка получения цены:", error);
      return 0;
    }
  };
  */

  const getSOLPrice = async (): Promise<number> => {
    try {
      const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${solAddress}`);
      return response.data.pairs[0]?.priceUsd || 0;
    } catch (error) {
      console.error("❌ Ошибка получения цены SOL:", error);
      return 0;
    }
  };

  const getTokenDecimals = async (tokenAddress: string): Promise<number> => {
    const mintAccount = await getMint(connection, new PublicKey(tokenAddress));
    return mintAccount.decimals;
  };

  useEffect(() => {
    const buyTokens = async () => {
      if (!pools || isBuying || Object.keys(purchasedTokens).length >= 2) {
        console.log("Покупка заблокирована: нет pools, идет покупка или достигнут лимит токенов");
        return;
      }
  
      const nowInSeconds = Math.floor(Date.now() / 1000);
      const oneHourAgo = nowInSeconds - 60 * 60
      ;
  
      const uniquePools = pools.filter(
        (pool, index, self) =>
          index === self.findIndex((p) => p.baseToken.address === pool.baseToken.address)
      );
  
      const filteredPools = uniquePools.filter(
        (pool: TokenPairProfile) =>
          pool.chainId === "solana" &&
          pool.dexId === "raydium" &&
          pool.liquidity.usd >= 25000 &&
          pool.marketCap <= 1000000 &&
          pool.boosts.active >= 500 &&
          Math.floor(pool.pairCreatedAt / 1000) >= oneHourAgo
      );
      console.log(filteredPools);
  
      if (nowInSeconds - lastPurchaseTime < 30) {
        console.log("Слишком рано для покупки, осталось:", 30 - (nowInSeconds - lastPurchaseTime), "секунд");
        return;
      }
  
      // Итерируемся по всем пулам в filteredPools
      for (const pool of filteredPools) {
        if (Object.keys(purchasedTokens).length >= 2) {
          console.log("Достигнут лимит в 2 токена, покупка остановлена.");
          break;
        }
  
        const tokenAddress = pool.baseToken.address;
  
        // Проверяем, был ли токен уже куплен или в черном списке
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
  
        // Получаем текущую цену токена
        const currentPrice = await getTokenPrice(tokenAddress);
  
        // Если начальная цена не установлена, устанавливаем её
        if (!initialPrices[tokenAddress]) {
          setInitialPrices((prev) => ({ ...prev, [tokenAddress]: currentPrice }));
          console.log(`Установлена начальная цена для токена ${tokenAddress}: ${currentPrice}`);
          continue;
        }
  
        const initialPrice = initialPrices[tokenAddress];
  
        // Проверяем, упала ли цена на 20%
        if (currentPrice >= initialPrice * 0.8) {
          console.log(`❌ Цена токена ${tokenAddress} не упала на 20%, пропускаем покупку.`);
          continue;
        }
  
        const publicKey = new PublicKey(tokenAddress);
        setProcessingTokens((prev) => new Set(prev).add(tokenAddress));
        setIsBuying(true);
        console.log("Начало покупки токена:", tokenAddress);
  
        try {
          const decimals = await getTokenDecimals(tokenAddress);
          const buyResponse = await apibuyToken(publicKey, 110000000);
  
          if (!buyResponse || !buyResponse.data) {
            console.error("Ошибка: данные о покупке отсутствуют");
            continue;
          }
  
          const outputAmount = Number(buyResponse.data.outputAmount);
          const inputAmount = Number(buyResponse.data.inputAmount);
          const solPrice = await getSOLPrice();
          const amountInTokens = outputAmount / Math.pow(10, decimals);
          const totalCost = (inputAmount / 1e9) * solPrice;
          const buyPriceInUSD = totalCost / amountInTokens;
  
          purchasedTokens[tokenAddress] = {
            totalCost,
            amount: amountInTokens,
            amountInLamports: outputAmount,
            decimals,
            buyPriceInUSD,
          };
          savePurchasedTokensToLocalStorage(purchasedTokens);
          setPurchasedTokensHistory((prev) => new Set(prev).add(tokenAddress)); // Добавляем токен в историю купленных
          console.log(`✅ Купили ${tokenAddress} по цене ${buyPriceInUSD} USD, количество: ${amountInTokens}`);
          setLastPurchaseTime(nowInSeconds);
        } catch (error) {
          console.error("Ошибка при покупке токена:", error);
  
          // Если ошибка связана с недействительным токен-аккаунтом
          if (error instanceof Error && error.message.includes("TokenInvalidAccountOwnerError")) {
            console.log(`❌ Токен ${tokenAddress} недействителен, добавляем в черный список.`);
            setBlacklistedTokens((prev) => {
              const newSet = new Set(prev).add(tokenAddress);
              saveBlacklistedTokensToLocalStorage(newSet); // Сохраняем в localStorage
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
  }, [pools, soldTokens, processingTokens, isBuying, lastPurchaseTime, soldTokensHistory, purchasedTokensHistory, isStarted, isStopped, blacklistedTokens, initialPrices]);
 
  useEffect(() => {
    const sellTokens = async () => {
      for (const tokenAddress of Object.keys(purchasedTokens)) {
        if (isSelling[tokenAddress]) {
          console.log(`Продажа токена ${tokenAddress} уже идет, пропускаем.`);
          continue;
        }
  
        const currentPrice = await getTokenPrice(tokenAddress);
        setPrices((prev) => ({ ...prev, [tokenAddress]: currentPrice }));
  
        const buyPriceInUSD = purchasedTokens[tokenAddress].buyPriceInUSD;
  
        console.log(`Текущая цена: ${currentPrice}, Цена покупки: ${buyPriceInUSD}`);
        
        if(!pools) return
        const tokenPool = pools.find((pool) => pool.baseToken.address === tokenAddress);
        const boosts = tokenPool?.boosts?.active 
        console.log(boosts)
    
        // Определяем количество для продажи в зависимости от бустов
        //const sellAmount = boosts === 0 ? 275000000 : 77000;
        // Проверяем, что цена всё ещё соответствует условиям
        if (currentPrice >= buyPriceInUSD * 1.35) {
          console.log(`📈 Продаем ${tokenAddress} за ${currentPrice} (цена выше целевой)`);
          setIsSelling((prev) => ({ ...prev, [tokenAddress]: true }));
  
          const tokenData = purchasedTokens[tokenAddress]; // Сохраняем данные токена
  
          try {
            await apiSellToken(tokenAddress, 143000000);
  
            // Если продажа успешна, удаляем токен
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
            setSoldTokensHistory((prev) => new Set(prev).add(tokenAddress)); // Добавляем токен в историю проданных
          } catch (error) {
            console.error("❌ Ошибка при продаже токена:", error);
  
            if ((error as LiquidErrorRaydium).msg?.includes("INSUFFICIENT_LIQUIDITY")) {
              console.log(`❌ Токен ${tokenAddress} не может быть продан из-за недостатка ликвидности, удаляем из списка.`);
              delete purchasedTokens[tokenAddress];
              savePurchasedTokensToLocalStorage(purchasedTokens);
            } else if (error instanceof Error && error.message.includes("TransactionExpiredBlockheightExceededError")) {
              console.log(`❌ Транзакция истекла, токен ${tokenAddress} не продан.`);
              // Восстанавливаем токен в purchasedTokens
              purchasedTokens[tokenAddress] = tokenData;
              savePurchasedTokensToLocalStorage(purchasedTokens);
            } else {
              console.log(`❌ Неизвестная ошибка при продаже токена ${tokenAddress}.`);
              // Восстанавливаем токен в purchasedTokens
              purchasedTokens[tokenAddress] = tokenData;
              savePurchasedTokensToLocalStorage(purchasedTokens);
            }
          } finally {
            setIsSelling((prev) => ({ ...prev, [tokenAddress]: false }));
          }
        } else if (currentPrice <= buyPriceInUSD * 0.70) {
          console.log(`📉 Продаем ${tokenAddress} за ${currentPrice} (цена упала на 30% от покупки)`);
          setIsSelling((prev) => ({ ...prev, [tokenAddress]: true }));
  
          const tokenData = purchasedTokens[tokenAddress]; // Сохраняем данные токена
  
          try {
            const reduceSellAmount = Math.floor(7150000)
            await apiSellToken(tokenAddress, reduceSellAmount);
  
            // Если продажа успешна, удаляем токен
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
            setSoldTokensHistory((prev) => new Set(prev).add(tokenAddress)); // Добавляем токен в историю проданных
          } catch (error) {
            console.error("❌ Ошибка при продаже токена:", error);
  
            if ((error as LiquidErrorRaydium).msg?.includes("INSUFFICIENT_LIQUIDITY")) {
              console.log(`❌ Токен ${tokenAddress} не может быть продан из-за недостатка ликвидности, удаляем из списка.`);
              delete purchasedTokens[tokenAddress];
              savePurchasedTokensToLocalStorage(purchasedTokens);
            } else if (error instanceof Error && error.message.includes("TransactionExpiredBlockheightExceededError")) {
              console.log(`❌ Транзакция истекла, токен ${tokenAddress} не продан.`);
              // Восстанавливаем токен в purchasedTokens
              purchasedTokens[tokenAddress] = tokenData;
              savePurchasedTokensToLocalStorage(purchasedTokens);
            } else {
              console.log(`❌ Неизвестная ошибка при продаже токена ${tokenAddress}.`);
              // Восстанавливаем токен в purchasedTokens
              purchasedTokens[tokenAddress] = tokenData;
              savePurchasedTokensToLocalStorage(purchasedTokens);
            }
          } finally {
            setIsSelling((prev) => ({ ...prev, [tokenAddress]: false }));
          }
        } else {
          console.log(`❌ Цена токена ${tokenAddress} не соответствует условиям, пропускаем продажу.`);
        }
      }
    };
  
    const interval = setInterval(sellTokens, 5000); // Проверяем каждые 5 секунд
    return () => clearInterval(interval);
  }, [isSelling, purchasedTokens, soldTokens, soldTokensHistory, isStarted, isStopped]);

  // Функция для запуска логики
  const startAutoTrade = () => {
    setIsStarted(true);
    setIsStopped(false); // Сбрасываем флаг остановки
  };

  // Функция для остановки логики
  const stopAutoTrade = () => {
    setIsStopped(true);
  };

  return { prices, soldTokens, startAutoTrade, stopAutoTrade };
};