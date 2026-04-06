import React, { useEffect } from 'react';
import './Modal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Линия под заголовком (по умолчанию включена). */
  showHeaderDivider?: boolean;
  /** Линия над футером (по умолчанию включена). */
  showFooterDivider?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  showHeaderDivider = true,
  showFooterDivider = true,
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
    <div className="modal-overlay">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {title && (
          <div className={showHeaderDivider ? 'modal-header' : 'modal-header modal-header--plain'}>
            <h2 className="modal-title">{title}</h2>
            <button
              className="modal-close"
              onClick={() => {
                console.log('[Modal] Close button click', { title });
                onClose();
              }}
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
