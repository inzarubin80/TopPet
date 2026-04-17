import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { fetchParticipant, fetchParticipantsByContest } from '../store/slices/participantsSlice';
import { fetchComments, createComment, updateComment, deleteComment, voteComment, setCommentVote } from '../store/slices/commentsSlice';
import { fetchContest } from '../store/slices/contestsSlice';
import { fetchStaffCommentNotifications } from '../store/slices/notificationsSlice';
import { Comment as ParticipantComment } from '../types/models';
import { VoteButton } from '../components/contest/VoteButton';
import { EditParticipantModal } from '../components/contest/EditParticipantModal';
import { DeleteParticipantModal } from '../components/contest/DeleteParticipantModal';
import { ParticipantVotersModal } from '../components/contest/ParticipantVotersModal';
import { ParticipantJuryReportModal } from '../components/contest/ParticipantJuryReportModal';
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
import {
  registrationAnswersToDisplaySections,
  type RegistrationAnswerDisplayRow,
} from '../utils/registrationAnswersDisplay';
import { getParticipantDisplayTitle, getParticipantPetNameSubtitle, resolvePublicAssetUrl } from '../utils/seo';
import { juryCriteriaWordRu } from '../utils/juryLabels';
import { buildThreadList } from '../utils/messageTree';
import { getMessengerAvatarColor, getMessengerInitials } from '../utils/messengerAvatar';
import '../components/common/MessengerActionBar.css';
import './ParticipantPage.css';

const EMPTY_COMMENTS: ParticipantComment[] = [];

type ParticipantDescriptionBlocks =
  | { kind: 'single'; title: string; text: string }
  | { kind: 'pair'; workText: string; petText: string };

function RegistrationAnswersDl({ rows }: { rows: RegistrationAnswerDisplayRow[] }) {
  return (
    <dl className="participant-page-registration-list participant-page-registration-dl">
      {rows.map((row) => (
        <div key={row.id} className="participant-page-registration-row">
          <dt className="participant-page-registration-label" title={row.labelTitle}>
            {row.label}
          </dt>
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
  );
}

const ParticipantPage: React.FC = () => {
  const { id: contestId, participantId } = useParams<{ id: string; participantId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch<AppDispatch>();
  const participant = useSelector((state: RootState) =>
    participantId ? state.participants.items[participantId] : undefined
  );
  const comments = useSelector((state: RootState) =>
    participantId ? state.comments.items[participantId] || EMPTY_COMMENTS : EMPTY_COMMENTS
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
  const [juryReportModalOpen, setJuryReportModalOpen] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [replyToComment, setReplyToComment] = useState<ParticipantComment | null>(null);
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

  const { registrationSchemaRows, registrationOrphanRows } = useMemo(() => {
    if (!participant) {
      return { registrationSchemaRows: [] as RegistrationAnswerDisplayRow[], registrationOrphanRows: [] as RegistrationAnswerDisplayRow[] };
    }
    const { schemaRows, orphanRows } = registrationAnswersToDisplaySections(
      registrationFields,
      participant.registration_answers
    );
    return { registrationSchemaRows: schemaRows, registrationOrphanRows: orphanRows };
  }, [registrationFields, participant]);

  const displayTitle = participant ? getParticipantDisplayTitle(participant) : '';
  const petNameSubtitle = participant ? getParticipantPetNameSubtitle(participant) : undefined;

  const descriptionBlocks: ParticipantDescriptionBlocks | null = useMemo(() => {
    if (!participant) {
      return null;
    }
    const work = participant.entry_description?.trim() || '';
    const pet = participant.pet_description?.trim() || '';
    if (!work && !pet) {
      return null;
    }
    if (work && pet && work === pet) {
      return { kind: 'single', title: 'Описание', text: work };
    }
    if (work && pet && work !== pet) {
      return { kind: 'pair', workText: work, petText: pet };
    }
    const only = work || pet;
    return { kind: 'single', title: 'Описание', text: only };
  }, [participant]);

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
        data: { text: newCommentText.trim(), parent_id: replyToComment?.id },
      })
    );
    if (createComment.fulfilled.match(result)) {
      setNewCommentText('');
      setReplyToComment(null);
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
  const threadedComments = useMemo(() => buildThreadList(comments), [comments]);
  const commentsById = useMemo(() => new Map(comments.map((comment) => [comment.id, comment])), [comments]);
  const handleVoteComment = async (comment: ParticipantComment, value: -1 | 1) => {
    const previousVote = (comment.user_vote || 0) as -1 | 0 | 1;
    dispatch(setCommentVote({ commentId: comment.id, value }));
    const result = await dispatch(voteComment({ commentId: comment.id, value }));
    if (voteComment.rejected.match(result)) {
      dispatch(setCommentVote({ commentId: comment.id, value: previousVote }));
    }
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
        <div className="participant-page-title-block">
          <h1>{displayTitle}</h1>
          {petNameSubtitle ? <p className="participant-page-title-sub">{petNameSubtitle}</p> : null}
        </div>
        {(isContestOwner || canEdit) && (
          <div className="participant-page-icon-actions">
            {isContestOwner && (
              <>
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
                {currentContest?.jury_voting_enabled ? (
                  <button
                    type="button"
                    className="participant-page-icon-btn"
                    onClick={() => setJuryReportModalOpen(true)}
                    title="Отчёт по оценкам жюри"
                    aria-label="Отчёт по оценкам жюри"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="8" y1="13" x2="16" y2="13" />
                      <line x1="8" y1="17" x2="14" y2="17" />
                    </svg>
                  </button>
                ) : null}
              </>
            )}
            {canEdit && (
              <>
                <button
                  type="button"
                  className="participant-page-icon-btn"
                  onClick={() => setIsEditModalOpen(true)}
                  title="Редактировать заявку"
                  aria-label="Редактировать заявку"
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
            <PhotoGallery photos={participant.photos} />
          )}
          {!participant.photos?.length && !isOwner && (
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

          {(registrationSchemaRows.length > 0 || registrationOrphanRows.length > 0) && (
            <section
              className="participant-page-registration"
              aria-labelledby={
                registrationSchemaRows.length > 0
                  ? 'participant-registration-heading'
                  : 'participant-registration-extra-heading'
              }
            >
              <div className="participant-page-registration-card">
                {registrationSchemaRows.length > 0 ? (
                  <>
                    <h2 id="participant-registration-heading">Поля заявки</h2>
                    <RegistrationAnswersDl rows={registrationSchemaRows} />
                  </>
                ) : null}
                {registrationOrphanRows.length > 0 ? (
                  <>
                    {registrationSchemaRows.length > 0 ? (
                      <h3
                        id="participant-registration-extra-heading"
                        className="participant-page-registration-orphan-heading"
                      >
                        Дополнительные данные заявки
                      </h3>
                    ) : (
                      <h2 id="participant-registration-extra-heading">
                        Дополнительные данные заявки
                      </h2>
                    )}
                    <RegistrationAnswersDl rows={registrationOrphanRows} />
                  </>
                ) : null}
              </div>
            </section>
          )}

          {descriptionBlocks?.kind === 'single' ? (
            <div className="participant-page-description">
              <h2>{descriptionBlocks.title}</h2>
              <p>{descriptionWithBreaks(descriptionBlocks.text)}</p>
            </div>
          ) : null}
          {descriptionBlocks?.kind === 'pair' ? (
            <>
              <div className="participant-page-description">
                <h2>О работе</h2>
                <p>{descriptionWithBreaks(descriptionBlocks.workText)}</p>
              </div>
              <div className="participant-page-description participant-page-description-pet">
                <h2>О питомце</h2>
                <p>{descriptionWithBreaks(descriptionBlocks.petText)}</p>
              </div>
            </>
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
                onVoted={() => {
                  if (!contestId || !participantId) return;
                  void dispatch(fetchParticipant({ contestId, participantId }));
                }}
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
                {replyToComment && (
                  <div className="participant-page-reply-banner">
                    <span className="participant-page-reply-banner-label">
                      Вы отвечаете…{' '}
                      <span className="participant-page-reply-banner-snippet">
                        {replyToComment.text.slice(0, 120)}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="participant-page-reply-banner-cancel"
                      onClick={() => setReplyToComment(null)}
                    >
                      Отмена
                    </button>
                  </div>
                )}
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
                {threadedComments.map(({ item: comment, depth }) => {
                  const showCommentMenu =
                    editingCommentId !== comment.id &&
                    canComment &&
                    (currentUserId === comment.user_id || isContestOwner);
                  return (
                  <div
                    key={comment.id}
                    className="participant-page-comment"
                    style={{ marginLeft: `${Math.min(depth, 5) * 14}px` }}
                  >
                    <div
                      className="participant-page-comment-avatar"
                      style={{ backgroundColor: getMessengerAvatarColor(comment.user_id) }}
                    >
                      {getMessengerInitials(comment.user_name || `Пользователь ${comment.user_id}`)}
                    </div>
                    <div className="participant-page-comment-content">
                      <div className="participant-page-comment-header">
                        <div className="participant-page-comment-header-titles">
                          <span className="participant-page-comment-author">
                            {comment.user_name || `Пользователь ${comment.user_id}`}
                          </span>
                          {comment.parent_id ? (
                            <span className="participant-page-comment-reply-to">
                              ↪ {commentsById.get(comment.parent_id)?.user_name || 'Сообщение'}
                            </span>
                          ) : null}
                        </div>
                        {showCommentMenu ? (
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
                        ) : null}
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
                      <p className="participant-page-comment-text">{comment.text}</p>
                    )}
                    {editingCommentId !== comment.id && (
                      <div className="participant-page-comment-footer">
                        <div className="messenger-action-bar">
                          <button
                            type="button"
                            className={`messenger-action-btn ${comment.user_vote === 1 ? 'active-positive' : ''}`}
                            disabled={!isAuthenticated}
                            onClick={() => void handleVoteComment(comment, 1)}
                            aria-label="Плюс"
                          >
                            {(comment.score ?? 0) > 0 ? `+ ${comment.score}` : '+'}
                          </button>
                          <button
                            type="button"
                            className={`messenger-action-btn ${comment.user_vote === -1 ? 'active-negative' : ''}`}
                            disabled={!isAuthenticated}
                            onClick={() => void handleVoteComment(comment, -1)}
                            aria-label="Минус"
                          >
                            {(comment.score ?? 0) < 0 ? `- ${Math.abs(comment.score ?? 0)}` : '-'}
                          </button>
                          <button
                            type="button"
                            className="messenger-action-btn messenger-action-reply"
                            disabled={!canComment || !currentUserId}
                            onClick={() => setReplyToComment(comment)}
                          >
                            Ответить
                          </button>
                        </div>
                        <span className="participant-page-comment-time">
                          {new Date(comment.created_at).toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    )}
                    </div>
                  </div>
                  );
                })}
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
            contestMinPhotoCount={currentContest?.min_photo_count}
            contestMaxPhotoCount={currentContest?.max_photo_count}
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
          {contestId && currentContest?.jury_voting_enabled ? (
            <ParticipantJuryReportModal
              isOpen={juryReportModalOpen}
              onClose={() => setJuryReportModalOpen(false)}
              contestId={contestId}
              participantId={participant.id}
              participantName={participant.pet_name}
            />
          ) : null}
        </>
      )}
    </div>
  );
};

export default ParticipantPage;
