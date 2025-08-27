import { TokenItem } from "./birdete-token-item";

export type NewListedTokens = {

    success: boolean;
    data: {
      items: TokenItem[];
    };
  };
