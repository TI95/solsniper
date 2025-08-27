export type TokenProfile = {
  url: string;
  chainId: string;
  tokenAddress: string;
  icon: string;
  header: string;
  description: string;
  links: Link[];
};

type Link = {
  type: string;
  label: string;
  url: string;
};