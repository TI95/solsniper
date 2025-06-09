export type SwapResponse = {
  txn: string;
  rate: {
    amountIn: number;
    amountOut: number;
    minAmountOut: number;
    currentPrice: number;
    executionPrice: number;
    priceImpact: number;
 price: { quote: number, usd: number },
    fee: number;
    baseCurrency: {
      mint: string;
      decimals: number;
    };
    quoteCurrency: {
      mint: string;
      decimals: number;
    };
    platformFee: number;
    platformFeeUI: number;
  };
  timeTaken: number;
  type: 'legacy' | 'v0';
}