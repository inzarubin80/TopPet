import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppDispatch, RootState } from '../../store';
import { createParticipant } from '../../store/slices/participantsSlice';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Textarea } from '../common/Textarea';
import { Button } from '../common/Button';
import { ErrorMessage } from '../common/ErrorMessage';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ContestID } from '../../types/models';
import { buildLoginUrl } from '../../utils/navigation';
import './AddParticipantModal.css';

interface AddParticipantModalProps {
  isOpen: boolean;
  onClose: () => void;
  contestId: ContestID;
}

export const AddParticipantModal: React.FC<AddParticipantModalProps> = ({
  isOpen,
  onClose,
  contestId,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const [petName, setPetName] = useState('');
  const [petDescription, setPetDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect to login if not authenticated when modal opens
  useEffect(() => {
    if (isOpen && !isAuthenticated) {
      onClose();
      const returnUrl = `/contests/${contestId}`;
      navigate(buildLoginUrl(returnUrl));
    }
  }, [isOpen, isAuthenticated, navigate, contestId, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    // Double check authentication before submitting
    if (!isAuthenticated) {
      onClose();
      const returnUrl = `/contests/${contestId}`;
      navigate(buildLoginUrl(returnUrl));
      return;
    }
    e.preventDefault();
    if (!petName.trim()) {
      setError('Имя животного обязательно');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await dispatch(
        createParticipant({
          contestId,
          data: {
            pet_name: petName.trim(),
            pet_description: petDescription.trim(),
          },
        })
      );

      if (createParticipant.fulfilled.match(result)) {
        // Close modal and navigate to participant page
        onClose();
        navigate(`/contests/${contestId}/participants/${result.payload.id}`);
      } else {
        setError(result.payload as string || 'Не удалось добавить участника');
      }
    } catch (err: any) {
      setError(err.message || 'Не удалось добавить участника');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setPetName('');
      setPetDescription('');
      setError(null);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Добавить участника"
      footer={
        <div className="add-participant-modal-footer">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={loading}
          >
            Отмена
          </Button>
          <Button
            type="submit"
            form="add-participant-form"
            disabled={loading || !petName.trim()}
          >
            {loading ? <LoadingSpinner size="small" /> : 'Добавить'}
          </Button>
        </div>
      }
    >
      <form id="add-participant-form" onSubmit={handleSubmit}>
        <Input
          label="Имя животного"
          type="text"
          value={petName}
          onChange={(e) => setPetName(e.target.value)}
          placeholder="Введите имя вашего питомца"
          required
          disabled={loading}
        />
        <Textarea
          label="Описание"
          value={petDescription}
          onChange={(e) => setPetDescription(e.target.value)}
          placeholder="Расскажите о вашем питомце..."
          disabled={loading}
        />
        {error && <ErrorMessage message={error} />}
      </form>
    </Modal>
  );
};
