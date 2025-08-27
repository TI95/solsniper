export type BoostedToken = {
  url: string;
  chainId: 'solana' | 'bsc' | 'base'; // Ограниченный набор значений
  tokenAddress: string;
  icon?: string;
  header?: string;
  openGraph: string;
  description?: string;
  links?: BoostedTokenLink[];
  totalAmount: number;
  amount: number;
};

interface BoostedTokenLink {
  label?: string; // Например, "Website", "Video", "Docs"
  type?: string;  // Например, "twitter", "telegram"
  url: string;    // Обязательное поле
}