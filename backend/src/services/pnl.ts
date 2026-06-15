/** Realized PnL in USD for a closed (partial or full) position. */
export function realizedPnlUSD(buyPriceUSD: number, sellPriceUSD: number, amount: number): number {
  return (sellPriceUSD - buyPriceUSD) * amount;
}
