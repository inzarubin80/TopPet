import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { tokenStorage } from '../utils/tokenStorage';
import { store } from '../store';
import { refreshTokenAsync } from '../store/slices/authSlice';
import { buildLoginUrl } from '../utils/navigation';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api';

// Log API URL for debugging
console.log('[axiosClient] API_URL:', API_URL);

export const axiosClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add access token
axiosClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = tokenStorage.getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Debug logging
    console.log('[axiosClient] Request:', {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
      fullURL: `${config.baseURL}${config.url}`,
      headers: {
        'Content-Type': config.headers['Content-Type'],
        'Authorization': config.headers.Authorization ? 'Bearer ***' : 'none',
      },
    });
    return config;
  },
  (error) => {
    console.error('[axiosClient] Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor - handle 401 and refresh token
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (error?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

/**
 * Redirect to login page with current URL as returnUrl
 * Only redirects if not already on login page and not during refresh token request
 */
const redirectToLogin = (originalRequest?: InternalAxiosRequestConfig) => {
  // Don't redirect if already on login page
  if (window.location.pathname === '/login') {
    return;
  }

  // Don't redirect for public endpoints (to avoid infinite loop)
  const publicEndpoints = ['/auth/refresh', '/auth/providers', '/auth/login', '/auth/callback'];
  if (originalRequest?.url && publicEndpoints.some(endpoint => originalRequest.url?.includes(endpoint))) {
    return;
  }

  // Get current path as returnUrl
  const currentPath = window.location.pathname + window.location.search;
  const loginUrl = buildLoginUrl(currentPath);
  
  console.log('[axiosClient] Redirecting to login:', loginUrl);
  
  // Use window.location.href for full redirect (clears state)
  window.location.href = loginUrl;
};

axiosClient.interceptors.response.use(
  (response) => {
    // Debug logging for successful responses
    console.log('[axiosClient] Response success:', {
      status: response.status,
      url: response.config.url,
      method: response.config.method?.toUpperCase(),
    });
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    // Debug logging for errors
    console.error('[axiosClient] Response error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: originalRequest?.url,
      method: originalRequest?.method?.toUpperCase(),
      message: error.message,
      isNetworkError: !error.response,
    });

    // If error is 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Check if this is a public endpoint - don't try refresh for those
      const publicEndpoints = ['/auth/refresh', '/auth/providers', '/auth/login', '/auth/callback'];
      const isPublicEndpoint = originalRequest?.url && publicEndpoints.some(endpoint => originalRequest.url?.includes(endpoint));
      
      // For public endpoints, just reject without redirect
      if (isPublicEndpoint) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers && token) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return axiosClient(originalRequest);
          })
          .catch((err) => {
            // If refresh failed, redirect to login
            redirectToLogin(originalRequest);
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = tokenStorage.getRefreshToken();
      if (!refreshToken) {
        // No refresh token - logout and redirect immediately
        console.log('[axiosClient] No refresh token, redirecting to login');
        processQueue(error, null);
        store.dispatch({ type: 'auth/logout' });
        redirectToLogin(originalRequest);
        return Promise.reject(error);
      }

      try {
        const response = await store.dispatch(refreshTokenAsync(refreshToken));
        
        // Check if refresh was successful
        if (refreshTokenAsync.fulfilled.match(response)) {
          const newToken = (response.payload as any)?.token;
          if (newToken) {
            processQueue(null, newToken);

            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            return axiosClient(originalRequest);
          }
        }
        
        // Refresh failed (rejected or no token) - logout and redirect
        processQueue(response, null);
        store.dispatch({ type: 'auth/logout' });
        redirectToLogin(originalRequest);
        return Promise.reject(response);
      } catch (refreshError: any) {
        // Refresh failed with exception - logout and redirect
        processQueue(refreshError, null);
        store.dispatch({ type: 'auth/logout' });
        redirectToLogin(originalRequest);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
