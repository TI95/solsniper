export type TokenPrice = {
    "data": {
      "value": number,
      "updateUnixTime": number,
      "updateHumanTime": string,
      "priceChange24h": number,
      "priceInNative":number
    },
    "success": boolean
  }