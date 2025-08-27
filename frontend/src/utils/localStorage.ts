 

export const saveBuyPrice = (tokenAddress: string, price: number) => {
    const saved = JSON.parse(localStorage.getItem("buyPrices") || "{}");
    if (!saved[tokenAddress]) {
        saved[tokenAddress] = price;
        localStorage.setItem("buyPrices", JSON.stringify(saved));
    }
};

export const getBuyPrice = (tokenAddress: string): number | null => {
    const saved = JSON.parse(localStorage.getItem("buyPrices") || "{}");
    return saved[tokenAddress] ?? null;
};

export const clearBuyPrice = (tokenAddress: string) => {
    const saved = JSON.parse(localStorage.getItem("buyPrices") || "{}");
    delete saved[tokenAddress];
    localStorage.setItem("buyPrices", JSON.stringify(saved));
};
