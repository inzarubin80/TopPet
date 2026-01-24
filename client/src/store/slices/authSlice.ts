import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { User, AuthResponse } from '../../types/models';
import { tokenStorage } from '../../utils/tokenStorage';
import * as authApi from '../../api/authApi';

export const fetchCurrentUser = createAsyncThunk(
  'auth/fetchCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const user = await authApi.getCurrentUser();
      return user;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch current user');
    }
  }
);

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
        // Note: User info will be loaded by AppContent useEffect
      })
      .addCase(refreshTokenAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
        tokenStorage.clearTokens();
      })
      // fetchCurrentUser
      .addCase(fetchCurrentUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
      })
      .addCase(fetchCurrentUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { login, logout, setUser, clearError } = authSlice.actions;
export default authSlice.reducer;
