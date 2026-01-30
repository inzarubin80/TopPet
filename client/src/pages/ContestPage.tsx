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
import { fetchParticipantsByContest } from '../store/slices/participantsSlice';
import { Participant, ContestStatus } from '../types/models';
import { ParticipantCard } from '../components/contest/ParticipantCard';
import { AddParticipantModal } from '../components/contest/AddParticipantModal';
import { EditParticipantModal } from '../components/contest/EditParticipantModal';
import { DeleteParticipantModal } from '../components/contest/DeleteParticipantModal';
import { ParticipantVotersModal } from '../components/contest/ParticipantVotersModal';
import { EditContestModal } from '../components/contest/EditContestModal';
import { DeleteContestModal } from '../components/contest/DeleteContestModal';
import { ChatWindow } from '../components/chat/ChatWindow';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import { buildLoginUrl } from '../utils/navigation';
import { getVote } from '../api/votesApi';
import { useToast } from '../contexts/ToastContext';
import { errorHandler } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { useContestPermissions } from '../hooks/useContestPermissions';
import { useContestWinners } from '../hooks/useContestWinners';
import { ContestMetaTags } from '../components/seo/ContestMetaTags';
import './ContestPage.css';

const ContestPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { showError } = useToast();
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
  const [votersModalParticipant, setVotersModalParticipant] = useState<Participant | null>(null);
  const [votersModalOpen, setVotersModalOpen] = useState(false);
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
        logger.error('Failed to load vote', error);
        dispatch(setUserVote({ contestId: id, participantId: null }));
      }
    };
    loadVote();
  }, [dispatch, id, isAuthenticated, currentContest?.status]);


  const { isAdmin, canManageParticipants } = useContestPermissions(currentContest, currentUserId);
  const isWinner = useContestWinners(participants, currentContest?.status || 'draft');

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
  const statusLabels: Record<ContestStatus, string> = {
    draft: 'Черновик',
    registration: 'Регистрация',
    voting: 'Голосование',
    finished: 'Завершен',
  };

  // Формируем массив участников для метатегов
  const participantsArray = participantIds
    .map((participantId) => participants[participantId])
    .filter((p): p is Participant => p !== undefined);

  return (
    <div className="contest-page">
      {currentContest && id && (
        <ContestMetaTags
          contest={currentContest}
          participants={participantsArray}
          contestId={id}
        />
      )}
      <div className="contest-page-main">
        <div className="contest-page-top-actions">
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
                      errorHandler.handleError(error, showError, false);
                      showError('Не удалось обновить статус');
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
              <Button
                onClick={async () => {
                  try {
                    await dispatch(
                      updateContestStatus({ contestId: currentContest.id, status: 'registration' })
                    ).unwrap();
                  } catch (error) {
                    errorHandler.handleError(error, showError, false);
                    showError('Не удалось открыть регистрацию');
                  }
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14"></path>
                  <path d="M12 5l7 7-7 7"></path>
                </svg>
                Открыть регистрацию
              </Button>
            )}
            {currentContest.status === 'registration' && (
              <Button
                onClick={async () => {
                  try {
                    await dispatch(
                      updateContestStatus({ contestId: currentContest.id, status: 'voting' })
                    ).unwrap();
                  } catch (error) {
                    errorHandler.handleError(error, showError, false);
                    showError('Не удалось начать голосование');
                  }
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
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
                    errorHandler.handleError(error, showError, false);
                    showError('Не удалось завершить конкурс');
                  }
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Завершить
              </Button>
            )}
            </div>
          )}
        </div>
        <div className="contest-page-header">
          <h1>{currentContest.title}</h1>
          <span className={`contest-page-status contest-page-status-${currentContest.status}`}>
            {statusLabels[currentContest.status]}
          </span>
          {isAdmin && (
            <>
              <button
                type="button"
                className="contest-page-edit-button"
                onClick={() => setIsEditContestModalOpen(true)}
                aria-label="Редактировать конкурс"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button
                type="button"
                className="contest-page-delete-button"
                onClick={() => setIsDeleteContestModalOpen(true)}
                aria-label="Удалить конкурс"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </>
          )}
        </div>

        <div className="contest-page-description">
          <p>{currentContest.description || 'Нет описания'}</p>
        </div>

        <div className="contest-page-participants">
          <div className="contest-page-participants-header">
            <h2>Участники</h2>
            {/* Allow any authenticated user to add participants during registration phase */}
            {(() => {
              const canAddParticipant = isAuthenticated && (currentContest?.status === 'registration' || currentContest?.status === 'draft');
              return (canAddParticipant || canManageParticipants) ? (
                <div className="contest-page-participants-actions">
                  {isAuthenticated ? (
                    <Button 
                      size="large"
                      onClick={() => setIsAddParticipantModalOpen(true)}
                      className="contest-page-add-participant-button"
                    >
                      <svg 
                        width="20" 
                        height="20" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                        style={{ marginRight: '8px', verticalAlign: 'middle' }}
                      >
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                      Добавить участника
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="large"
                      onClick={() => {
                        const returnUrl = `/contests/${id}`;
                        navigate(buildLoginUrl(returnUrl));
                      }}
                    >
                      Войти для участия
                    </Button>
                  )}
                </div>
              ) : null;
            })()}
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
                  <ParticipantCard 
                    key={participantId} 
                    participant={participant} 
                    contestId={id!}
                    contestStatus={currentContest.status}
                    isContestAdmin={isAdmin}
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
                    onShowVoters={(p) => {
                      setVotersModalParticipant(p);
                      setVotersModalOpen(true);
                    }}
                  />
                ) : null;
              })}
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
          // Always use the latest participant data from Redux store
          participant={editingParticipant.id ? participants[editingParticipant.id] || editingParticipant : editingParticipant}
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

      {votersModalOpen && votersModalParticipant && id && (
        <ParticipantVotersModal
          isOpen={votersModalOpen}
          onClose={() => {
            setVotersModalOpen(false);
            setVotersModalParticipant(null);
          }}
          contestId={id}
          participantId={votersModalParticipant.id}
          participantName={votersModalParticipant.pet_name}
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
                errorHandler.handleError(error, showError, false);
                showError('Не удалось удалить конкурс');
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
