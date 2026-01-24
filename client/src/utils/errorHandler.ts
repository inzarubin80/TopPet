// Centralized error handling utility

import { logger } from './logger';

export type ShowErrorFunction = (message: string) => void;

export interface ApiError {
  message?: string;
  response?: {
    status?: number;
    data?: {
      message?: string;
      error?: string;
    };
  };
}

/**
 * Extracts a user-friendly error message from an error object
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  // Handle axios errors
  const apiError = error as ApiError;
  if (apiError?.response?.data?.message) {
    return apiError.response.data.message;
  }
  if (apiError?.response?.data?.error) {
    return apiError.response.data.error;
  }
  if (apiError?.message) {
    return apiError.message;
  }

  return 'Произошла ошибка. Попробуйте еще раз.';
};

/**
 * Handles errors with optional toast notification
 */
export const errorHandler = {
  handleError: (error: unknown, showError?: ShowErrorFunction, logError: boolean = true): void => {
    const message = getErrorMessage(error);

    if (logError) {
      logger.error('Error occurred', error);
    }

    if (showError) {
      showError(message);
    }
  },

  /**
   * Handles API errors with status code awareness
   */
  handleApiError: (
    error: unknown,
    showError?: ShowErrorFunction,
    defaultMessage?: string
  ): void => {
    const apiError = error as ApiError;
    const status = apiError?.response?.status;

    let message = defaultMessage || getErrorMessage(error);

    // Customize messages based on status codes
    if (status === 401) {
      message = 'Требуется авторизация';
    } else if (status === 403) {
      message = 'Доступ запрещен';
    } else if (status === 404) {
      message = 'Ресурс не найден';
    } else if (status === 500) {
      message = 'Ошибка сервера. Попробуйте позже.';
    }

    logger.error('API error occurred', { status, error });

    if (showError) {
      showError(message);
    }
  },
};
