import { useEffect, useState } from "react";
import { usePools } from "./usePools";
import axios from "axios";
import { apibuyToken } from "../blockchain/raydium-buy-token";
import { apiSellToken } from "../blockchain/raydium-sell-token";
import { TokenPairProfile } from "../types/dex-screener-pair";
import { Connection, PublicKey } from "@solana/web3.js";
import { getMint } from '@solana/spl-token';
import { LiquidErrorRaydium } from "@/types/liquid-error-raydium";

// Укажите ваш QuickNode endpoint
const QUICKNODE_ENDPOINT = 'https://stylish-falling-glade.solana-mainnet.quiknode.pro/01796c91dbb4b4e0a971e5fe3457980aed1ac4b9';
const connection = new Connection(QUICKNODE_ENDPOINT);

interface PurchasedToken {
  totalCost: number; // Общая стоимость покупки в USD
  amount: number;    // Количество купленных токенов
  amountInLamports: number; // Количество токенов в лампасдах
  decimals: number; // Количество знаков после запятой
  buyPriceInUSD: number; // Цена покупки токена в USD
}

interface SoldToken {
  tokenAddress: string;
  buyPrice: number;  // Цена покупки
  sellPrice: number; // Цена продажи
  profit: number;    // Профит
}

const savePurchasedTokensToLocalStorage = (tokens: Record<string, PurchasedToken>) => {
  localStorage.setItem("purchasedTokens", JSON.stringify(tokens));
};

const loadPurchasedTokensFromLocalStorage = (): Record<string, PurchasedToken> => {
  const data = localStorage.getItem("purchasedTokens");
  return data ? JSON.parse(data) : {};
};

const purchasedTokens: Record<string, PurchasedToken> = loadPurchasedTokensFromLocalStorage();

export const useAutoTrade = () => {


  const pools = usePools();  
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [soldTokens, setSoldTokens] = useState<SoldToken[]>([]); // Состояние для проданных токенов
  const [isBuying, setIsBuying] = useState(false);
  const [lastPurchaseTime, setLastPurchaseTime] = useState<number>(0);
  const [isSelling, setIsSelling] = useState<Record<string, boolean>>({});
  const solAddress = 'So11111111111111111111111111111111111111112';

  const getTokenPrice = async (tokenAddress: string): Promise<number> => {
    try {
      const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
      return response.data.pairs[0]?.priceUsd || 0;
    } catch (error) {
      console.error("❌ Ошибка получения цены:", error);
      return 0;
    }
  };

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
    // Получаем данные mint-аккаунта
    const mintAccount = await getMint(connection, new PublicKey(tokenAddress));
    console.log(mintAccount.decimals);
    return mintAccount.decimals; // Возвращаем количество знаков после запятой
  };

  useEffect(() => {
    const buyTokens = async () => {
      if (!pools || isBuying || Object.keys(purchasedTokens).length >= 2) return;
  
      const nowInSeconds = Math.floor(Date.now() / 1000);
      const oneHourAgo = nowInSeconds - 60*30; // 1 час = 3600 секунд
  
      // Убираем дубликаты токенов
      const uniquePools = pools.filter(
        (pool, index, self) =>
          index === self.findIndex((p) => p.baseToken.address === pool.baseToken.address)
      );
  
      const filteredPools = uniquePools.filter(
        (pool: TokenPairProfile) =>
          pool.chainId === "solana" &&
          pool.dexId === "raydium" &&
          pool.liquidity.usd >= 30000 &&
          pool.liquidity.usd <= 110000 &&
          Math.floor(pool.pairCreatedAt / 1000) >= oneHourAgo
      );
  
      // Покупка не чаще чем раз в 30 секунд
      if (nowInSeconds - lastPurchaseTime < 30) return;
  
      if (filteredPools.length > 0) {
        const pool = filteredPools[0];
        const tokenAddress = pool.baseToken.address;
  
        // Проверяем, был ли токен уже куплен
        if (purchasedTokens[tokenAddress]) {
          console.log(`Токен ${tokenAddress} уже куплен, пропускаем.`);
          return;
        }
  
        const publicKey = new PublicKey(tokenAddress);
  
        // Устанавливаем флаг, что покупка началась
        setIsBuying(true);
  
        try {
          // Получаем Decimals для токена
          const decimals = await getTokenDecimals(tokenAddress);
  
          // Покупаем токен и получаем ответ
          const buyResponse = await apibuyToken(publicKey, 200000); // Покупаем на 2000 лампасдов SOL
  
          // Проверяем, что buyResponse содержит data
          if (!buyResponse || !buyResponse.data) {
            console.error("Ошибка: данные о покупке отсутствуют");
            return;
          }
  
          const outputAmount = Number(buyResponse.data.outputAmount);
          const inputAmount = Number(buyResponse.data.inputAmount); // Количество потраченных лампасдов SOL
  
          // Получаем текущую цену SOL
          const solPrice = await getSOLPrice();
  
          // Конвертируем лампасды в токены с учетом Decimals
          const amountInTokens = outputAmount / Math.pow(10, decimals);
  
          // Рассчитываем общую стоимость покупки в USD
          const totalCost = (inputAmount / 1e9) * solPrice; // 1e9 — это 1 миллиард лампасдов (1 SOL)
  
          // Рассчитываем цену за 1 токен в USD
          const buyPriceInUSD = totalCost / amountInTokens;
  
          // Добавляем токен в purchasedTokens ДО завершения транзакции
          purchasedTokens[tokenAddress] = {
            totalCost, // Общая стоимость покупки в USD
            amount: amountInTokens, // Количество токенов
            amountInLamports: outputAmount, // Количество токенов в лампасдах
            decimals, // Сохраняем Decimals для токена
            buyPriceInUSD, // Цена покупки токена в USD
          };
  
          savePurchasedTokensToLocalStorage(purchasedTokens);
          console.log(`✅ Купили ${tokenAddress} по цене ${buyPriceInUSD} USD, количество: ${amountInTokens}`);
  
          setLastPurchaseTime(nowInSeconds);
        } catch (error) {
          console.error("Ошибка при покупке токена:", error);
  
          // Если покупка не удалась, удаляем токен из purchasedTokens
          delete purchasedTokens[tokenAddress];
          savePurchasedTokensToLocalStorage(purchasedTokens);
        } finally {
          // Снимаем флаг после завершения покупки
          setIsBuying(false);
        }
      }
    };
  
    buyTokens();
  }, [pools, isBuying, lastPurchaseTime]);


  useEffect(() => {
    const sellTokens = async () => {
      for (const tokenAddress of Object.keys(purchasedTokens)) {
        // Если продажа уже идет, пропускаем этот токен
        if (isSelling[tokenAddress]) {
          console.log(`Продажа токена ${tokenAddress} уже идет, пропускаем.`);
          continue;
        }
  
        const currentPrice = await getTokenPrice(tokenAddress);
        setPrices((prev) => ({ ...prev, [tokenAddress]: currentPrice }));
  
        // Получаем цену покупки токена в USD
        const buyPriceInUSD = purchasedTokens[tokenAddress].buyPriceInUSD;
  
        console.log(`Текущая цена: ${currentPrice}, Цена покупки: ${buyPriceInUSD}`);
  
        if (currentPrice >= buyPriceInUSD * 1.15) {
          console.log(`📈 Продаем ${tokenAddress} за ${currentPrice}`);
  
          // Устанавливаем флаг, что продажа началась
          setIsSelling((prev) => ({ ...prev, [tokenAddress]: true }));
  
          // Удаляем токен из purchasedTokens ДО начала продажи
          const tokenData = purchasedTokens[tokenAddress];
          delete purchasedTokens[tokenAddress];
          savePurchasedTokensToLocalStorage(purchasedTokens);
  
          try {
            // Используем amountToSell для продажи
            await apiSellToken(tokenAddress, 248000);
  
            const soldToken: SoldToken = {
              tokenAddress,
              buyPrice: buyPriceInUSD,
              sellPrice: currentPrice,
              profit: currentPrice - buyPriceInUSD,
            };
  
            setSoldTokens((prev) => [...prev, soldToken]);
          } catch (error) {
            console.error("❌ Ошибка при продаже токена:", error);
  
            // Если ошибка связана с недостатком ликвидности, удаляем токен
            if ((error as LiquidErrorRaydium).msg && (error as LiquidErrorRaydium).msg.includes("INSUFFICIENT_LIQUIDITY")) {
              console.log(`❌ Токен ${tokenAddress} не может быть продан из-за недостатка ликвидности, удаляем из списка.`);
            } else {
              // Если ошибка другая, возвращаем токен в purchasedTokens
              purchasedTokens[tokenAddress] = tokenData;
              savePurchasedTokensToLocalStorage(purchasedTokens);
            }
          } finally {
            // Снимаем флаг после завершения продажи
            setIsSelling((prev) => ({ ...prev, [tokenAddress]: false }));
          }
        }
      }
    };
  
    const interval = setInterval(sellTokens, 1000); // Проверяем каждую секунду
    return () => clearInterval(interval);
  }, [isSelling]); // Добавляем зависимости

  return { prices, soldTokens }; // Возвращаем и цены, и проданные токены
};