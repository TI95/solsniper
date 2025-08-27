export type SoldToken = {
    tokenAddress: string;
    buyPrice: number;
    sellPrice: number;
    profit: number;
    link: string;
    soldAtLoss?: boolean;
}
