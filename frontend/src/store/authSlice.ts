import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../api/axiosInstance';
import { RootState } from './index';

export interface User {
  email: string;
  isActivated: boolean;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  registered: boolean;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  registered: false,
};

export const login = createAsyncThunk<
  { accessToken: string; refreshToken: string; user: User },
  { email: string; password: string },
  { rejectValue: string }
>('auth/login', async (data, thunkAPI) => {
  try {
    const response = await api.post<{ accessToken: string; refreshToken: string; user: User }>('/login', data);
    console.log('Login response:', response.data);
    return response.data;
  } catch (e: any) {
    console.error('Login error:', e);
    return thunkAPI.rejectWithValue(e.response?.data?.message || 'Login error');
  }
});

export const registration = createAsyncThunk<
  { accessToken: string; refreshToken: string; user: User },
  { email: string; password: string },
  { rejectValue: string }
>('auth/registration', async (data, thunkAPI) => {
  try {
    const response = await api.post<{ accessToken: string; refreshToken: string; user: User }>('/registration', data);
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
      return;
    } catch (e: any) {
      console.error('Logout error:', e);
      return thunkAPI.rejectWithValue(e.response?.data?.message || 'Logout error');
    }
  }
);

export const checkAuth = createAsyncThunk<
  { accessToken: string; refreshToken: string; user: User },
  void,
  { rejectValue: string }
>('auth/refresh', async (_, thunkAPI) => {
  try {
    const response = await api.get<{ accessToken: string; refreshToken: string; user: User }>('/refresh');
    console.log('CheckAuth response:', response.data);
    return response.data;
  } catch (e: any) {
    console.error('CheckAuth error:', e);
    return thunkAPI.rejectWithValue(e.response?.data?.message || 'Auth check error');
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    resetAuthState(state) {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.error = null;
      state.registered = false;
      state.isLoading = false;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(login.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(login.fulfilled, (state, action) => {
      state.isLoading = false;
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.user = action.payload.user;
      state.isAuthenticated = true;
    });
    builder.addCase(login.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload || 'Login failed';
    });

    builder.addCase(registration.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(registration.fulfilled, (state, action) => {
      state.isLoading = false;
      state.registered = true;
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.user = action.payload.user;
      state.isAuthenticated = true;
    });
    builder.addCase(registration.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload || 'Registration failed';
    });

    builder.addCase(logout.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(logout.fulfilled, (state) => {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.error = null;
      state.registered = false;
      state.isLoading = false;
    });
    builder.addCase(logout.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload || 'Logout failed';
    });

    builder.addCase(checkAuth.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(checkAuth.fulfilled, (state, action) => {
      state.isLoading = false;
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.user = action.payload.user;
      state.isAuthenticated = true;
    });
    builder.addCase(checkAuth.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload || 'Auth check failed';
      state.isAuthenticated = false;
    });
  },
});

export const { resetAuthState } = authSlice.actions;
export default authSlice.reducer;

export const selectAuth = (state: RootState) => state.auth;