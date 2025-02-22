import { useAutoTrade } from "../hooks/useAutoTrade";

const AutoTradeComponent = () => {
  const { prices, soldTokens} = useAutoTrade();

  return (
    <div>
   
      <h1>Auto Trade Bot</h1>
      
      <h2>Текущие цены токенов:</h2>
      <ul>
        {Object.entries(prices).map(([tokenAddress, price]) => (
          <li key={tokenAddress}>
            <strong>{tokenAddress} : ${price}</strong>
          </li>
        ))}
      </ul>

      <h2>Проданные токены:</h2>
      <ul>
        {soldTokens.map((soldToken, index) => (
          <li key={index}>
            <strong>{soldToken.tokenAddress}</strong>
            <ul>
            
              <li>Цена покупки: ${soldToken.buyPrice}</li>
              <li>Цена продажи: ${soldToken.sellPrice}</li>
              <li>Профит: ${soldToken.profit.toFixed(2)}</li>
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AutoTradeComponent;