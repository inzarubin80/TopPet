import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { fetchParticipant, fetchParticipantsByContest } from '../../store/slices/participantsSlice';
import { fetchComments, createComment, updateComment, deleteComment, voteComment, setCommentVote } from '../../store/slices/commentsSlice';
import { fetchContest } from '../../store/slices/contestsSlice';
import { fetchStaffCommentNotifications } from '../../store/slices/notificationsSlice';
import { Comment as ParticipantComment } from '../../types/models';
import { EditParticipantModal } from '../contest/EditParticipantModal';
import { DeleteParticipantModal } from '../contest/DeleteParticipantModal';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { Button } from '../common/Button';
import { PhotoGallery } from './PhotoGallery';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useParticipantPermissions } from '../../hooks/useParticipantPermissions';
import { ParticipantMetaTags } from '../seo/ParticipantMetaTags';
import { descriptionWithBreaks } from '../../utils/formatText';
import { userCanManageContest } from '../../utils/contestPermissions';
import { markStaffCommentsRead } from '../../api/commentsApi';
import { listRegistrationFields } from '../../api/registrationFieldsApi';
import { RegistrationField } from '../../types/models';
import {
  registrationAnswersToDisplaySections,
  type RegistrationAnswerDisplayRow,
} from '../../utils/registrationAnswersDisplay';
import { getParticipantDisplayTitle, getParticipantPetNameSubtitle, resolvePublicAssetUrl } from '../../utils/seo';
import { getMessengerAvatarColor, getMessengerInitials } from '../../utils/messengerAvatar';
import type { ParticipantGalleryNavigationState } from '../../types/participantNavigation';
import { MessageList } from '../chat/MessageList';
import { MessageInput } from '../chat/MessageInput';
import '../chat/ChatWindow.css';
import { buildLoginUrl } from '../../utils/navigation';
import '../../pages/ParticipantPage.css';

const EMPTY_COMMENTS: ParticipantComment[] = [];
const DEFAULT_GALLERY_PAGE_SIZE = 24;

type ParticipantDescriptionBlocks =
  | { kind: 'single'; title: string; text: string }
  | { kind: 'pair'; workText: string; petText: string };

type ParticipantLocationState = {
  galleryNavigation?: ParticipantGalleryNavigationState;
};

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
  /** Принудительно отключить «Предыдущая работа». */
  lockWorkNavigationPrevious?: boolean;
  /** Принудительно отключить «Следующая работа». */
  lockWorkNavigationNext?: boolean;
};

export const ParticipantCardBody: React.FC<ParticipantCardBodyProps> = ({
  contestId,
  participantId,
  variant = 'page',
  showBackButton = variant !== 'modal',
  lockWorkNavigationPrevious = false,
  lockWorkNavigationNext = false,
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
  const commentsLoading = useSelector((state: RootState) => state.comments.loading);
  const participantIds = useSelector((state: RootState) =>
    contestId ? state.participants.byContest[contestId] || [] : []
  );
  const participantsListTotal = useSelector((state: RootState) =>
    contestId ? state.participants.listTotalByContest[contestId] ?? 0 : 0
  );
  const { currentContest } = useSelector((state: RootState) => state.contests);
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const currentUserId = currentUser?.id;
  const { isOwner, canEdit } = useParticipantPermissions(
    participant,
    currentUserId,
    currentContest?.status || 'draft',
    currentContest?.public_voting_enabled ?? true
  );
  /** После загрузки конкурса в store; этап конкурса не ограничивает комментарии. */
  const canComment = !!currentContest;
  const isContestOwner =
    !!currentContest &&
    !!currentUserId &&
    userCanManageContest(currentContest, currentUserId, currentUser ?? undefined);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [replyToComment, setReplyToComment] = useState<ParticipantComment | null>(null);
  const [participantFetchSettled, setParticipantFetchSettled] = useState(false);
  const [participantNavPending, setParticipantNavPending] = useState(false);
  const [registrationFields, setRegistrationFields] = useState<RegistrationField[]>([]);
  const commentsSectionRef = useRef<HTMLDivElement | null>(null);
  const staffCommentsMarkedRef = useRef(false);
  /** Чтобы не сбрасывать «загрузка» при повторном запуске эффекта с теми же id (Strict Mode / лишние deps). */
  const participantLoadKeyRef = useRef<string | null>(null);

  const locationState = location.state as ParticipantLocationState | null;
  const galleryNavigation = locationState?.galleryNavigation;
  const hasGalleryNavigation =
    !!contestId &&
    !!galleryNavigation &&
    galleryNavigation.contestId === contestId &&
    galleryNavigation.total > 1;
  /** Навигация по соседним работам отключена при просмотре из отфильтрованного списка «только избранное». */
  const showGalleryWorkNav = hasGalleryNavigation && !galleryNavigation.favoritesOnly;
  const currentGalleryPage = hasGalleryNavigation ? Math.max(0, galleryNavigation.page) : 0;
  const currentGalleryPageSize = hasGalleryNavigation
    ? Math.max(1, galleryNavigation.pageSize || DEFAULT_GALLERY_PAGE_SIZE)
    : DEFAULT_GALLERY_PAGE_SIZE;
  const currentParticipantIndex = participantId ? participantIds.indexOf(participantId) : -1;
  const hasPreviousParticipant = showGalleryWorkNav
    ? currentParticipantIndex > 0 || currentGalleryPage > 0
    : false;
  const hasNextParticipant = showGalleryWorkNav
    ? currentParticipantIndex >= 0 &&
      (currentParticipantIndex < participantIds.length - 1 ||
        (currentGalleryPage + 1) * currentGalleryPageSize < galleryNavigation!.total)
    : false;

  const buildGalleryNavigationState = (
    page: number,
    total: number
  ): ParticipantGalleryNavigationState | undefined => {
    if (!hasGalleryNavigation || !galleryNavigation) {
      return undefined;
    }
    return {
      ...galleryNavigation,
      page,
      total,
    };
  };

  const navigateToParticipantInGallery = (
    targetParticipantId: string,
    page: number,
    total: number
  ) => {
    if (!contestId) {
      return;
    }
    navigate(`/contests/${contestId}/participants/${targetParticipantId}`, {
      state: { galleryNavigation: buildGalleryNavigationState(page, total) },
    });
  };

  const fetchGalleryPage = async (page: number) => {
    if (!contestId || !hasGalleryNavigation || !galleryNavigation) {
      return null;
    }
    const result = await dispatch(
      fetchParticipantsByContest({
        contestId,
        nominationFilter: galleryNavigation.nominationFilter,
        submissionFilter: galleryNavigation.submissionFilter,
        juryUnscoredOnly: galleryNavigation.juryUnscoredOnly,
        votedOnly: galleryNavigation.votedOnly,
        favoriteOnly: galleryNavigation.favoritesOnly ?? false,
        sort: galleryNavigation.sort,
        limit: currentGalleryPageSize,
        offset: page * currentGalleryPageSize,
      })
    ).unwrap();
    return result;
  };

  const handleGoToPreviousParticipant = async () => {
    if (!hasPreviousParticipant || !contestId || !participantId || participantNavPending) {
      return;
    }
    if (currentParticipantIndex > 0) {
      navigateToParticipantInGallery(
        participantIds[currentParticipantIndex - 1],
        currentGalleryPage,
        participantsListTotal || galleryNavigation?.total || 0
      );
      return;
    }
    if (currentGalleryPage <= 0) {
      return;
    }
    try {
      setParticipantNavPending(true);
      const previousPage = currentGalleryPage - 1;
      const payload = await fetchGalleryPage(previousPage);
      const previousPageIds = payload?.participants?.map((p) => p.id) || [];
      const previousParticipantId = previousPageIds[previousPageIds.length - 1];
      if (previousParticipantId) {
        navigateToParticipantInGallery(previousParticipantId, previousPage, payload?.total ?? 0);
      }
    } finally {
      setParticipantNavPending(false);
    }
  };

  const handleGoToNextParticipant = async () => {
    if (!hasNextParticipant || !contestId || !participantId || participantNavPending) {
      return;
    }
    if (currentParticipantIndex >= 0 && currentParticipantIndex < participantIds.length - 1) {
      navigateToParticipantInGallery(
        participantIds[currentParticipantIndex + 1],
        currentGalleryPage,
        participantsListTotal || galleryNavigation?.total || 0
      );
      return;
    }
    try {
      setParticipantNavPending(true);
      const nextPage = currentGalleryPage + 1;
      const payload = await fetchGalleryPage(nextPage);
      const nextParticipantId = payload?.participants?.[0]?.id;
      if (nextParticipantId) {
        navigateToParticipantInGallery(nextParticipantId, nextPage, payload?.total ?? 0);
      }
    } finally {
      setParticipantNavPending(false);
    }
  };

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

  const handleSendComment = async (text: string) => {
    if (!participantId || !text.trim() || !canComment) {
      return;
    }
    const result = await dispatch(
      createComment({
        participantId,
        data: { text: text.trim(), parent_id: replyToComment?.id },
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

  const infoDetails = (
    <>
      {participant.submission_status === 'pending' && (isOwner || isContestOwner) && (
        <p className="participant-page-moderation-notice" role="status">
          Заявка на модерации. До решения организатора карточка не отображается другим участникам конкурса.
        </p>
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
        </div>
      )}

      {(registrationSchemaRows.length > 0 || registrationOrphanRows.length > 0) && (
        <details className="participant-page-registration-details">
          <summary className="participant-page-registration-summary">
            {registrationSchemaRows.length > 0 ? 'Поля заявки' : 'Дополнительные данные заявки'}
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
    </>
  );

  const workHeading = (
    <header
      className={
        variant === 'page'
          ? 'participant-page-work-heading participant-page-work-heading--work-view'
          : 'participant-page-work-heading participant-page-work-heading--hero'
      }
    >
      <h1 className="participant-page-work-title">{displayTitle}</h1>
      {petNameSubtitle ? <p className="participant-page-title-sub">{petNameSubtitle}</p> : null}
      {participant.user_name?.trim() ? (
        <div
          className="participant-page-author"
          aria-label={`Автор: ${participant.user_name.trim()}`}
        >
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
              {getMessengerInitials(participant.user_name)}
            </div>
          )}
          <span className="participant-page-author-name">{participant.user_name.trim()}</span>
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

  const showFloatingBack = variant === 'page' && showBackButton;

  const floatingBackCluster = showFloatingBack ? (
    <div className="participant-page-floating-back" role="navigation" aria-label="Навигация">
      <div className="participant-page-back-cluster participant-page-back-cluster--over-media">
        <button
          type="button"
          className="participant-page-back-button participant-page-back-button--over-media"
          onClick={() => contestId && navigate(`/contests/${contestId}#gallery`)}
          aria-label="В галерею конкурса"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        {contestId ? (
          <button
            type="button"
            className="participant-page-contest-link participant-page-contest-link--over-media"
            onClick={() => navigate(`/contests/${contestId}#gallery`)}
          >
            В галерею
          </button>
        ) : null}
      </div>
    </div>
  ) : null;

  const breadcrumb =
    variant === 'page' && currentContest && contestId ? (
      <nav className="participant-page-breadcrumb" aria-label="Навигация по конкурсу">
        <button
          type="button"
          className="participant-page-breadcrumb-link"
          onClick={() => navigate(`/contests/${contestId}#gallery`)}
        >
          {currentContest.title}
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
            messages={comments}
            currentUserId={currentUserId}
            canVote={isAuthenticated}
            canReply={!!currentUserId && canComment}
            emptyLabel="Нет комментариев"
            canEditMessage={(m) => currentUserId === m.user_id}
            canDeleteMessage={(m) =>
              currentUserId === m.user_id || (!!currentUserId && isContestOwner)
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
                    <span className="chat-reply-banner-snippet">{replyToComment.text.slice(0, 120)}</span>
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
                onSend={(text) => void handleSendComment(text)}
                disabled={!participantId}
                placeholder="Напишите комментарий..."
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
      {participant && currentContest && contestId && participantId && variant === 'page' && (
        <ParticipantMetaTags
          participant={participant}
          contest={currentContest}
          contestId={contestId}
          participantId={participantId}
        />
      )}
      <div
        className={[
          'participant-page-header',
          variant === 'page' ? 'participant-page-header--work-view' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {showBackButton && variant !== 'page' ? (
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
            {contestId ? (
              <button
                type="button"
                className="participant-page-contest-link"
                onClick={() => navigate(`/contests/${contestId}#gallery`)}
              >
                В галерею
              </button>
            ) : null}
          </div>
        ) : null}
        {showGalleryWorkNav ? (
          <div className="participant-page-title-block">
            <div className="participant-page-work-nav">
              <Button
                type="button"
                variant="secondary"
                size="small"
                onClick={() => void handleGoToPreviousParticipant()}
                disabled={
                  lockWorkNavigationPrevious || !hasPreviousParticipant || participantNavPending
                }
              >
                Предыдущая работа
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="small"
                onClick={() => void handleGoToNextParticipant()}
                disabled={lockWorkNavigationNext || !hasNextParticipant || participantNavPending}
              >
                Следующая работа
              </Button>
            </div>
          </div>
        ) : null}
        {canEdit && (
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
        )}
      </div>

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
            <div className="participant-page-content participant-page-content--work-view participant-page-content--split">
              <div className="participant-page-split-media">
                <div
                  className={
                    showFloatingBack
                      ? 'participant-page-hero-stage participant-page-hero-stage--floating-back'
                      : 'participant-page-hero-stage'
                  }
                >
                  {floatingBackCluster}
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
                navigate(`/contests/${contestId}#gallery`);
              }
            }}
          />
        </>
      )}
    </div>
  );
};
