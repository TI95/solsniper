import React, { useEffect } from 'react';
import { LoginLink, RegisterLink, LogoutLink } from '@kinde-oss/kinde-auth-react/components';
import { useKindeAuth } from '@kinde-oss/kinde-auth-react';

const LoginPage: React.FC = () => {
  const { isAuthenticated, user, getToken } = useKindeAuth();

  useEffect(() => {
    const sendUserDataToBackend = async () => {
      if (isAuthenticated && user) {
        try {
          const token = await getToken(); // Получаем access token
          const response = await fetch('http://localhost:3000/api/auth/sync-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              email: user.email,
              id: user.id
            })
          });
          
          const data = await response.json();
          console.log('User synced:', data);
        } catch (error) {
          console.error('Error syncing user:', error);
        }
      }
    };
  
    sendUserDataToBackend();
  }, [isAuthenticated, user]);
  return (
    <div className="text-center">
      <h2 className="text-2xl mb-4">Добро пожаловать в Sniper Bot</h2>

      {isAuthenticated ? (
        // Показываем, если пользователь авторизован
        <div className="mb-4">
          <p>Вы успешно вошли в систему!</p>
          <p>Теперь вы можете начать торговлю.</p>
          <LogoutLink className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 mt-4 inline-block">
            Выйти
          </LogoutLink>
        </div>
      ) : (
        // Показываем, если пользователь не авторизован
        <>
          <p className="mb-4">Пожалуйста, войдите или зарегистрируйтесь, чтобы начать торговлю.</p>
          <div className="space-x-4">
            <LoginLink className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
              Войти
            </LoginLink>
            <RegisterLink className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
              Зарегистрироваться
            </RegisterLink>
          </div>
        </>
      )}
    </div>
  );
};

export default LoginPage;