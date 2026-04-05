import React, { useId } from 'react';
import './Textarea.css';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea: React.FC<TextareaProps> = ({
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
    <div className="textarea-wrapper">
      {label && <label className="textarea-label">{label}</label>}
      {hintTrimmed ? (
        <p id={hintId} className="textarea-hint">
          {hintTrimmed}
        </p>
      ) : null}
      <textarea
        className={`textarea ${error ? 'textarea-error' : ''} ${className}`.trim()}
        aria-describedby={describedBy || undefined}
        {...props}
      />
      {error ? (
        <span id={errorId} className="textarea-error-message" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
};
