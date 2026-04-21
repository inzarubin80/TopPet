import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import {
  fetchParticipant,
  fetchParticipantsByContest,
  fetchMyParticipantsForContest,
} from '../../store/slices/participantsSlice';
import { fetchComments, createComment, updateComment, deleteComment, voteComment, setCommentVote } from '../../store/slices/commentsSlice';
import { fetchContest } from '../../store/slices/contestsSlice';
import { Comment as ParticipantComment } from '../../types/models';
import { EditParticipantModal } from '../contest/EditParticipantModal';
import { DeleteParticipantModal } from '../contest/DeleteParticipantModal';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { Button } from '../common/Button';
import { VoteButton } from '../contest/VoteButton';
import { ParticipantVotersModal } from '../contest/ParticipantVotersModal';
import { PhotoGallery } from './PhotoGallery';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useParticipantPermissions } from '../../hooks/useParticipantPermissions';
import { ParticipantMetaTags } from '../seo/ParticipantMetaTags';
import { descriptionWithBreaks } from '../../utils/formatText';
import { userCanManageContest } from '../../utils/contestPermissions';
import { getEffectiveContestStatus } from '../../utils/contestEffectiveStatus';
import { markStaffCommentsRead, uploadCommentImage } from '../../api/commentsApi';
import { listRegistrationFields } from '../../api/registrationFieldsApi';
import { Nomination, RegistrationField } from '../../types/models';
import { listNominations } from '../../api/nominationsApi';
import { sortNominationsByOrder } from '../contest/contestNominationsDisplay';
import {
  registrationAnswersToDisplaySections,
  type RegistrationAnswerDisplayRow,
} from '../../utils/registrationAnswersDisplay';
import { getParticipantDisplayTitle, getParticipantPetNameSubtitle, resolvePublicAssetUrl } from '../../utils/seo';
import { getMessengerAvatarColor, getMessengerInitials } from '../../utils/messengerAvatar';
import { participantAuthorDisplayName } from '../../utils/participantDisplay';
import { userIdsEqual } from '../../utils/userId';
import { MessageList } from '../chat/MessageList';
import { MessageInput, MessageSendPayload } from '../chat/MessageInput';
import '../chat/ChatWindow.css';
import { buildLoginUrl } from '../../utils/navigation';
import '../../pages/ParticipantPage.css';

const EMPTY_COMMENTS: ParticipantComment[] = [];

/** Для сравнения с заголовком: trim и схлопывание пробелов/переносов. */
function normalizeComparableParticipantText(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

type ParticipantDescriptionBlocks = { kind: 'single'; title: string; text: string };

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

export type ParticipantCardBodyProps = {
  contestId: string;
  participantId: string;
  variant?: 'page' | 'modal';
  /** Кнопка «назад к конкурсу» (в модалке жюри обычно скрыта). */
  showBackButton?: boolean;
};

export const ParticipantCardBody: React.FC<ParticipantCardBodyProps> = ({
  contestId,
  participantId,
  variant = 'page',
  showBackButton = variant !== 'modal',
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch<AppDispatch>();
  const participant = useSelector((state: RootState) =>
    participantId ? state.participants.items[participantId] : undefined
  );

  /** Карточка уже в Redux (список жюри и т.д.); contest_id может отсутствовать в кратком DTO. */
  const haveParticipantInStore = useMemo(() => {
    if (!participant || participant.id !== participantId) {
      return false;
    }
    if (participant.contest_id == null || participant.contest_id === '') {
      return true;
    }
    return participant.contest_id === contestId;
  }, [participant, participantId, contestId]);

  const comments = useSelector((state: RootState) =>
    participantId ? state.comments.items[participantId] || EMPTY_COMMENTS : EMPTY_COMMENTS
  ) as ParticipantComment[];
  const { currentContest } = useSelector((state: RootState) => state.contests);
  /** Пока store не подтянул конкурс по маршруту, в currentContest может оставаться предыдущий — иначе права (организатор) считаются для чужого конкурса. */
  const contestForThisPage = currentContest?.id === contestId ? currentContest : null;
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const currentUserId = currentUser?.id;
  const myContestParticipants = useSelector((state: RootState) =>
    contestId ? state.participants.mineByContest[contestId] ?? [] : []
  );
  const [editModalNominations, setEditModalNominations] = useState<Nomination[]>([]);

  useEffect(() => {
    if (!contestId) return;
    let cancelled = false;
    void listNominations(contestId)
      .then((rows) => {
        if (!cancelled) setEditModalNominations([...rows].sort(sortNominationsByOrder));
      })
      .catch(() => {
        if (!cancelled) setEditModalNominations([]);
      });
    return () => {
      cancelled = true;
    };
  }, [contestId]);

  useEffect(() => {
    if (!contestId || !currentUserId) return;
    void dispatch(fetchMyParticipantsForContest({ contestId }));
  }, [contestId, currentUserId, dispatch]);
  const contestPhase = contestForThisPage
    ? getEffectiveContestStatus(contestForThisPage)
    : 'draft';
  const phaseAllowsLikes =
    contestPhase === 'registration' || contestPhase === 'voting';
  const { isOwner, canEdit } = useParticipantPermissions(participant, currentUserId, contestPhase);
  /** Только автор заявки в фазе приёма/черновика; удаление на сервере разрешено только автору. */
  const showOwnerParticipantActions = isOwner && canEdit;
  /** После загрузки конкурса в store; этап конкурса не ограничивает комментарии. */
  const canComment = !!contestForThisPage;
  const isContestOwner =
    !!contestForThisPage &&
    !!currentUserId &&
    userCanManageContest(contestForThisPage, currentUserId, currentUser ?? undefined);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isVotersModalOpen, setIsVotersModalOpen] = useState(false);
  const [replyToComment, setReplyToComment] = useState<ParticipantComment | null>(null);
  const [participantFetchSettled, setParticipantFetchSettled] = useState(false);
  const [registrationFields, setRegistrationFields] = useState<RegistrationField[]>([]);
  const commentsSectionRef = useRef<HTMLDivElement | null>(null);
  const staffCommentsMarkedRef = useRef(false);
  /** Чтобы не сбрасывать «загрузка» при повторном запуске эффекта с теми же id (Strict Mode / лишние deps). */
  const participantLoadKeyRef = useRef<string | null>(null);

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
  const entrySummaryText = participant?.entry_description?.trim() || '';

  const descriptionBlocks: ParticipantDescriptionBlocks | null = useMemo(() => {
    if (!participant) {
      return null;
    }
    const entry = participant.entry_description?.trim() || '';
    const pet = participant.pet_description?.trim() || '';
    const entryInHeader = entry.length > 0;
    if (entryInHeader && (!pet || pet === entry)) {
      return null;
    }
    if (!entryInHeader && !pet) {
      return null;
    }
    if (!entryInHeader && pet) {
      return { kind: 'single', title: 'Описание', text: pet };
    }
    if (entryInHeader && pet && pet !== entry) {
      return { kind: 'single', title: 'О питомце', text: pet };
    }
    return null;
  }, [participant]);

  useEffect(() => {
    if (!contestId || !participantId) {
      participantLoadKeyRef.current = null;
      setParticipantFetchSettled(true);
      return;
    }
    const loadKey = `${contestId}:${participantId}`;
    const sameKeyAsLast = participantLoadKeyRef.current === loadKey;
    if (!sameKeyAsLast) {
      participantLoadKeyRef.current = loadKey;
      setParticipantFetchSettled(false);
    }
    // Не дергать fetchContest, если конкурс уже в store — иначе pending выставит contests.loading,
    // ContestPage уйдёт в полноэкранный спиннер и размонтирует вкладку жюри вместе с модалкой.
    if (currentContest?.id !== contestId) {
      void dispatch(fetchContest(contestId));
    }
    dispatch(fetchComments({ participantId, limit: 50, offset: 0 }));
    void dispatch(fetchParticipant({ contestId, participantId })).finally(() => {
      setParticipantFetchSettled(true);
    });
  }, [dispatch, contestId, participantId, currentContest?.id]);

  useEffect(() => {
    if (haveParticipantInStore && !participantFetchSettled) {
      setParticipantFetchSettled(true);
    }
  }, [haveParticipantInStore, participantFetchSettled]);

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

  const handleSendComment = async (payload: MessageSendPayload) => {
    if (!participantId || !canComment) {
      return;
    }
    const t = payload.text.trim();
    if (t === '' && !payload.imageUrl) {
      return;
    }
    const result = await dispatch(
      createComment({
        participantId,
        data: {
          text: t,
          parent_id: replyToComment?.id,
          image_url: payload.imageUrl || undefined,
        },
      })
    );
    if (createComment.fulfilled.match(result)) {
      setReplyToComment(null);
    }
  };

  const handleCommentUpdateFromList = async (messageId: string, text: string) => {
    if (!text.trim() || !canComment) {
      return;
    }
    const target = comments.find((c) => c.id === messageId);
    if (!target || !userIdsEqual(currentUserId, target.user_id)) {
      return;
    }
    await dispatch(updateComment({ commentId: messageId, data: { text: text.trim() } }));
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!canComment) {
      return;
    }
    await dispatch(deleteComment(commentId));
  };
  const handleVoteComment = async (comment: ParticipantComment, value: -1 | 1) => {
    const previousVote = (comment.user_vote || 0) as -1 | 0 | 1;
    dispatch(setCommentVote({ commentId: comment.id, value }));
    const result = await dispatch(voteComment({ commentId: comment.id, value }));
    if (voteComment.rejected.match(result)) {
      dispatch(setCommentVote({ commentId: comment.id, value: previousVote }));
    }
  };

  if (!participantFetchSettled && !haveParticipantInStore) {
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
          <Button variant="primary" onClick={() => navigate(`/contests/${contestId}#gallery`)}>
            В галерею
          </Button>
        ) : null}
      </div>
    );
  }

  const commentsHeadingCount =
    participant.comment_count != null ? participant.comment_count : comments.length;

  const entrySummaryNormalized = normalizeComparableParticipantText(participant.entry_description ?? '');
  const showEntrySummaryInHeading =
    entrySummaryNormalized.length > 0 &&
    entrySummaryNormalized !== normalizeComparableParticipantText(displayTitle) &&
    (!petNameSubtitle ||
      entrySummaryNormalized !== normalizeComparableParticipantText(petNameSubtitle));

  const infoDetails = (
    <>
      {participant.submission_status === 'pending' && (isOwner || isContestOwner) && (
        <div className="participant-page-moderation-notice" role="status">
          <p>
            Заявка на модерации. До решения организатора карточка не отображается другим участникам конкурса.
            {isOwner ? <> Для отправки на повторную модерацию отредактируйте заявку.</> : null}
          </p>
          {participant.submission_comment?.trim() ? (
            <blockquote className="participant-page-submission-comment participant-page-submission-comment--prior">
              {participant.submission_comment}
            </blockquote>
          ) : null}
        </div>
      )}
      {participant.submission_status === 'rejected' && (isOwner || isContestOwner) && (
        <div
          className="participant-page-moderation-notice participant-page-moderation-notice-rejected"
          role="status"
        >
          <p>Заявка отклонена. Отредактируйте карточку — она снова уйдёт на модерацию.</p>
          {participant.submission_comment?.trim() ? (
            <blockquote className="participant-page-submission-comment">
              {participant.submission_comment}
            </blockquote>
          ) : null}
          {isOwner ? (
            <p className="participant-page-moderation-reply-hint">
              Ответить организатору можно в блоке{' '}
              <a className="participant-page-moderation-comments-link" href="#participant-comments">
                «Комментарии»
              </a>{' '}
              ниже.
            </p>
          ) : null}
        </div>
      )}

      {(registrationSchemaRows.length > 0 || registrationOrphanRows.length > 0) && (
        <details className="participant-page-registration-details">
          <summary className="participant-page-registration-summary">
            Дополнительные поля
          </summary>
          <section className="participant-page-registration">
            <div className="participant-page-registration-card">
              {registrationSchemaRows.length > 0 ? (
                <RegistrationAnswersDl rows={registrationSchemaRows} />
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
        </details>
      )}

      {descriptionBlocks?.kind === 'single' ? (
        <div className="participant-page-description">
          <h2>{descriptionBlocks.title}</h2>
          <p>{descriptionWithBreaks(descriptionBlocks.text)}</p>
        </div>
      ) : null}
    </>
  );

  const authorDisplayLabel = participantAuthorDisplayName(participant, { isOwner });

  const workHeading = (
    <header
      className={
        variant === 'page'
          ? 'participant-page-work-heading participant-page-work-heading--work-view'
          : 'participant-page-work-heading participant-page-work-heading--hero'
      }
    >
      <h1 className="participant-page-work-title">{displayTitle}</h1>
      {showEntrySummaryInHeading ? (
        <div className="participant-page-entry-summary">{descriptionWithBreaks(entrySummaryText)}</div>
      ) : null}
      {petNameSubtitle ? <p className="participant-page-title-sub">{petNameSubtitle}</p> : null}
      {authorDisplayLabel.trim() ? (
        <div className="participant-page-author" aria-label={`Автор: ${authorDisplayLabel}`}>
          {participant.user_avatar_url ? (
            <img
              className="participant-page-author-avatar"
              src={resolvePublicAssetUrl(participant.user_avatar_url)}
              alt=""
              width={40}
              height={40}
              decoding="async"
            />
          ) : (
            <div
              className="participant-page-author-avatar participant-page-author-avatar--placeholder"
              style={{ backgroundColor: getMessengerAvatarColor(participant.user_id) }}
              aria-hidden
            >
              {getMessengerInitials(authorDisplayLabel)}
            </div>
          )}
          <span className="participant-page-author-name">{authorDisplayLabel}</span>
        </div>
      ) : null}
    </header>
  );

  const mediaBlock = (
    <div
      className={
        variant === 'page' ? 'participant-page-media participant-page-media--hero' : 'participant-page-media'
      }
    >
      {participant.photos && participant.photos.length > 0 && (
        <PhotoGallery photos={participant.photos} />
      )}
      {!participant.photos?.length && !isOwner && (
        <div className="participant-page-media-empty">Нет медиа</div>
      )}
    </div>
  );

  const showSplitBackRail = variant === 'page' && showBackButton;

  const splitBackRail =
    showSplitBackRail ? (
      <div className="participant-page-split-back" role="navigation" aria-label="Навигация">
        <div className="participant-page-back-cluster participant-page-back-cluster--split-rail">
          <button
            type="button"
            className="participant-page-back-button participant-page-back-button--split-rail"
            onClick={() => contestId && navigate(`/contests/${contestId}#gallery`)}
            aria-label="В галерею конкурса"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          {showOwnerParticipantActions && participant.photos?.length ? (
            <div className="participant-page-split-rail-actions" role="toolbar" aria-label="Действия с заявкой">
              <button
                type="button"
                className="participant-page-icon-btn participant-page-icon-btn--split-rail"
                onClick={() => setIsEditModalOpen(true)}
                title="Редактировать заявку"
                aria-label="Редактировать заявку"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button
                type="button"
                className="participant-page-icon-btn participant-page-icon-btn-danger participant-page-icon-btn--split-rail"
                onClick={() => setIsDeleteModalOpen(true)}
                title="Удалить"
                aria-label="Удалить"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    ) : null;

  const breadcrumb =
    variant === 'page' && contestForThisPage && contestId ? (
      <nav className="participant-page-breadcrumb" aria-label="Навигация по конкурсу">
        <button
          type="button"
          className="participant-page-breadcrumb-link"
          onClick={() => navigate(`/contests/${contestId}#gallery`)}
        >
          {contestForThisPage.title}
        </button>
        <span className="participant-page-breadcrumb-sep" aria-hidden="true">
          /
        </span>
        <span className="participant-page-breadcrumb-current">{displayTitle}</span>
      </nav>
    ) : null;

  const commentsSection = (
    <section
      className={
        variant === 'modal'
          ? 'participant-page-comments-section participant-page-comments-surface participant-page-comments-surface--modal'
          : 'participant-page-comments-section participant-page-comments-surface participant-page-comments-surface--work-view participant-page-comments-section--split'
      }
      id="participant-comments"
      ref={commentsSectionRef}
      aria-label="Комментарии к работе"
    >
      <h2 className="participant-page-comments-section-title">
        Комментарии{' '}
        <span className="participant-page-comments-count">{commentsHeadingCount}</span>
      </h2>
      <div className="chat-window participant-page-comments-window">
        <div className="chat-content">
          <MessageList
            className={variant === 'page' ? 'message-list--participant-work-page' : undefined}
            messages={comments}
            containedScroll={variant !== 'page'}
            currentUserId={currentUserId}
            canVote={isAuthenticated}
            canReply={!!currentUserId && canComment}
            emptyLabel="Нет комментариев"
            canEditMessage={(m) => userIdsEqual(currentUserId, m.user_id)}
            canDeleteMessage={(m) =>
              userIdsEqual(currentUserId, m.user_id) || (!!currentUserId && isContestOwner)
            }
            onUpdateMessage={(messageId, text) => void handleCommentUpdateFromList(messageId, text)}
            onDeleteMessage={(messageId) => void handleDeleteComment(messageId)}
            onReply={(m) => {
              const c = comments.find((x) => x.id === m.id);
              if (c) {
                setReplyToComment(c);
              }
            }}
            onVote={(messageId, value) => {
              const c = comments.find((x) => x.id === messageId);
              if (c) {
                void handleVoteComment(c, value);
              }
            }}
          />
        </div>
        <div className="chat-footer">
          {currentUserId && canComment ? (
            <>
              {replyToComment ? (
                <div className="chat-reply-banner">
                  <span className="chat-reply-banner-label">
                    Вы отвечаете…{' '}
                    <span className="chat-reply-banner-snippet">
                      {(replyToComment.text || 'Вложение').slice(0, 120)}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="chat-reply-banner-cancel"
                    onClick={() => setReplyToComment(null)}
                  >
                    Отмена
                  </button>
                </div>
              ) : null}
              <MessageInput
                onSend={(p) => void handleSendComment(p)}
                uploadImage={
                  participantId ? (file) => uploadCommentImage(participantId, file) : undefined
                }
                disabled={!participantId}
                placeholder="Написать сообщение"
              />
            </>
          ) : currentUserId && !canComment ? (
            <div className="chat-auth-required">Загрузка данных конкурса…</div>
          ) : (
            <div className="chat-auth-required">
              <div className="chat-auth-required-content">
                <span>Войдите, чтобы оставить комментарий</span>
                <Button
                  size="small"
                  fullWidth
                  onClick={() => navigate(buildLoginUrl(location.pathname + location.search))}
                >
                  Войти
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );

  /** На странице работы с фото кнопки в шапке не показываются (они в split-rail) — пустой header всё равно давал margin/padding. */
  const showHeaderBackCluster = showBackButton && variant !== 'page';
  const showHeaderOwnerIconActions =
    showOwnerParticipantActions && (variant !== 'page' || !participant.photos?.length);
  const renderParticipantPageHeader = showHeaderBackCluster || showHeaderOwnerIconActions;

  return (
    <div
      className={[
        'participant-page',
        variant === 'modal' ? 'participant-page--modal' : '',
        variant === 'page' ? 'participant-page--work-view' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {participant && contestForThisPage && contestId && participantId && variant === 'page' && (
        <ParticipantMetaTags
          participant={participant}
          contest={contestForThisPage}
          contestId={contestId}
          participantId={participantId}
        />
      )}
      {renderParticipantPageHeader ? (
        <div
          className={[
            'participant-page-header',
            variant === 'page' ? 'participant-page-header--work-view' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {showHeaderBackCluster ? (
            <div className="participant-page-back-cluster">
              <button
                type="button"
                className="participant-page-back-button"
                onClick={() => navigate(`/contests/${contestId}#gallery`)}
                aria-label="В галерею"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
            </div>
          ) : null}
          {showHeaderOwnerIconActions ? (
            <div className="participant-page-icon-actions">
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
            </div>
          ) : null}
        </div>
      ) : null}

      <main
        className={[
          'participant-page-main',
          variant === 'page' ? 'participant-page-main--work-view' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <article
          className={
            variant === 'modal'
              ? 'participant-page-article participant-page-article--modal'
              : 'participant-page-article participant-page-article--work-view'
          }
        >
          {variant === 'page' ? (
            <div
              className={[
                'participant-page-content participant-page-content--work-view participant-page-content--split',
                showSplitBackRail ? 'participant-page-content--split-with-back' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {splitBackRail}
              <div className="participant-page-split-media">
                <div className="participant-page-hero-stage">
                  {mediaBlock}
                </div>
              </div>
              <div className="participant-page-split-aside">
                <div className="participant-page-work-meta">
                  {breadcrumb}
                  {workHeading}
                  <div className="participant-page-info participant-page-info--work-view">
                    {infoDetails}
                  </div>
                </div>
                {contestForThisPage ? (
                  <div className="participant-page-like-row">
                    <VoteButton
                      contestId={contestId}
                      participantId={participantId}
                      nominationId={participant.nomination_id ?? null}
                      canReceiveVotes={
                        participant.submission_status == null ||
                        participant.submission_status === 'accepted'
                      }
                      phaseAllowsLikes={phaseAllowsLikes}
                      appearance="statStrip"
                      totalVotes={participant.total_votes ?? 0}
                      fullWidth
                      onViewLikes={() => setIsVotersModalOpen(true)}
                    />
                  </div>
                ) : null}
                {commentsSection}
              </div>
            </div>
          ) : (
            <div className="participant-page-content">
              {workHeading}
              {mediaBlock}
              <div className="participant-page-info">
                {infoDetails}
              </div>
              {contestForThisPage ? (
                <div className="participant-page-like-row">
                  <VoteButton
                    contestId={contestId}
                    participantId={participantId}
                    nominationId={participant.nomination_id ?? null}
                    canReceiveVotes={
                      participant.submission_status == null ||
                      participant.submission_status === 'accepted'
                    }
                    phaseAllowsLikes={phaseAllowsLikes}
                    appearance="statStrip"
                    totalVotes={participant.total_votes ?? 0}
                    fullWidth
                    onViewLikes={() => setIsVotersModalOpen(true)}
                  />
                </div>
              ) : null}
            </div>
          )}
        </article>
      </main>

      {variant === 'modal' ? commentsSection : null}

      {participant && (
        <>
          <EditParticipantModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            participant={participant}
            nominations={editModalNominations}
            myContestParticipants={myContestParticipants}
            contestMinPhotoCount={contestForThisPage?.min_photo_count}
            contestMaxPhotoCount={contestForThisPage?.max_photo_count}
          />
          <DeleteParticipantModal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            participant={participant}
            currentUserId={currentUserId}
            onDeleted={() => {
              // Refresh participants list and navigate back to contest
              if (contestId) {
                dispatch(fetchParticipantsByContest(contestId));
                navigate(`/contests/${contestId}#gallery`);
              }
            }}
          />
          <ParticipantVotersModal
            isOpen={isVotersModalOpen}
            onClose={() => setIsVotersModalOpen(false)}
            contestId={contestId}
            participantId={participantId}
            participantName={displayTitle}
          />
        </>
      )}
    </div>
  );
};
