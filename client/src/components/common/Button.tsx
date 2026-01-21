import React from 'react';
import './Button.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  className = '',
  ...props
}) => {
  const classes = `btn btn-${variant} btn-${size} ${fullWidth ? 'btn-full-width' : ''} ${className}`.trim();

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
};
