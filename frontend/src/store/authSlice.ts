import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from './index';

// тип пользователя
export interface User {
  email: string;
  isActivated: boolean;
}

// тип состояния
interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  error: string | null;
  registered: boolean;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  isLoading: false,
  error: null,
  registered: false,
};

// axios instance
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000/api',
  withCredentials: true, // чтобы refreshToken хранился в cookie

});

// thunks
export const login = createAsyncThunk<
  { accessToken: string; user: User },
  { email: string; password: string },
  { rejectValue: string }
>('auth/login', async (data, thunkAPI) => {
  console.log('Sending login request with:', data, 'withCredentials:', api.defaults.withCredentials);
  try {
    const response = await api.post<{ accessToken: string; user: User }>('/login', data);
    console.log('Login response:', response.data);
    return response.data;
  } catch (e: any) {
    console.error('Login error:', e);
    return thunkAPI.rejectWithValue(e.response?.data?.message || 'Login error');
  }
});


export const registration = createAsyncThunk<
  { accessToken: string; user: User },
  { email: string; password: string },
  { rejectValue: string }
>('auth/registration', async (data, thunkAPI) => {
  try {
    const response = await api.post<{ accessToken: string; user: User }>('/registration', data);
    return response.data;
  } catch (e: any) {
    return thunkAPI.rejectWithValue(e.response?.data?.message || 'Registration error');
  }
});

export const logout = createAsyncThunk<void, void, { rejectValue: string }>(
  'auth/logout',
  async (_, thunkAPI) => {
    try {
      await api.post('/logout');
    } catch (e: any) {
      return thunkAPI.rejectWithValue(e.response?.data?.message || 'Logout error');
    }
  }
);

export const checkAuth = createAsyncThunk<
  { accessToken: string; user: User },
  void,
  { rejectValue: string }
>('auth/refresh', async (_, thunkAPI) => {
  try {
    const response = await api.get<{ accessToken: string; user: User }>('/refresh');
    return response.data;
  } catch (e: any) {
    return thunkAPI.rejectWithValue(e.response?.data?.message || 'Auth check error');
  }
});
// slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    // login
    builder.addCase(login.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(login.fulfilled, (state, action) => {
      state.isLoading = false;
      state.accessToken = action.payload.accessToken;
      state.user = action.payload.user;
    });
    builder.addCase(login.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload || 'Login failed';
    });

    // registration
    builder.addCase(registration.fulfilled, (state, action) => {
      state.isLoading = false;
      state.registered = true; // пользователь зарегистрирован
      state.error = null;
     
    });
    builder.addCase(registration.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload || 'Registration failed';
    });

    // logout
    builder.addCase(logout.fulfilled, (state) => {
      state.accessToken = null;
      state.user = null;
    });

    // checkAuth
    builder.addCase(checkAuth.fulfilled, (state, action) => {
      state.accessToken = action.payload.accessToken;
      state.user = action.payload.user;
    });
  },
});

export default authSlice.reducer;

// селекторы
export const selectAuth = (state: RootState) => state.auth;
