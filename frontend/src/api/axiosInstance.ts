import axios from 'axios';
import { checkAuth, resetAuthState } from '../store/authSlice';

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
    
    // Пропускаем обработку для определенных URL
    const skipUrls = ['/refresh', '/login', '/logout'];
    if (skipUrls.some(url => originalRequest.url.includes(url))) {
      return Promise.reject(error);
    }

    const state = store?.getState();
    const isAuthenticated = state?.auth?.isAuthenticated;
    const isLoggingOut = state?.auth?.isLoggingOut;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      isAuthenticated &&
      !isLoggingOut
    ) {
      originalRequest._retry = true;
      try {
        console.log('axiosInstance: Attempting to refresh token');
        const { accessToken } = await store.dispatch(checkAuth()).unwrap();
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        console.error('axiosInstance: Failed to refresh token');
        store?.dispatch(resetAuthState());
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;