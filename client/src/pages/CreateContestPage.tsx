import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store';
import { createContest } from '../store/slices/contestsSlice';
import { Input } from '../components/common/Input';
import { Textarea } from '../components/common/Textarea';
import { Button } from '../components/common/Button';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import './CreateContestPage.css';

const CreateContestPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent, publish: boolean) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Название обязательно');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await dispatch(createContest({ title: title.trim(), description: description.trim() }));
      if (createContest.fulfilled.match(result)) {
        if (publish && result.payload) {
          // TODO: Publish contest
          console.log('Publish contest', result.payload.id);
        }
        navigate(`/contests/${result.payload.id}`);
      } else {
        setError('Не удалось создать конкурс');
      }
    } catch (err: any) {
      setError(err.message || 'Не удалось создать конкурс');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-contest-page">
      <div className="create-contest-page-content">
        <h1>Создать конкурс</h1>
        <form onSubmit={(e) => handleSubmit(e, false)}>
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
          <div className="create-contest-page-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/')}
              disabled={loading}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={loading || !title.trim()}>
              {loading ? <LoadingSpinner size="small" /> : 'Сохранить как черновик'}
            </Button>
            <Button
              type="button"
              onClick={(e) => handleSubmit(e, true)}
              disabled={loading || !title.trim()}
            >
              {loading ? <LoadingSpinner size="small" /> : 'Опубликовать'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateContestPage;
