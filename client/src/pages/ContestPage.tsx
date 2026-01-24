import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import {
  fetchContest,
  updateContestStatus,
  deleteContest,
  setUserVote,
} from '../store/slices/contestsSlice';
import { fetchParticipantsByContest, updateParticipant, deleteParticipant } from '../store/slices/participantsSlice';
import { Participant, ContestStatus } from '../types/models';
import { ParticipantCard } from '../components/contest/ParticipantCard';
import { AddParticipantModal } from '../components/contest/AddParticipantModal';
import { EditParticipantModal } from '../components/contest/EditParticipantModal';
import { DeleteParticipantModal } from '../components/contest/DeleteParticipantModal';
import { EditContestModal } from '../components/contest/EditContestModal';
import { DeleteContestModal } from '../components/contest/DeleteContestModal';
import { ChatWindow } from '../components/chat/ChatWindow';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import { buildLoginUrl } from '../utils/navigation';
import { getVote } from '../api/votesApi';
import './ContestPage.css';

const ContestPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { currentContest, loading } = useSelector((state: RootState) => state.contests);
  const { items: participants, loading: participantsLoading } = useSelector(
    (state: RootState) => state.participants
  );
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const currentUserId = currentUser?.id;
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const participantIds = useSelector((state: RootState) =>
    id ? state.participants.byContest[id] || [] : []
  );
  const [isAddParticipantModalOpen, setIsAddParticipantModalOpen] = useState(false);
  const [isEditContestModalOpen, setIsEditContestModalOpen] = useState(false);
  const [isDeleteContestModalOpen, setIsDeleteContestModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditParticipantModalOpen, setIsEditParticipantModalOpen] = useState(false);
  const [isDeleteParticipantModalOpen, setIsDeleteParticipantModalOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [deletingParticipant, setDeletingParticipant] = useState<Participant | null>(null);
  const currentVoteId = useSelector((state: RootState) =>
    id ? state.contests.userVotes[id] ?? null : null
  );

  // Note: Removed userParticipant check - users can now have unlimited participants

  useEffect(() => {
    if (id) {
      dispatch(fetchContest(id));
      dispatch(fetchParticipantsByContest(id));
    }
  }, [dispatch, id]);

  useEffect(() => {
    const loadVote = async () => {
      if (!id || !isAuthenticated || currentContest?.status !== 'voting') {
        if (id) {
          dispatch(setUserVote({ contestId: id, participantId: null }));
        }
        return;
      }
      try {
        const voteData = await getVote(id);
        dispatch(setUserVote({ contestId: id, participantId: voteData?.participant_id || null }));
      } catch (error) {
        console.error('Failed to load vote:', error);
        dispatch(setUserVote({ contestId: id, participantId: null }));
      }
    };
    loadVote();
  }, [dispatch, id, isAuthenticated, currentContest?.status]);


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
  const canManageParticipants = currentContest.status === 'draft' || currentContest.status === 'registration';
  const statusLabels: Record<ContestStatus, string> = {
    draft: 'Черновик',
    registration: 'Регистрация',
    voting: 'Голосование',
    finished: 'Завершен',
  };

  return (
    <div className="contest-page">
      <div className="contest-page-main">
        <div className="contest-page-header">
          <button
            type="button"
            className="contest-page-back-button"
            onClick={() => navigate('/')}
            aria-label="Назад"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1>{currentContest.title}</h1>
          {isAdmin && (
            <div className="contest-page-admin-actions">
              <div className="contest-page-admin-status">
                <select
                  className="contest-page-admin-status-select"
                  value={currentContest.status}
                  onChange={async (event) => {
                    const nextStatus = event.target.value as ContestStatus;
                    if (nextStatus === currentContest.status) {
                      return;
                    }
                    try {
                      await dispatch(
                        updateContestStatus({ contestId: currentContest.id, status: nextStatus })
                      ).unwrap();
                    } catch (error) {
                      console.error('Failed to update contest status:', error);
                      alert('Не удалось обновить статус');
                    }
                  }}
                >
                  <option value="draft">Черновик</option>
                  <option value="registration">Регистрация</option>
                  <option value="voting">Голосование</option>
                  <option value="finished">Завершен</option>
                </select>
              </div>
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
                        await dispatch(
                          updateContestStatus({ contestId: currentContest.id, status: 'registration' })
                        ).unwrap();
                      } catch (error) {
                        console.error('Failed to update contest status:', error);
                        alert('Не удалось открыть регистрацию');
                      }
                    }}
                  >
                    Открыть регистрацию
                  </Button>
                </>
              )}
              {currentContest.status === 'registration' && (
                <Button
                  onClick={async () => {
                    try {
                      await dispatch(
                        updateContestStatus({ contestId: currentContest.id, status: 'voting' })
                      ).unwrap();
                    } catch (error) {
                      console.error('Failed to update contest status:', error);
                      alert('Не удалось начать голосование');
                    }
                  }}
                >
                  Начать голосование
                </Button>
              )}
              {currentContest.status === 'voting' && (
                <Button
                  variant="success"
                  onClick={async () => {
                    try {
                      await dispatch(
                        updateContestStatus({ contestId: currentContest.id, status: 'finished' })
                      ).unwrap();
                    } catch (error) {
                      console.error('Failed to update contest status:', error);
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
            <span className={`contest-page-status contest-page-status-${currentContest.status}`}>
              {statusLabels[currentContest.status]}
            </span>
            <span>Автор: {isAdmin ? 'Вы' : `Пользователь ${currentContest.created_by_user_id}`}</span>
          </div>
        </div>

        <div className="contest-page-participants">
          <div className="contest-page-participants-header">
            <h2>Участники</h2>
            {canManageParticipants && (
              <div className="contest-page-participants-actions">
                {isAuthenticated ? (
                  <Button onClick={() => setIsAddParticipantModalOpen(true)}>
                    Добавить участника
                  </Button>
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
              {(() => {
                // Calculate winner only when contest is finished
                const isFinished = currentContest.status === 'finished';
                const maxVotes = isFinished
                  ? Math.max(
                      ...participantIds.map((id) => participants[id]?.total_votes || 0),
                      0
                    )
                  : 0;

                const isWinner = (participantId: string) => {
                  if (!isFinished) return false;
                  const participant = participants[participantId];
                  return participant?.total_votes === maxVotes && maxVotes > 0;
                };

                return participantIds.map((participantId) => {
                  const participant = participants[participantId];
                  return participant ? (
                    <ParticipantCard 
                      key={participantId} 
                      participant={participant} 
                      contestId={id!}
                      contestStatus={currentContest.status}
                      isVoted={currentVoteId === participant.id}
                      isWinner={isWinner(participantId)}
                      onEdit={(p) => {
                        setEditingParticipant(p);
                        setIsEditParticipantModalOpen(true);
                      }}
                      onDelete={(p) => {
                        setDeletingParticipant(p);
                        setIsDeleteParticipantModalOpen(true);
                      }}
                    />
                  ) : null;
                });
              })()}
            </div>
          )}
        </div>
      </div>

      <div className="contest-page-sidebar">
        <ChatWindow contestId={currentContest.id} contestStatus={currentContest.status} />
      </div>

      {id && (
        <AddParticipantModal
          isOpen={isAddParticipantModalOpen}
          onClose={() => setIsAddParticipantModalOpen(false)}
          contestId={id}
        />
      )}

      {editingParticipant && (
        <EditParticipantModal
          isOpen={isEditParticipantModalOpen}
          onClose={() => {
            setIsEditParticipantModalOpen(false);
            setEditingParticipant(null);
          }}
          participant={editingParticipant}
        />
      )}

      {deletingParticipant && (
        <DeleteParticipantModal
          isOpen={isDeleteParticipantModalOpen}
          onClose={() => {
            setIsDeleteParticipantModalOpen(false);
            setDeletingParticipant(null);
          }}
          participant={deletingParticipant}
          onDeleted={() => {
            // Refresh participants list after deletion
            if (id) {
              dispatch(fetchParticipantsByContest(id));
            }
          }}
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
