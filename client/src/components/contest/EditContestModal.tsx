import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../store';
import { updateContest } from '../../store/slices/contestsSlice';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Textarea } from '../common/Textarea';
import { Button } from '../common/Button';
import { ErrorMessage } from '../common/ErrorMessage';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { Contest } from '../../types/models';
import './EditContestModal.css';

interface EditContestModalProps {
  isOpen: boolean;
  onClose: () => void;
  contest: Contest;
}

export const EditContestModal: React.FC<EditContestModalProps> = ({
  isOpen,
  onClose,
  contest,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const [title, setTitle] = useState(contest.title);
  const [description, setDescription] = useState(contest.description || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update form when contest changes
  useEffect(() => {
    setTitle(contest.title);
    setDescription(contest.description || '');
  }, [contest]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Название обязательно');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await dispatch(
        updateContest({
          contestId: contest.id,
          data: {
            title: title.trim(),
            description: description.trim(),
          },
        })
      );

      if (updateContest.fulfilled.match(result)) {
        onClose();
      } else {
        setError(result.payload as string || 'Не удалось обновить конкурс');
      }
    } catch (err: any) {
      setError(err.message || 'Не удалось обновить конкурс');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setTitle(contest.title);
      setDescription(contest.description || '');
      setError(null);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Редактировать конкурс"
      footer={
        <div className="edit-contest-modal-footer">
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
            form="edit-contest-form"
            disabled={loading || !title.trim()}
          >
            {loading ? <LoadingSpinner size="small" /> : 'Сохранить'}
          </Button>
        </div>
      }
    >
      <form id="edit-contest-form" onSubmit={handleSubmit}>
        <Input
          label="Название"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Введите название конкурса"
          required
          disabled={loading}
        />
        <Textarea
          label="Описание"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Введите описание конкурса"
          disabled={loading}
        />
        {error && <ErrorMessage message={error} />}
      </form>
    </Modal>
  );
};
