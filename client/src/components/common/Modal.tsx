import React, { useEffect } from 'react';
import './Modal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Дополнительный класс на корневой overlay (например, для ширины контента). */
  className?: string;
  /** Только кнопка закрытия без заголовка (контент с заголовком внутри тела). */
  closeOnlyHeader?: boolean;
  /** Линия под заголовком (по умолчанию включена). */
  showHeaderDivider?: boolean;
  /** Линия над футером (по умолчанию включена). */
  showFooterDivider?: boolean;
  /** Закрыть по клику на затемнённый фон (не на содержимое). */
  closeOnBackdropClick?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  className,
  closeOnlyHeader = false,
  showHeaderDivider = true,
  showFooterDivider = true,
  closeOnBackdropClick = false,
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={className ? `modal-overlay ${className}` : 'modal-overlay'}
      onClick={closeOnBackdropClick ? onClose : undefined}
      role="presentation"
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {(title || closeOnlyHeader) && (
          <div
            className={
              (showHeaderDivider ? 'modal-header' : 'modal-header modal-header--plain') +
              (closeOnlyHeader && !title ? ' modal-header--close-only' : '')
            }
          >
            {title ? <h2 className="modal-title">{title}</h2> : null}
            <button
              type="button"
              className="modal-close"
              onClick={() => {
                onClose();
              }}
              aria-label="Закрыть"
            >
              ×
            </button>
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && (
          <div className={showFooterDivider ? 'modal-footer' : 'modal-footer modal-footer--plain'}>{footer}</div>
        )}
      </div>
    </div>
  );
};
