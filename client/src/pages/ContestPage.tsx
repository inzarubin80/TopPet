import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { fetchContest, publishContest, finishContest, deleteContest } from '../store/slices/contestsSlice';
import { fetchParticipantsByContest } from '../store/slices/participantsSlice';
import { ParticipantCard } from '../components/contest/ParticipantCard';
import { AddParticipantModal } from '../components/contest/AddParticipantModal';
import { EditContestModal } from '../components/contest/EditContestModal';
import { DeleteContestModal } from '../components/contest/DeleteContestModal';
import { ChatWindow } from '../components/chat/ChatWindow';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import { buildLoginUrl } from '../utils/navigation';
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
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const participantIds = useSelector((state: RootState) =>
    id ? state.participants.byContest[id] || [] : []
  );
  const [isAddParticipantModalOpen, setIsAddParticipantModalOpen] = useState(false);
  const [isEditContestModalOpen, setIsEditContestModalOpen] = useState(false);
  const [isDeleteContestModalOpen, setIsDeleteContestModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Find current user's participant in this contest
  const userParticipant = useMemo(() => {
    if (!currentUserId || !id) return null;
    return participantIds
      .map((pid) => participants[pid])
      .find((p) => p && p.user_id === currentUserId);
  }, [participantIds, participants, currentUserId, id]);

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
                <>
                  <Button
                    variant="secondary"
                    onClick={() => setIsEditContestModalOpen(true)}
                  >
                    Редактировать
                  </Button>
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
                </>
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
              <Button
                variant="danger"
                onClick={() => setIsDeleteContestModalOpen(true)}
              >
                Удалить
              </Button>
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
          <div className="contest-page-participants-header">
            <h2>Участники</h2>
            {currentContest.status !== 'finished' && (
              <div className="contest-page-participants-actions">
                {isAuthenticated ? (
                  userParticipant ? (
                    <Button
                      variant="secondary"
                      onClick={() => navigate(`/contests/${id}/participants/${userParticipant.id}`)}
                    >
                      Мой участник
                    </Button>
                  ) : (
                    <Button onClick={() => setIsAddParticipantModalOpen(true)}>
                      Добавить участника
                    </Button>
                  )
                ) : (
                  <Button
                    variant="primary"
                    onClick={() => {
                      const returnUrl = `/contests/${id}`;
                      navigate(buildLoginUrl(returnUrl));
                    }}
                  >
                    Войти для участия
                  </Button>
                )}
              </div>
            )}
          </div>
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

      {id && (
        <AddParticipantModal
          isOpen={isAddParticipantModalOpen}
          onClose={() => setIsAddParticipantModalOpen(false)}
          contestId={id}
        />
      )}

      {currentContest && (
        <>
          <EditContestModal
            isOpen={isEditContestModalOpen}
            onClose={() => setIsEditContestModalOpen(false)}
            contest={currentContest}
          />
          <DeleteContestModal
            isOpen={isDeleteContestModalOpen}
            onClose={() => setIsDeleteContestModalOpen(false)}
            onConfirm={async () => {
              if (!currentContest) return;
              try {
                setIsDeleting(true);
                await dispatch(deleteContest(currentContest.id)).unwrap();
                navigate('/');
              } catch (error) {
                console.error('Failed to delete contest:', error);
                alert('Не удалось удалить конкурс');
                setIsDeleting(false);
              }
            }}
            contestTitle={currentContest.title}
            loading={isDeleting}
          />
        </>
      )}
    </div>
  );
};

export default ContestPage;
