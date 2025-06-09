import React from 'react';
import { KindeProvider } from '@kinde-oss/kinde-auth-react';
import { Route, Routes, Link } from 'react-router-dom'; // Убираем BrowserRouter
import Dashboard from './../pages/Dashboard';
import LoginPage from './../pages/LoginPage';

const App: React.FC = () => {
  return (
    <KindeProvider
      clientId={import.meta.env.VITE_KINDE_CLIENT_ID}
      domain={import.meta.env.VITE_KINDE_DOMAIN}
      redirectUri="http://localhost:5173/callback"
      logoutUri="http://localhost:5173"
    >
      <div className="w-7xl">

        <nav className="text-center mb-4 flex justify-between mb-25 items-center">
          <h1 className="text-5xl text-center">Sniper Bot 🔫</h1>
          <div>
            <Link to="/" className="mr-4">Главная</Link>
            <Link to="/dashboard">Дашборд</Link>
          </div>

        </nav>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/callback" element={<div>Загрузка...</div>} />
        </Routes>
      </div>
    </KindeProvider>
  );
};

export default App;