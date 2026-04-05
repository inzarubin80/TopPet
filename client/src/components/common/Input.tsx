import React, { useId } from 'react';
import './Input.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  /** Пояснение под подписью; для скринридеров связывается с полем через aria-describedby. */
  hint?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  className = '',
  'aria-describedby': ariaDescribedByProp,
  ...props
}) => {
  const hintId = useId();
  const errorId = useId();
  const hintTrimmed = hint != null && hint.trim() !== '' ? hint : '';
  const describedBy = [
    hintTrimmed ? hintId : '',
    ariaDescribedByProp,
    error ? errorId : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="input-wrapper">
      {label && <label className="input-label">{label}</label>}
      {hintTrimmed ? (
        <p id={hintId} className="input-hint">
          {hintTrimmed}
        </p>
      ) : null}
      <input
        className={`input ${error ? 'input-error' : ''} ${className}`.trim()}
        aria-describedby={describedBy || undefined}
        {...props}
      />
      {error ? (
        <span id={errorId} className="input-error-message" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
};
