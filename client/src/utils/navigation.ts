// Navigation utilities for handling return URLs after authentication

/**
 * Get return URL from query parameters
 */
export const getReturnUrl = (): string | null => {
  const params = new URLSearchParams(window.location.search);
  return params.get('returnUrl');
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
 * Get return URL and clear it from URL
 */
export const getAndClearReturnUrl = (): string | null => {
  const returnUrl = getReturnUrl();
  if (returnUrl) {
    // Clear from URL without reload
    const url = new URL(window.location.href);
    url.searchParams.delete('returnUrl');
    window.history.replaceState({}, '', url.toString());
  }
  return returnUrl;
};
