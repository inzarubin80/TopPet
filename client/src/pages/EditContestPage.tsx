import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Navigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { fetchContest, updateContest } from '../store/slices/contestsSlice';
import { Input } from '../components/common/Input';
import { Textarea } from '../components/common/Textarea';
import { Button } from '../components/common/Button';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import {
  ContestOrganizerCriteriaPanel,
  type ContestOrganizerCriteriaPanelHandle,
} from '../components/contest/ContestOrganizerCriteriaPanel';
import {
  ContestRegistrationFieldsPanel,
  type ContestRegistrationFieldsPanelHandle,
} from '../components/contest/ContestRegistrationFieldsPanel';
import { useToast } from '../contexts/ToastContext';
import './EditContestPage.css';

type LoadState = 'loading' | 'ready' | 'error';

const EditContestPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { showSuccess } = useToast();
  const currentContest = useSelector((state: RootState) => state.contests.currentContest);
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const panelRef = useRef<ContestOrganizerCriteriaPanelHandle>(null);
  const registrationFieldsRef = useRef<ContestRegistrationFieldsPanelHandle>(null);

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoadState('error');
      return;
    }
    setLoadState('loading');
    dispatch(fetchContest(id))
      .unwrap()
      .then((contest) => {
        setTitle(contest.title);
        setDescription(contest.description || '');
        setLoadState('ready');
      })
      .catch(() => setLoadState('error'));
  }, [dispatch, id]);

  useEffect(() => {
    if (loadState !== 'ready' || !id || currentContest?.id !== id) {
      return;
    }
    setTitle(currentContest.title);
    setDescription(currentContest.description || '');
  }, [loadState, id, currentContest]);

  const handleSaveAll = async () => {
    if (!id || !title.trim()) {
      setError('Название обязательно');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await dispatch(
        updateContest({
          contestId: id,
          data: {
            title: title.trim(),
            description: description.trim(),
          },
        })
      );

      if (!updateContest.fulfilled.match(result)) {
        setError((result.payload as string) || 'Не удалось обновить конкурс');
        return;
      }

      const critOk = await panelRef.current?.saveJuryCriteria({ quietSuccess: true });
      if (critOk === false) {
        return;
      }

      const regOk = await registrationFieldsRef.current?.saveRegistrationFields({ quietSuccess: true });
      if (regOk === false) {
        return;
      }

      showSuccess('Изменения сохранены');
      navigate(`/contests/${id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Не удалось сохранить';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (!id) {
    return <div className="edit-contest-page-error">Конкурс не найден</div>;
  }

  if (loadState === 'loading') {
    return (
      <div className="edit-contest-page-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (loadState === 'error' || !currentContest || currentContest.id !== id) {
    return <div className="edit-contest-page-error">Конкурс не найден</div>;
  }

  if (currentContest.created_by_user_id !== currentUser?.id) {
    return <Navigate to={`/contests/${id}`} replace />;
  }

  return (
    <div className="edit-contest-page">
      <div className="edit-contest-page-inner">
        <header className="edit-contest-page-header">
          <Link to={`/contests/${id}`} className="edit-contest-page-back">
            <span className="edit-contest-page-back-icon" aria-hidden>
              ‹
            </span>
            К конкурсу
          </Link>
          <div className="edit-contest-page-heading">
            <p className="edit-contest-page-eyebrow">Настройки</p>
            <h1 className="edit-contest-page-title">Редактировать конкурс</h1>
            <p className="edit-contest-page-lead">
              Название, описание, номинации, критерии жюри и поля заявки участника сохраняются одной кнопкой внизу
              страницы.
            </p>
          </div>
        </header>

        <section className="edit-contest-page-card" aria-labelledby="edit-section-main">
          <h2 id="edit-section-main" className="edit-contest-page-section-label">
            Основное
          </h2>
          <div className="edit-contest-page-fields">
            <Input
              label="Название"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например, «Весенний фотоконкурс»"
              required
              disabled={saving}
            />
            <Textarea
              label="Описание"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Кратко опишите конкурс для участников"
              disabled={saving}
            />
          </div>
          {error && (
            <div className="edit-contest-page-error-inline">
              <ErrorMessage message={error} />
            </div>
          )}
        </section>

        <section
          className="edit-contest-page-card edit-contest-page-card--organizer"
          aria-label="Номинации и критерии жюри"
        >
          <div className="edit-contest-page-organizer">
            <ContestOrganizerCriteriaPanel
              ref={panelRef}
              contest={currentContest}
              isAdmin
              hideJuryCriteriaSaveButton
              formDisabled={saving}
            />
          </div>
        </section>

        <section
          className="edit-contest-page-card edit-contest-page-card--organizer"
          aria-label="Поля заявки участника"
        >
          <div className="edit-contest-page-organizer">
            <ContestRegistrationFieldsPanel
              ref={registrationFieldsRef}
              contest={currentContest}
              isAdmin
              hideSaveButton
              formDisabled={saving}
            />
          </div>
        </section>

        <footer className="edit-contest-page-footer">
          <Button type="button" onClick={() => void handleSaveAll()} disabled={saving || !title.trim()}>
            {saving ? <LoadingSpinner size="small" /> : 'Сохранить изменения'}
          </Button>
        </footer>
      </div>
    </div>
  );
};

export default EditContestPage;
