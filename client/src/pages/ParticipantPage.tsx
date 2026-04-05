import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { fetchParticipant, fetchParticipantsByContest } from '../store/slices/participantsSlice';
import { fetchComments, createComment, updateComment, deleteComment } from '../store/slices/commentsSlice';
import { fetchContest } from '../store/slices/contestsSlice';
import { fetchStaffCommentNotifications } from '../store/slices/notificationsSlice';
import { Comment as ParticipantComment } from '../types/models';
import { VoteButton } from '../components/contest/VoteButton';
import { EditParticipantModal } from '../components/contest/EditParticipantModal';
import { DeleteParticipantModal } from '../components/contest/DeleteParticipantModal';
import { ParticipantVotersModal } from '../components/contest/ParticipantVotersModal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import { PhotoGallery } from '../components/participant/PhotoGallery';
import { useWebSocket } from '../hooks/useWebSocket';
import { useParticipantPermissions } from '../hooks/useParticipantPermissions';
import { ParticipantMetaTags } from '../components/seo/ParticipantMetaTags';
import { descriptionWithBreaks } from '../utils/formatText';
import { userCanManageContest } from '../utils/contestPermissions';
import { ParticipantJuryScoresPanel } from '../components/contest/ParticipantJuryScoresPanel';
import { markStaffCommentsRead } from '../api/commentsApi';
import { listRegistrationFields } from '../api/registrationFieldsApi';
import { RegistrationField } from '../types/models';
import { registrationAnswersToDisplayRows } from '../utils/registrationAnswersDisplay';
import { resolvePublicAssetUrl } from '../utils/seo';
import { juryCriteriaWordRu } from '../utils/juryLabels';
import './ParticipantPage.css';

const ParticipantPage: React.FC = () => {
  const { id: contestId, participantId } = useParams<{ id: string; participantId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch<AppDispatch>();
  const participant = useSelector((state: RootState) =>
    participantId ? state.participants.items[participantId] : undefined
  );
  const comments = useSelector((state: RootState) =>
    participantId ? state.comments.items[participantId] || [] : []
  ) as ParticipantComment[];
  const commentsLoading = useSelector((state: RootState) => state.comments.loading);
  const { currentContest } = useSelector((state: RootState) => state.contests);
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const currentUserId = currentUser?.id;
  const { isOwner, canEdit } = useParticipantPermissions(
    participant,
    currentUserId,
    currentContest?.status || 'draft',
    currentContest?.public_voting_enabled ?? true
  );
  const canComment = !!(currentContest && (currentContest.status === 'registration' || currentContest.status === 'voting'));
  const isContestOwner =
    !!currentContest &&
    !!currentUserId &&
    userCanManageContest(currentContest, currentUserId, currentUser ?? undefined);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [votersModalOpen, setVotersModalOpen] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [openMenuCommentId, setOpenMenuCommentId] = useState<string | null>(null);
  const [participantFetchSettled, setParticipantFetchSettled] = useState(false);
  const [registrationFields, setRegistrationFields] = useState<RegistrationField[]>([]);
  const commentsSectionRef = useRef<HTMLDivElement | null>(null);
  const staffCommentsMarkedRef = useRef(false);

  useWebSocket(contestId ?? null, participantId ?? null);

  useEffect(() => {
    if (!contestId) {
      return;
    }
    let cancelled = false;
    listRegistrationFields(contestId)
      .then((rows) => {
        if (!cancelled) {
          setRegistrationFields(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRegistrationFields([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [contestId]);

  const registrationRows = useMemo(() => {
    if (!participant) {
      return [];
    }
    return registrationAnswersToDisplayRows(
      registrationFields,
      participant.registration_answers as Record<string, string | number | boolean> | undefined
    );
  }, [registrationFields, participant]);

  useEffect(() => {
    if (!contestId || !participantId) {
      return;
    }
    setParticipantFetchSettled(false);
    dispatch(fetchContest(contestId));
    dispatch(fetchComments({ participantId, limit: 50, offset: 0 }));
    void dispatch(fetchParticipant({ contestId, participantId })).finally(() => {
      setParticipantFetchSettled(true);
    });
  }, [dispatch, contestId, participantId]);

  useEffect(() => {
    if (!isAuthenticated || !isOwner || !participantId || commentsLoading) {
      return;
    }
    void dispatch(fetchStaffCommentNotifications());
  }, [dispatch, isAuthenticated, isOwner, participantId, commentsLoading]);

  useEffect(() => {
    staffCommentsMarkedRef.current = false;
  }, [participantId]);

  useEffect(() => {
    if (!participantFetchSettled || !participant || !isOwner || !participantId || !isAuthenticated) {
      return;
    }
    const el = commentsSectionRef.current;
    if (!el) {
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting);
        if (!visible || staffCommentsMarkedRef.current) {
          return;
        }
        staffCommentsMarkedRef.current = true;
        void (async () => {
          try {
            await markStaffCommentsRead(participantId);
            dispatch(fetchStaffCommentNotifications());
          } catch {
            staffCommentsMarkedRef.current = false;
          }
        })();
      },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [participantFetchSettled, participant, isOwner, participantId, isAuthenticated, dispatch]);

  useEffect(() => {
    if (location.hash !== '#participant-comments' || !participantFetchSettled || !participant) {
      return;
    }
    const t = window.setTimeout(() => {
      document.getElementById('participant-comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    return () => clearTimeout(t);
  }, [location.hash, participantFetchSettled, participant]);

  const handleCreateComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!participantId || !newCommentText.trim() || !canComment) {
      return;
    }
    const result = await dispatch(
      createComment({
        participantId,
        data: { text: newCommentText.trim() },
      })
    );
    if (createComment.fulfilled.match(result)) {
      setNewCommentText('');
    }
  };

  const handleStartEdit = (commentId: string, text: string) => {
    setEditingCommentId(commentId);
    setEditingText(text);
    setOpenMenuCommentId(null);
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditingText('');
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!editingText.trim() || !canComment) {
      return;
    }
    const result = await dispatch(updateComment({ commentId, data: { text: editingText.trim() } }));
    if (updateComment.fulfilled.match(result)) {
      setEditingCommentId(null);
      setEditingText('');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!canComment) {
      return;
    }
    await dispatch(deleteComment(commentId));
    setOpenMenuCommentId(null);
  };

  const toggleCommentMenu = (commentId: string) => {
    setOpenMenuCommentId((prev) => (prev === commentId ? null : commentId));
  };

  if (!participantFetchSettled) {
    return (
      <div className="participant-page-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!participant) {
    return (
      <div className="participant-page-missing">
        <p>Карточка не найдена или недоступна для просмотра.</p>
        {contestId ? (
          <Button variant="primary" onClick={() => navigate(`/contests/${contestId}`)}>
            К конкурсу
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="participant-page">
      {participant && currentContest && contestId && participantId && (
        <ParticipantMetaTags
          participant={participant}
          contest={currentContest}
          contestId={contestId}
          participantId={participantId}
        />
      )}
      <div className="participant-page-header">
        <button
          type="button"
          className="participant-page-back-button"
          onClick={() => navigate(`/contests/${contestId}`)}
          aria-label="Назад"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1>{participant.pet_name}</h1>
        {(isContestOwner || canEdit) && (
          <div className="participant-page-icon-actions">
            {isContestOwner && (
              <button
                type="button"
                className="participant-page-icon-btn"
                onClick={() => setVotersModalOpen(true)}
                title="Кто проголосовал (зрители)"
                aria-label="Кто проголосовал зрители"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </button>
            )}
            {canEdit && (
              <>
                <button
                  type="button"
                  className="participant-page-icon-btn"
                  onClick={() => setIsEditModalOpen(true)}
                  title="Редактировать"
                  aria-label="Редактировать"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
                <button
                  type="button"
                  className="participant-page-icon-btn participant-page-icon-btn-danger"
                  onClick={() => setIsDeleteModalOpen(true)}
                  title="Удалить"
                  aria-label="Удалить"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="participant-page-content">
        <div className="participant-page-media">
          {participant.photos && participant.photos.length > 0 && (
            <PhotoGallery photos={participant.photos} participantId={participant.id} />
          )}
          {participant.video && (
            <div className="participant-page-video">
              <video controls src={participant.video.url} />
            </div>
          )}
          {!participant.photos?.length && !participant.video && !isOwner && (
            <div className="participant-page-media-empty">Нет медиа</div>
          )}
        </div>

        <div className="participant-page-info">
          {participant.submission_status === 'pending' && (isOwner || isContestOwner) && (
            <p className="participant-page-moderation-notice" role="status">
              Заявка на модерации. До решения организатора карточка не отображается другим участникам конкурса.
            </p>
          )}
          {participant.submission_status === 'rejected' && (isOwner || isContestOwner) && (
            <div className="participant-page-moderation-notice participant-page-moderation-notice-rejected" role="status">
              <p>Заявка отклонена. Отредактируйте карточку — она снова уйдёт на модерацию.</p>
              {participant.submission_comment?.trim() ? (
                <blockquote className="participant-page-submission-comment">
                  {participant.submission_comment}
                </blockquote>
              ) : null}
            </div>
          )}

          {registrationRows.length > 0 ? (
            <section className="participant-page-registration" aria-labelledby="participant-registration-heading">
              <h2 id="participant-registration-heading">Поля заявки</h2>
              <dl className="participant-page-registration-list">
                {registrationRows.map((row) => (
                  <div key={row.id} className="participant-page-registration-row">
                    <dt className="participant-page-registration-label">{row.label}</dt>
                    <dd className="participant-page-registration-value">
                      {row.fieldType === 'image' && row.value ? (
                        <img
                          className="participant-page-registration-img"
                          src={resolvePublicAssetUrl(row.value)}
                          alt=""
                        />
                      ) : row.fieldType === 'textarea' ? (
                        <span className="participant-page-registration-textarea">{row.value}</span>
                      ) : (
                        row.value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {participant.pet_description?.trim() ? (
            <div className="participant-page-description">
              <h2>Описание</h2>
              <p>{descriptionWithBreaks(participant.pet_description.trim())}</p>
            </div>
          ) : null}

          {currentContest && (
            <div className="participant-page-vote-button-wrapper">
              <VoteButton
                contestId={currentContest.id}
                participantId={participant.id}
                contestStatus={currentContest.status}
                nominationId={participant.nomination_id}
                isOwner={!!isOwner}
                publicVotingEnabled={currentContest.public_voting_enabled ?? true}
                canReceiveVotes={
                  !participant.submission_status || participant.submission_status === 'accepted'
                }
                voteCtaLabel={currentContest.cta_label_override?.trim() || undefined}
              />
            </div>
          )}

          {currentContest &&
            currentContest.jury_voting_enabled &&
            currentContest.status !== 'draft' &&
            currentContest.status !== 'publication' &&
            isAuthenticated &&
            currentUserId !== undefined && (
              <ParticipantJuryScoresPanel
                contestId={currentContest.id}
                participantId={participant.id}
                contestStatus={currentContest.status}
                currentUserId={currentUserId}
                onScoresSaved={() => {
                  if (contestId) {
                    void dispatch(fetchParticipant({ contestId, participantId: participant.id }));
                  }
                }}
              />
            )}

          <div className="participant-page-votes">
            <p className="participant-page-votes-text">Голосов: {participant.total_votes || 0}</p>
            {currentContest?.jury_voting_enabled && participant.total_jury_score !== undefined ? (
              <>
                <p
                  className="participant-page-jury-total"
                  title={
                    participant.jury_member_count != null &&
                    participant.jury_criteria_count != null &&
                    participant.jury_fully_scored_jurors != null
                      ? `Полностью оценили работу (${participant.jury_criteria_count} ${juryCriteriaWordRu(participant.jury_criteria_count)}): ${participant.jury_fully_scored_jurors} из ${participant.jury_member_count} членов жюри.`
                      : 'Сумма оценок жюри по всем критериям и всем членам жюри'
                  }
                >
                  Сумма оценок жюри: {participant.total_jury_score}
                </p>
                {participant.jury_member_count != null &&
                participant.jury_criteria_count != null &&
                participant.jury_fully_scored_jurors != null ? (
                  <p className="participant-page-jury-progress">
                    Оценили полностью все критерии: {participant.jury_fully_scored_jurors} из{' '}
                    {participant.jury_member_count} членов жюри ({participant.jury_criteria_count}{' '}
                    {juryCriteriaWordRu(participant.jury_criteria_count)}).
                  </p>
                ) : null}
              </>
            ) : null}
            {currentContest?.status === 'finished' &&
            (participant.is_audience_winner || participant.is_jury_winner) ? (
              <p className="participant-page-winner-notice" role="status">
                {participant.is_audience_winner && participant.is_jury_winner
                  ? 'Победитель по голосам зрителей и по сумме оценок жюри в этой номинации.'
                  : participant.is_audience_winner
                    ? 'Победитель по голосам зрителей в этой номинации.'
                    : 'Победитель по сумме оценок жюри в этой номинации.'}
              </p>
            ) : null}
          </div>

          <div
            className="participant-page-comments"
            id="participant-comments"
            ref={commentsSectionRef}
          >
            <h2>Комментарии</h2>
            {currentUserId ? (
              canComment ? (
              <form className="participant-page-comment-form" onSubmit={handleCreateComment}>
                <textarea
                  className="participant-page-comment-input"
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Напишите комментарий..."
                  maxLength={2000}
                />
                <div className="participant-page-comment-actions">
                  <Button type="submit" size="small" disabled={!newCommentText.trim()}>
                    Отправить
                  </Button>
                </div>
              </form>
              ) : (
                <div className="participant-page-comment-auth">
                  Комментарии доступны на этапах регистрации и голосования
                </div>
              )
            ) : (
              <div className="participant-page-comment-auth">Войдите, чтобы оставить комментарий</div>
            )}
            {comments.length === 0 ? (
              <p>Нет комментариев</p>
            ) : (
              <div className="participant-page-comments-list">
                {comments.map((comment) => (
                  <div key={comment.id} className="participant-page-comment">
                    <div className="comment-header">
                      <span>{comment.user_name || `Пользователь ${comment.user_id}`}</span>
                      <span>{new Date(comment.created_at).toLocaleDateString('ru-RU')}</span>
                    </div>
                    {editingCommentId === comment.id ? (
                      <div className="participant-page-comment-edit">
                        <textarea
                          className="participant-page-comment-input"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          maxLength={2000}
                        />
                        <div className="participant-page-comment-actions">
                          <Button
                            type="button"
                            size="small"
                            variant="secondary"
                            onClick={handleCancelEdit}
                          >
                            Отмена
                          </Button>
                          <Button type="button" size="small" onClick={() => handleUpdateComment(comment.id)}>
                            Сохранить
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p>{comment.text}</p>
                    )}
                    {editingCommentId !== comment.id && canComment && (currentUserId === comment.user_id || isContestOwner) && (
                      <div className="participant-page-comment-menu">
                        <button
                          type="button"
                          className="comment-menu-trigger"
                          onClick={() => toggleCommentMenu(comment.id)}
                          aria-label="Открыть меню"
                        >
                          ⋯
                        </button>
                        {openMenuCommentId === comment.id && (
                          <div className="comment-menu">
                            {currentUserId === comment.user_id && (
                              <button
                                type="button"
                                className="comment-menu-item"
                                onClick={() => handleStartEdit(comment.id, comment.text)}
                              >
                                Редактировать
                              </button>
                            )}
                            {(currentUserId === comment.user_id || isContestOwner) && (
                              <button
                                type="button"
                                className="comment-menu-item danger"
                                onClick={() => handleDeleteComment(comment.id)}
                              >
                                Удалить
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {participant && (
        <>
          <EditParticipantModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            participant={participant}
          />
          <DeleteParticipantModal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            participant={participant}
            onDeleted={() => {
              // Refresh participants list and navigate back to contest
              if (contestId) {
                dispatch(fetchParticipantsByContest(contestId));
                navigate(`/contests/${contestId}`);
              }
            }}
          />
          {contestId && (
            <ParticipantVotersModal
              isOpen={votersModalOpen}
              onClose={() => setVotersModalOpen(false)}
              contestId={contestId}
              participantId={participant.id}
              participantName={participant.pet_name}
            />
          )}
        </>
      )}
    </div>
  );
};

export default ParticipantPage;
