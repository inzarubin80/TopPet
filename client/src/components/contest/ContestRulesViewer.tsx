import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import './ContestRulesViewer.css';

type ContestRulesViewerProps = {
  rulesText: string | undefined | null;
  contestTitle?: string;
  /** className кнопки открытия */
  triggerClassName?: string;
  /** Не давать клику всплывать (карточка в списке целиком ведёт на конкурс) */
  stopPropagation?: boolean;
};

export const ContestRulesViewer: React.FC<ContestRulesViewerProps> = ({
  rulesText,
  contestTitle,
  triggerClassName,
  stopPropagation,
}) => {
  const [open, setOpen] = useState(false);
  const body = rulesText ?? '';
  if (!body.trim()) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className={triggerClassName ?? 'contest-rules-viewer-trigger'}
        onClick={(e) => {
          if (stopPropagation) {
            e.preventDefault();
            e.stopPropagation();
          }
          setOpen(true);
        }}
      >
        Правила конкурса
      </button>
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={contestTitle ? `Правила: ${contestTitle}` : 'Правила конкурса'}
      >
        <div className="contest-rules-viewer-body">{body}</div>
      </Modal>
    </>
  );
};
