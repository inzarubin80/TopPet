import React from 'react';
import './ErrorMessage.css';

interface ErrorMessageProps {
  message: string;
  className?: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, className = '' }) => {
  return <div className={`error-message ${className}`.trim()}>{message}</div>;
};
