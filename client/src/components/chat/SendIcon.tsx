import React from 'react';

interface SendIconProps {
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

/** Paper-plane style send icon (Material-like). */
export const SendIcon: React.FC<SendIconProps> = ({
  width = 20,
  height = 20,
  color = 'currentColor',
  className,
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill={color}
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
  >
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
  </svg>
);
