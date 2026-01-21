import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { fetchContest, publishContest, finishContest } from '../store/slices/contestsSlice';
import { fetchParticipantsByContest } from '../store/slices/participantsSlice';
import { ParticipantCard } from '../components/contest/ParticipantCard';
import { ChatWindow } from '../components/chat/ChatWindow';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import './ContestPage.css';

const ContestPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { currentContest, loading } = useSelector((state: RootState) => state.contests);
  const { items: participants, loading: participantsLoading } = useSelector(
    (state: RootState) => state.participants
  );
  const currentUserId = useSelector((state: RootState) => state.auth.user?.id);
  const participantIds = useSelector((state: RootState) =>
    id ? state.participants.byContest[id] || [] : []
  );

  useEffect(() => {
    if (id) {
      dispatch(fetchContest(id));
      dispatch(fetchParticipantsByContest(id));
    }
  }, [dispatch, id]);

  if (loading) {
    return (
      <div className="contest-page-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!currentContest) {
    return <div className="contest-page-error">Конкурс не найден</div>;
  }

  const isAdmin = currentContest.created_by_user_id === currentUserId;

  return (
    <div className="contest-page">
      <div className="contest-page-main">
        <div className="contest-page-header">
          <Button variant="secondary" onClick={() => navigate('/')}>
            Назад
          </Button>
          <h1>{currentContest.title}</h1>
          {isAdmin && (
            <div className="contest-page-admin-actions">
              {currentContest.status === 'draft' && (
                <Button
                  onClick={async () => {
                    try {
                      await dispatch(publishContest(currentContest.id)).unwrap();
                    } catch (error) {
                      console.error('Failed to publish contest:', error);
                      alert('Не удалось опубликовать конкурс');
                    }
                  }}
                >
                  Опубликовать
                </Button>
              )}
              {currentContest.status === 'published' && (
                <Button
                  variant="danger"
                  onClick={async () => {
                    try {
                      await dispatch(finishContest(currentContest.id)).unwrap();
                    } catch (error) {
                      console.error('Failed to finish contest:', error);
                      alert('Не удалось завершить конкурс');
                    }
                  }}
                >
                  Завершить
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="contest-page-description">
          <p>{currentContest.description || 'Нет описания'}</p>
          <div className="contest-page-stats">
            <span>Голосов: {currentContest.total_votes || 0}</span>
            <span>Статус: {currentContest.status}</span>
          </div>
        </div>

        <div className="contest-page-participants">
          <h2>Участники</h2>
          {participantsLoading ? (
            <div className="contest-page-participants-loading">
              <LoadingSpinner size="medium" />
            </div>
          ) : participantIds.length === 0 ? (
            <div className="contest-page-participants-empty">Нет участников</div>
          ) : (
            <div className="contest-page-participants-list">
              {participantIds.map((participantId) => {
                const participant = participants[participantId];
                return participant ? (
                  <ParticipantCard key={participantId} participant={participant} contestId={id!} />
                ) : null;
              })}
            </div>
          )}
        </div>
      </div>

      <div className="contest-page-sidebar">
        <ChatWindow contestId={currentContest.id} />
      </div>
    </div>
  );
};

export default ContestPage;
