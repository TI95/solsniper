import axios from 'axios';
import { checkAuth } from '../store/authSlice';

let store: any;

export const setStore = (reduxStore: any) => {
  store = reduxStore;
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as any;
    const isAuthenticated = store?.getState()?.auth?.isAuthenticated;
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url !== '/refresh' &&
      originalRequest.url !== '/login' &&
      isAuthenticated
    ) {
      originalRequest._retry = true;
      try {
        if (!store) {
          console.error('Redux store is not initialized');
          throw new Error('Redux store is not initialized');
        }
        console.log('Access token expired, refreshing...');
        const { accessToken } = await store.dispatch(checkAuth()).unwrap();
        console.log('New access token received:', accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        console.error('Failed to refresh token:', refreshError);
        store?.dispatch({ type: 'auth/resetAuthState' });
        return Promise.reject(refreshError);
      }
    }
    console.error('Request failed:', error.response?.status, error.response?.data);
    return Promise.reject(error);
  }
);

export default api;