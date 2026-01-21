import React from 'react';
import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  className = '',
}) => {
  return (
    <div className={`spinner spinner-${size} ${className}`.trim()}>
      <div className="spinner-circle"></div>
    </div>
  );
};
