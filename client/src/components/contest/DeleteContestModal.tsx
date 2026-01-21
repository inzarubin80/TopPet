import React from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';
import './DeleteContestModal.css';

interface DeleteContestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  contestTitle: string;
  loading: boolean;
}

export const DeleteContestModal: React.FC<DeleteContestModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  contestTitle,
  loading,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Удалить конкурс"
      footer={
        <div className="delete-contest-modal-footer">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Отмена
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <LoadingSpinner size="small" /> : 'Удалить'}
          </Button>
        </div>
      }
    >
      <div className="delete-contest-modal-content">
        <p>Вы уверены, что хотите удалить конкурс &quot;{contestTitle}&quot;?</p>
        <p className="delete-contest-modal-warning">
          Это действие нельзя отменить. Все данные конкурса будут удалены.
        </p>
      </div>
    </Modal>
  );
};
