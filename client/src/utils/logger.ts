// Centralized logging utility with log levels

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isDevelopment = process.env.NODE_ENV === 'development';

const shouldLog = (level: LogLevel): boolean => {
  if (isDevelopment) {
    return true; // Log everything in development
  }
  // In production, only log warnings and errors
  return level === 'warn' || level === 'error';
};

const formatMessage = (level: LogLevel, message: string, data?: unknown): string => {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  return data ? `${prefix} ${message}` : `${prefix} ${message}`;
};

export const logger = {
  debug: (message: string, data?: unknown): void => {
    if (shouldLog('debug')) {
      if (data) {
        console.debug(formatMessage('debug', message, data), data);
      } else {
        console.debug(formatMessage('debug', message));
      }
    }
  },

  info: (message: string, data?: unknown): void => {
    if (shouldLog('info')) {
      if (data) {
        console.info(formatMessage('info', message, data), data);
      } else {
        console.info(formatMessage('info', message));
      }
    }
  },

  warn: (message: string, data?: unknown): void => {
    if (shouldLog('warn')) {
      if (data) {
        console.warn(formatMessage('warn', message, data), data);
      } else {
        console.warn(formatMessage('warn', message));
      }
    }
  },

  error: (message: string, error?: unknown): void => {
    if (shouldLog('error')) {
      if (error) {
        console.error(formatMessage('error', message, error), error);
      } else {
        console.error(formatMessage('error', message));
      }
    }
  },
};
