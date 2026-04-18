import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../store';
import { deleteParticipant } from '../../store/slices/participantsSlice';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { Participant, UserID } from '../../types/models';
import { userIdsEqual } from '../../utils/userId';
import './DeleteParticipantModal.css';

interface DeleteParticipantModalProps {
  isOpen: boolean;
  onClose: () => void;
  participant: Participant | null;
  /** Только владелец заявки может удалить; без совпадения подтверждение не выполняется. */
  currentUserId: UserID | undefined;
  onDeleted?: () => void;
}

export const DeleteParticipantModal: React.FC<DeleteParticipantModalProps> = ({
  isOpen,
  onClose,
  participant,
  currentUserId,
  onDeleted,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!participant || currentUserId == null || !userIdsEqual(participant.user_id, currentUserId)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await dispatch(deleteParticipant(participant.id));

      if (!deleteParticipant.fulfilled.match(result)) {
        setError(result.payload as string || 'Не удалось удалить участника');
        setLoading(false);
        return;
      }

      setLoading(false);
      if (onDeleted) {
        onDeleted();
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Не удалось удалить участника');
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError(null);
      onClose();
    }
  };

  if (!participant) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Удалить участника"
      footer={
        <div className="delete-participant-modal-footer">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={loading}
          >
            Отмена
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleConfirm}
            disabled={
              loading ||
              !participant ||
              currentUserId == null ||
              !userIdsEqual(participant.user_id, currentUserId)
            }
          >
            {loading ? <LoadingSpinner size="small" /> : 'Удалить'}
          </Button>
        </div>
      }
    >
      <div className="delete-participant-modal-content">
        <p>Вы уверены, что хотите удалить участника <strong>{participant.pet_name}</strong>?</p>
        <p className="delete-participant-modal-warning">
          Это действие нельзя отменить. Все данные участника (фото, видео, комментарии, голоса) будут удалены.
        </p>
        {error && (
          <div className="delete-participant-modal-error">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
};
