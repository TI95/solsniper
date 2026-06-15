import { Keypair } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import { TRADING } from '../config/trading-config';
import { fetchCandidates } from '../services/dexscreener-service';
import { passesFilter, dedupeByBaseToken, dexIdOf } from '../services/filter';
import { getTokenPrice, getSOLPrice } from '../services/birdeye-service';
import { getConnection } from '../blockchain/connection';
import { raydiumBuy, raydiumSell, LiquidErrorRaydium, RaydiumSwapCompute } from '../blockchain/raydium';
import { pumpfunSwap } from '../blockchain/pumpfun';
import positionService from '../services/position-service';
import walletService from '../services/wallet-service';
import { TradeReason } from '../models/trade-model';

export type SellAction = 'take_profit' | 'stop_loss' | 'dust' | 'hold';

/** Pure decision: given buy & current price, what to do. */
export function sellDecision(buyPriceUSD: number, currentPriceUSD: number): SellAction {
  if (currentPriceUSD <= buyPriceUSD * TRADING.DUST_MULT) return 'dust';
  if (currentPriceUSD >= buyPriceUSD * TRADING.TAKE_PROFIT_MULT) return 'take_profit';
  if (currentPriceUSD <= buyPriceUSD * TRADING.STOP_LOSS_MULT) return 'stop_loss';
  return 'hold';
}

async function getDecimals(tokenAddress: string): Promise<number> {
  const mint = await getMint(getConnection(), new PublicKey(tokenAddress));
  return mint.decimals;
}

/** Run one buy pass for a user (respects position cap + cooldown via lastBuyAt map). */
export async function runBuyPass(userId: string, owner: Keypair, lastBuyAt: { value: number }) {
  if ((await positionService.countOpen(userId)) >= TRADING.MAX_OPEN_POSITIONS) return;

  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec - lastBuyAt.value < TRADING.BUY_COOLDOWN_SEC) return;

  const candidates = dedupeByBaseToken(await fetchCandidates()).filter((c) =>
    passesFilter(c, Date.now())
  );

  for (const c of candidates) {
    const tokenAddress = c.baseToken.address;
    if (await positionService.hasOpenForToken(userId, tokenAddress)) continue;
    if ((await positionService.countOpen(userId)) >= TRADING.MAX_OPEN_POSITIONS) break;

    const dexId = dexIdOf(c);
    try {
      const decimals = await getDecimals(tokenAddress);
      const solPrice = await getSOLPrice();
      let amountTokens: number;
      let amountRaw: number;
      let buyPriceUSD: number;
      let buyPriceSOL: number;
      let totalCostUSD: number;

      if (dexId === 'pumpswap') {
        await pumpfunSwap(owner, tokenAddress, TRADING.BUY_AMOUNT_SOL, 'buy');
        // pumpfun does not return amounts; price from Birdeye, amount approximated from cost
        const price = await getTokenPrice(tokenAddress);
        buyPriceUSD = price.value || 0;
        buyPriceSOL = price.priceInNative || 0;
        totalCostUSD = TRADING.BUY_AMOUNT_SOL * solPrice;
        amountTokens = buyPriceUSD > 0 ? totalCostUSD / buyPriceUSD : 0;
        amountRaw = Math.floor(amountTokens * Math.pow(10, decimals));
      } else {
        const lamports = Math.floor(TRADING.BUY_AMOUNT_SOL * 1e9);
        const resp: RaydiumSwapCompute = await raydiumBuy(owner, tokenAddress, lamports);
        const outputAmount = Number(resp.data.outputAmount) / 1e9;
        const inputAmount = Number(resp.data.inputAmount);
        amountTokens = outputAmount / Math.pow(10, decimals);
        amountRaw = outputAmount;
        buyPriceSOL = inputAmount / 1e9 / amountTokens;
        buyPriceUSD = buyPriceSOL * solPrice;
        totalCostUSD = (inputAmount / 1e9) * solPrice;
      }

      await positionService.openPosition(userId, {
        tokenAddress,
        dexId,
        amount: amountTokens,
        amountRaw,
        decimals,
        buyPriceUSD,
        buyPriceSOL,
        totalCostUSD,
        txId: 'buy',
      });
      lastBuyAt.value = nowSec;
      console.log(`✅ [${userId}] bought ${tokenAddress} @ $${buyPriceUSD} via ${dexId}`);
      break; // one buy per pass
    } catch (e) {
      console.error(`[${userId}] buy error for ${tokenAddress}:`, e);
    }
  }
}

function sellLamports(amountRaw: number, decimals: number, priceInNative: number): number {
  const raw = amountRaw * TRADING.SELL_FRACTION;
  const tokens = raw / Math.pow(10, decimals);
  return Math.floor(tokens * priceInNative * 1e9);
}

/** Run one sell/price pass over the user's open positions. */
export async function runSellPass(userId: string, owner: Keypair) {
  const positions = await positionService.getOpenPositions(userId);
  for (const pos of positions) {
    const price = await getTokenPrice(pos.tokenAddress);
    const action = sellDecision(pos.buyPriceUSD, price.value);
    if (action === 'hold') continue;

    if (action === 'dust') {
      await positionService.closePosition(pos.id, price.value, 'dust', '');
      continue;
    }

    try {
      let txId = '';
      if (pos.dexId === 'pumpswap') {
        txId = await pumpfunSwap(owner, pos.tokenAddress, Math.floor(pos.amount), 'sell');
      } else {
        const lamports = sellLamports(pos.amountRaw, pos.decimals, price.priceInNative);
        txId = await raydiumSell(owner, pos.tokenAddress, lamports);
      }
      await positionService.closePosition(pos.id, price.value, action as TradeReason, txId);
      console.log(`💸 [${userId}] sold ${pos.tokenAddress} (${action}) @ $${price.value}`);
    } catch (e) {
      if (e instanceof LiquidErrorRaydium) {
        await positionService.closePosition(pos.id, price.value, action as TradeReason, '');
        console.log(`[${userId}] ${pos.tokenAddress} closed on insufficient liquidity`);
      } else {
        console.error(`[${userId}] sell error for ${pos.tokenAddress}:`, e);
      }
    }
  }
}

export async function loadOwner(userId: string): Promise<Keypair | null> {
  return walletService.loadKeypair(userId);
}
