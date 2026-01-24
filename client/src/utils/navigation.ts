// Navigation utilities for handling return URLs after authentication

const RETURN_URL_STORAGE_KEY = 'oauth_return_url';
const PROFILE_REFERRER_STORAGE_KEY = 'profile_referrer';

/**
 * Get return URL from query parameters
 */
export const getReturnUrl = (): string | null => {
  const params = new URLSearchParams(window.location.search);
  return params.get('returnUrl');
};

/**
 * Save return URL to sessionStorage (for OAuth flow)
 */
export const saveReturnUrlToStorage = (returnUrl: string): void => {
  sessionStorage.setItem(RETURN_URL_STORAGE_KEY, returnUrl);
};

/**
 * Get return URL from sessionStorage
 */
export const getReturnUrlFromStorage = (): string | null => {
  return sessionStorage.getItem(RETURN_URL_STORAGE_KEY);
};

/**
 * Clear return URL from sessionStorage
 */
export const clearReturnUrlFromStorage = (): void => {
  sessionStorage.removeItem(RETURN_URL_STORAGE_KEY);
};

/**
 * Save return URL to query parameters
 */
export const buildLoginUrl = (returnUrl?: string): string => {
  const baseUrl = '/login';
  if (returnUrl) {
    return `${baseUrl}?returnUrl=${encodeURIComponent(returnUrl)}`;
  }
  return baseUrl;
};

/**
 * Get return URL and clear it from URL or sessionStorage
 * First checks sessionStorage (for OAuth flow), then query parameters
 */
export const getAndClearReturnUrl = (): string | null => {
  // Сначала проверяем sessionStorage (для OAuth flow)
  const storageUrl = getReturnUrlFromStorage();
  if (storageUrl) {
    clearReturnUrlFromStorage();
    return storageUrl;
  }
  
  // Затем проверяем query параметры (для прямого перехода на /login)
  const queryUrl = getReturnUrl();
  if (queryUrl) {
    // Очищаем из URL
    const url = new URL(window.location.href);
    url.searchParams.delete('returnUrl');
    window.history.replaceState({}, '', url.toString());
    return queryUrl;
  }
  
  return null;
};

/**
 * Save profile referrer URL to sessionStorage
 * Used to redirect user back to the page they came from after logout
 */
export const saveProfileReferrer = (url: string): void => {
  sessionStorage.setItem(PROFILE_REFERRER_STORAGE_KEY, url);
};

/**
 * Get profile referrer URL from sessionStorage
 */
export const getProfileReferrer = (): string | null => {
  return sessionStorage.getItem(PROFILE_REFERRER_STORAGE_KEY);
};

/**
 * Clear profile referrer URL from sessionStorage
 */
export const clearProfileReferrer = (): void => {
  sessionStorage.removeItem(PROFILE_REFERRER_STORAGE_KEY);
};
