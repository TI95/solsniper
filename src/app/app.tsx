import AutoTradeComponent from '@/components/AutoTradePrices';
import CoinsList from '@/components/CoinsList';

 
const App: React.FC = () => {
  
  return (
    <div>
      <h1>Sniper Bot</h1>
      <CoinsList/>
      <AutoTradeComponent/>
    </div>
  );
};


export default App
