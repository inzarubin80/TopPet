import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { User, AuthResponse } from '../../types/models';
import { tokenStorage } from '../../utils/tokenStorage';
import * as authApi from '../../api/authApi';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  accessToken: tokenStorage.getAccessToken(),
  refreshToken: tokenStorage.getRefreshToken(),
  isAuthenticated: !!tokenStorage.getAccessToken(),
  loading: false,
  error: null,
};

// Async thunks
export const devLoginAsync = createAsyncThunk(
  'auth/devLogin',
  async (name: string, { rejectWithValue }) => {
    try {
      const response = await authApi.devLogin(name);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Login failed');
    }
  }
);

export const refreshTokenAsync = createAsyncThunk(
  'auth/refreshToken',
  async (refreshToken: string, { rejectWithValue }) => {
    try {
      const response = await authApi.refreshToken(refreshToken);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Token refresh failed');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    login: (state, action: PayloadAction<AuthResponse>) => {
      state.accessToken = action.payload.token;
      state.refreshToken = action.payload.refresh_token;
      state.isAuthenticated = true;
      tokenStorage.saveTokens(action.payload.token, action.payload.refresh_token);
    },
    logout: (state) => {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.error = null;
      tokenStorage.clearTokens();
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // devLoginAsync
      .addCase(devLoginAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(devLoginAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.accessToken = action.payload.token;
        state.refreshToken = action.payload.refresh_token;
        state.isAuthenticated = true;
        tokenStorage.saveTokens(action.payload.token, action.payload.refresh_token);
      })
      .addCase(devLoginAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // refreshTokenAsync
      .addCase(refreshTokenAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(refreshTokenAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.accessToken = action.payload.token;
        state.refreshToken = action.payload.refresh_token;
        state.isAuthenticated = true;
        tokenStorage.saveTokens(action.payload.token, action.payload.refresh_token);
      })
      .addCase(refreshTokenAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
        tokenStorage.clearTokens();
      });
  },
});

export const { login, logout, setUser, clearError } = authSlice.actions;
export default authSlice.reducer;
