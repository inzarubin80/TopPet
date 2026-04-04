import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import {
  fetchContest,
  updateContestStatus,
  deleteContest,
  setUserVotesForContest,
} from '../store/slices/contestsSlice';
import {
  fetchParticipantsByContest,
  fetchMyParticipantsForContest,
  ParticipantsListNominationFilter,
} from '../store/slices/participantsSlice';
import { Participant, ContestStatus, Nomination, RegistrationField } from '../types/models';
import { ParticipantCard } from '../components/contest/ParticipantCard';
import { AddParticipantModal } from '../components/contest/AddParticipantModal';
import { EditParticipantModal } from '../components/contest/EditParticipantModal';
import { DeleteParticipantModal } from '../components/contest/DeleteParticipantModal';
import { ParticipantVotersModal } from '../components/contest/ParticipantVotersModal';
import { DeleteContestModal } from '../components/contest/DeleteContestModal';
import { ChatWindow } from '../components/chat/ChatWindow';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import { buildLoginUrl } from '../utils/navigation';
import { getVotes } from '../api/votesApi';
import { useToast } from '../contexts/ToastContext';
import { errorHandler } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { useContestPermissions } from '../hooks/useContestPermissions';
import { nominationVoteKey } from '../utils/voteKeys';
import { ContestMetaTags } from '../components/seo/ContestMetaTags';
import { ContestOrganizerCriteriaPanel } from '../components/contest/ContestOrganizerCriteriaPanel';
import { resolvePublicAssetUrl } from '../utils/seo';
import { listNominations } from '../api/nominationsApi';
import { listRegistrationFields } from '../api/registrationFieldsApi';
import { getContestJury } from '../api/juryApi';
import type { ParticipantsListSubmissionFilter } from '../api/participantsApi';
import { userMayRegisterForContest } from '../utils/contestParticipantDomains';
import './ContestPage.css';

const PARTICIPANTS_PAGE_SIZE = 24;

/** Проверка по списку «мои заявки» в конкурсе (актуально при пагинации общего списка). */
function userHasParticipantForNomination(
  myEntries: Participant[],
  userId: number | undefined,
  nominationId: string | null
): boolean {
  if (userId === undefined) return false;
  return myEntries.some((p) => {
    if (p.user_id !== userId) return false;
    if (nominationId === null) return !p.nomination_id;
    return p.nomination_id === nominationId;
  });
}

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
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const participantIds = useSelector((state: RootState) =>
    id ? state.participants.byContest[id] || [] : []
  );
  const participantsListTotal = useSelector((state: RootState) =>
    id ? state.participants.listTotalByContest[id] ?? 0 : 0
  );
  const myContestParticipants = useSelector((state: RootState) =>
    id ? state.participants.mineByContest[id] ?? [] : []
  );
  
  // Sort participants by votes (descending) for voting and finished contests
  const sortedParticipantIds = useMemo(() => {
    if (!currentContest || !participantIds.length) {
      return participantIds;
    }
    
    const status = currentContest.status;
    if (status === 'voting' || status === 'finished') {
      // Sort by total_votes descending
      return [...participantIds].sort((a, b) => {
        const votesA = participants[a]?.total_votes ?? 0;
        const votesB = participants[b]?.total_votes ?? 0;
        return votesB - votesA; // Descending order
      });
    }
    
    // For draft and registration, keep original order (by created_at)
    return participantIds;
  }, [participantIds, participants, currentContest]);
  
  const [isAddParticipantModalOpen, setIsAddParticipantModalOpen] = useState(false);
  const [contestNominations, setContestNominations] = useState<Nomination[]>([]);
  const [participantsNominationFilter, setParticipantsNominationFilter] =
    useState<ParticipantsListNominationFilter>('all');
  const [participantsJuryUnscoredOnly, setParticipantsJuryUnscoredOnly] = useState(false);
  const [participantsSubmissionFilter, setParticipantsSubmissionFilter] =
    useState<ParticipantsListSubmissionFilter>('all');
  const [participantsVotedOnly, setParticipantsVotedOnly] = useState(false);
  const [participantsPage, setParticipantsPage] = useState(0);
  const [isCurrentUserJuror, setIsCurrentUserJuror] = useState(false);
  const [contestRegistrationFields, setContestRegistrationFields] = useState<RegistrationField[]>([]);
  const [addParticipantNomination, setAddParticipantNomination] = useState<{ id: string; title: string } | null>(
    null
  );
  const [isDeleteContestModalOpen, setIsDeleteContestModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditParticipantModalOpen, setIsEditParticipantModalOpen] = useState(false);
  const [isDeleteParticipantModalOpen, setIsDeleteParticipantModalOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [deletingParticipant, setDeletingParticipant] = useState<Participant | null>(null);
  const [votersModalParticipant, setVotersModalParticipant] = useState<Participant | null>(null);
  const [votersModalOpen, setVotersModalOpen] = useState(false);
  const userVoteSlots = useSelector((state: RootState) =>
    id ? state.contests.userVoteSlots[id] ?? {} : {}
  );

  // Note: Removed userParticipant check - users can now have unlimited participants

  const participantsListContestIdRef = useRef<string | undefined>(undefined);
  const participantsListFiltersRef = useRef({
    nomination: participantsNominationFilter as string,
    juryUnscored: participantsJuryUnscoredOnly,
    submission: participantsSubmissionFilter,
    votedOnly: participantsVotedOnly,
  });

  useEffect(() => {
    if (id) {
      dispatch(fetchContest(id));
    }
  }, [dispatch, id]);

  useEffect(() => {
    if (!id || !currentContest || currentContest.id !== id) {
      return;
    }
    if (participantsListContestIdRef.current !== id) {
      participantsListContestIdRef.current = id;
      setParticipantsNominationFilter('all');
      setParticipantsJuryUnscoredOnly(false);
      setParticipantsSubmissionFilter('all');
      setParticipantsVotedOnly(false);
      setParticipantsPage(0);
      participantsListFiltersRef.current = { nomination: 'all', juryUnscored: false, submission: 'all', votedOnly: false };
      return;
    }
    const filtersChanged =
      participantsListFiltersRef.current.nomination !== participantsNominationFilter ||
      participantsListFiltersRef.current.juryUnscored !== participantsJuryUnscoredOnly ||
      participantsListFiltersRef.current.submission !== participantsSubmissionFilter ||
      participantsListFiltersRef.current.votedOnly !== participantsVotedOnly;
    if (filtersChanged) {
      participantsListFiltersRef.current = {
        nomination: participantsNominationFilter as string,
        juryUnscored: participantsJuryUnscoredOnly,
        submission: participantsSubmissionFilter,
        votedOnly: participantsVotedOnly,
      };
      setParticipantsPage(0);
      return;
    }
    const paginated =
      currentContest.status === 'draft' || currentContest.status === 'registration';
    const limit = paginated ? PARTICIPANTS_PAGE_SIZE : 10000;
    const offset = paginated ? participantsPage * PARTICIPANTS_PAGE_SIZE : 0;
    dispatch(
      fetchParticipantsByContest({
        contestId: id,
        nominationFilter: participantsNominationFilter,
        submissionFilter: participantsSubmissionFilter,
        juryUnscoredOnly: participantsJuryUnscoredOnly,
        votedOnly: participantsVotedOnly,
        limit,
        offset,
      })
    );
  }, [
    dispatch,
    id,
    currentContest,
    participantsNominationFilter,
    participantsJuryUnscoredOnly,
    participantsSubmissionFilter,
    participantsVotedOnly,
    participantsPage,
  ]);

  useEffect(() => {
    if (!id || !currentContest || currentContest.id !== id) {
      return;
    }
    if (!isAuthenticated) {
      return;
    }
    const s = currentContest.status;
    if (s !== 'draft' && s !== 'registration') {
      return;
    }
    dispatch(fetchMyParticipantsForContest({ contestId: id }));
  }, [dispatch, id, currentContest, isAuthenticated]);

  useEffect(() => {
    if (!id) {
      return;
    }
    let cancelled = false;
    listNominations(id)
      .then((rows) => {
        if (!cancelled) setContestNominations(rows);
      })
      .catch(() => {
        if (!cancelled) setContestNominations([]);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) {
      return;
    }
    let cancelled = false;
    listRegistrationFields(id)
      .then((rows) => {
        if (!cancelled) setContestRegistrationFields(rows);
      })
      .catch(() => {
        if (!cancelled) setContestRegistrationFields([]);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id || !isAuthenticated || !currentContest?.jury_voting_enabled) {
      setIsCurrentUserJuror(false);
      return;
    }
    let cancelled = false;
    getContestJury(id)
      .then((members) => {
        if (!cancelled) {
          setIsCurrentUserJuror(members.some((m) => m.user_id === currentUser?.id));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsCurrentUserJuror(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, isAuthenticated, currentContest?.jury_voting_enabled, currentUser?.id]);

  useEffect(() => {
    if (!currentContest?.jury_voting_enabled) {
      setParticipantsJuryUnscoredOnly(false);
    }
  }, [currentContest?.jury_voting_enabled]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    const loadVote = async () => {
      if (
        !id ||
        !isAuthenticated ||
        (currentContest?.status !== 'voting' && currentContest?.status !== 'finished')
      ) {
        if (id) {
          dispatch(setUserVotesForContest({ contestId: id, votes: [] }));
        }
        return;
      }
      try {
        const votes = await getVotes(id);
        dispatch(setUserVotesForContest({ contestId: id, votes }));
      } catch (error) {
        logger.error('Failed to load vote', error);
        dispatch(setUserVotesForContest({ contestId: id, votes: [] }));
      }
    };
    loadVote();
  }, [dispatch, id, isAuthenticated, currentContest?.status, currentContest?.id]);


  const { isAdmin, canManageParticipants } = useContestPermissions(currentContest, currentUser);
  const nominationTitleById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const n of contestNominations) {
      m[n.id] = n.title;
    }
    return m;
  }, [contestNominations]);

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

  const participantsListPaginated =
    currentContest.status === 'draft' || currentContest.status === 'registration';
  const participantsTotalPages =
    participantsListPaginated && participantsListTotal > 0
      ? Math.max(1, Math.ceil(participantsListTotal / PARTICIPANTS_PAGE_SIZE))
      : 1;

  const showMyVotesFilter =
    isAuthenticated &&
    (currentContest.public_voting_enabled ?? true) &&
    (currentContest.status === 'voting' || currentContest.status === 'finished');

  const participantEmailDomains = currentContest.participant_allowed_email_domains ?? [];
  const participantEmailDomainsActive = participantEmailDomains.length > 0;
  const mayRegisterByEmailDomains = userMayRegisterForContest(
    currentUser?.email,
    participantEmailDomains,
    isAdmin
  );

  const statusLabels: Record<ContestStatus, string> = {
    draft: 'Черновик',
    registration: 'Регистрация',
    voting: 'Голосование',
    finished: 'Завершен',
  };

  const accentHex = (currentContest.theme_color || '').trim();
  const hasThemedAccent = /^#[0-9A-Fa-f]{6}$/.test(accentHex);
  const coverRaw = (currentContest.cover_url || '').trim();
  const hasHeroCover = Boolean(coverRaw);
  const logoRaw = (currentContest.logo_url || '').trim();
  const taglineRaw = (currentContest.tagline || '').trim();
  const prizeRaw = (currentContest.prize_text || '').trim();
  const rulesRaw = (currentContest.rules_url || '').trim();
  const sponsorNameRaw = (currentContest.sponsor_name || '').trim();
  const sponsorLogoRaw = (currentContest.sponsor_logo_url || '').trim();
  const sponsorUrlRaw = (currentContest.sponsor_url || '').trim();
  const hasSponsorBlock = Boolean(sponsorUrlRaw || sponsorNameRaw || sponsorLogoRaw);
  const voteCtaLabel = (currentContest.cta_label_override || '').trim() || undefined;

  const contestPageStyle =
    hasThemedAccent
      ? ({
          '--contest-accent': accentHex,
          '--color-accent': accentHex,
          '--color-accent-hover': accentHex,
        } as React.CSSProperties)
      : undefined;

  // Формируем массив участников для метатегов
  const participantsArray = participantIds
    .map((participantId) => participants[participantId])
    .filter((p): p is Participant => p !== undefined);

  return (
    <div
      className={`contest-page${hasThemedAccent ? ' contest-page--themed' : ''}`}
      style={contestPageStyle}
    >
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
        <section className="contest-page-overview" aria-label="О конкурсе">
        {hasHeroCover ? (
          <div
            className="contest-page-hero contest-page-hero--in-overview"
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(15, 23, 42, 0.5) 0%, rgba(15, 23, 42, 0.75) 100%), url(${resolvePublicAssetUrl(coverRaw)})`,
            }}
          >
            <div className="contest-page-hero-inner">
              {logoRaw ? (
                <img className="contest-page-hero-logo" src={resolvePublicAssetUrl(logoRaw)} alt="" />
              ) : null}
              <div className="contest-page-hero-title-row">
                <h1 className="contest-page-hero-title">{currentContest.title}</h1>
                <span
                  className={`contest-page-status contest-page-status-${currentContest.status} contest-page-status--on-hero`}
                >
                  {statusLabels[currentContest.status]}
                </span>
                {isAdmin && (
                  <>
                    <button
                      type="button"
                      className="contest-page-edit-button contest-page-icon-on-hero"
                      onClick={() => navigate(`/contests/${currentContest.id}/edit`)}
                      aria-label="Редактировать конкурс"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="contest-page-delete-button contest-page-icon-on-hero"
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
              {taglineRaw ? <p className="contest-page-hero-tagline">{taglineRaw}</p> : null}
            </div>
          </div>
        ) : (
          <div className="contest-page-overview-top">
            <div className="contest-page-header">
              {logoRaw ? (
                <img className="contest-page-logo" src={resolvePublicAssetUrl(logoRaw)} alt="" />
              ) : null}
              <h1>{currentContest.title}</h1>
              <span className={`contest-page-status contest-page-status-${currentContest.status}`}>
                {statusLabels[currentContest.status]}
              </span>
              {isAdmin && (
                <>
                  <button
                    type="button"
                    className="contest-page-edit-button"
                    onClick={() => navigate(`/contests/${currentContest.id}/edit`)}
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
            {taglineRaw ? <p className="contest-page-tagline">{taglineRaw}</p> : null}
          </div>
        )}

        <div className="contest-page-overview-body">
        {prizeRaw ? (
          <div className="contest-page-prizes">
            <h2 className="contest-page-prizes-heading">Призы</h2>
            <p className="contest-page-prizes-text">{prizeRaw}</p>
          </div>
        ) : null}

        {rulesRaw ? (
          <p className="contest-page-rules-wrap">
            <a
              href={resolvePublicAssetUrl(rulesRaw)}
              className="contest-page-rules-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              Полные правила конкурса
            </a>
          </p>
        ) : null}

        {hasSponsorBlock ? (
          <div className="contest-page-sponsor">
            <p className="contest-page-sponsor-label">Спонсор</p>
            <div className="contest-page-sponsor-inner">
              {sponsorUrlRaw ? (
                <a
                  href={resolvePublicAssetUrl(sponsorUrlRaw)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="contest-page-sponsor-link"
                >
                  {sponsorLogoRaw ? (
                    <img
                      src={resolvePublicAssetUrl(sponsorLogoRaw)}
                      alt={sponsorNameRaw || 'Спонсор'}
                      className="contest-page-sponsor-logo"
                    />
                  ) : null}
                  {sponsorNameRaw ? <span className="contest-page-sponsor-name">{sponsorNameRaw}</span> : null}
                  {!sponsorLogoRaw && !sponsorNameRaw ? (
                    <span className="contest-page-sponsor-fallback">Сайт спонсора</span>
                  ) : null}
                </a>
              ) : (
                <div className="contest-page-sponsor-static">
                  {sponsorLogoRaw ? (
                    <img
                      src={resolvePublicAssetUrl(sponsorLogoRaw)}
                      alt={sponsorNameRaw || ''}
                      className="contest-page-sponsor-logo"
                    />
                  ) : null}
                  {sponsorNameRaw ? <span className="contest-page-sponsor-name">{sponsorNameRaw}</span> : null}
                </div>
              )}
            </div>
          </div>
        ) : null}

        <div className="contest-page-description">
          <p>{currentContest.description || 'Нет описания'}</p>
        </div>

        <ContestOrganizerCriteriaPanel
          contest={currentContest}
          isAdmin={isAdmin}
          readOnly
          showJuryCriteriaSection={currentContest.jury_voting_enabled ?? false}
        />

        <div className="contest-page-overview-cta">
          <div className="contest-page-overview-cta-inner">
            <div className="contest-page-overview-cta-copy">
              <span className="contest-page-overview-cta-kicker">Заявки и работы</span>
              <span className="contest-page-overview-cta-text">
                Список заявок, голосование и участие — в отдельном блоке ниже
              </span>
            </div>
            <button
              type="button"
              className="contest-page-overview-cta-button"
              onClick={() =>
                document.getElementById('contest-works')?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start',
                })
              }
            >
              К работам участников
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
            </button>
          </div>
        </div>
        </div>
        </section>

        <section id="contest-works" className="contest-page-works" aria-labelledby="contest-works-heading">
        <div className="contest-page-participants">
          <div className="contest-page-participants-header">
            <div className="contest-page-participants-header-top">
              <div className="contest-page-works-title-wrap">
                <h2 id="contest-works-heading" className="contest-page-works-title">
                  Работы участников
                </h2>
                {participantsListTotal > 0 ? (
                  <span className="contest-page-works-count" aria-live="polite">
                    {participantsListTotal}{' '}
                    {participantsListTotal % 10 === 1 && participantsListTotal % 100 !== 11
                      ? 'работа'
                      : participantsListTotal % 10 >= 2 &&
                          participantsListTotal % 10 <= 4 &&
                          (participantsListTotal % 100 < 10 || participantsListTotal % 100 >= 20)
                        ? 'работы'
                        : 'работ'}
                  </span>
                ) : null}
              </div>
              <div className="contest-page-participants-filters">
                {contestNominations.length > 0 ? (
                  <div className="contest-page-participants-filter">
                    <label htmlFor="participants-nomination-filter">Номинация</label>
                    <select
                      id="participants-nomination-filter"
                      className="contest-page-participants-filter-select"
                      value={participantsNominationFilter}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === 'all') setParticipantsNominationFilter('all');
                        else if (v === 'none') setParticipantsNominationFilter('none');
                        else setParticipantsNominationFilter(v);
                      }}
                    >
                      <option value="all">Все номинации</option>
                      <option value="none">Без номинации</option>
                      {contestNominations.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.title}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {isAuthenticated && isAdmin ? (
                  <div className="contest-page-participants-filter">
                    <label htmlFor="participants-submission-filter">Статус заявки</label>
                    <select
                      id="participants-submission-filter"
                      className="contest-page-participants-filter-select"
                      value={participantsSubmissionFilter}
                      onChange={(e) =>
                        setParticipantsSubmissionFilter(e.target.value as ParticipantsListSubmissionFilter)
                      }
                    >
                      <option value="all">Все</option>
                      <option value="accepted">Принятые</option>
                      <option value="pending">На модерации</option>
                      <option value="rejected">Отклонённые</option>
                      <option value="non_accepted">Не принятые (модерация и отклонённые)</option>
                    </select>
                  </div>
                ) : null}
                {isCurrentUserJuror && currentContest.jury_voting_enabled ? (
                  <label className="contest-page-participants-jury-filter">
                    <input
                      type="checkbox"
                      checked={participantsJuryUnscoredOnly}
                      onChange={(e) => setParticipantsJuryUnscoredOnly(e.target.checked)}
                    />
                    <span>Только не оценённые мной</span>
                  </label>
                ) : null}
                {showMyVotesFilter ? (
                  <label className="contest-page-participants-jury-filter">
                    <input
                      type="checkbox"
                      checked={participantsVotedOnly}
                      onChange={(e) => setParticipantsVotedOnly(e.target.checked)}
                    />
                    <span>Только за кого я проголосовал</span>
                  </label>
                ) : null}
              </div>
            </div>
            {/* Allow any authenticated user to add participants during registration phase */}
            {(() => {
              const canAddParticipant =
                isAuthenticated &&
                (currentContest?.status === 'registration' || currentContest?.status === 'draft');
              if (!canAddParticipant && !canManageParticipants) {
                return null;
              }
              const showDomainParticipationNote =
                participantEmailDomainsActive &&
                (currentContest?.status === 'registration' || currentContest?.status === 'draft');
              const blockedByEmailDomain = showDomainParticipationNote && !mayRegisterByEmailDomains;
              const returnUrl = `/contests/${id}`;
              const participateIcon = (
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
                  aria-hidden
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              );
              const hasNominations = contestNominations.length > 0;
              const domainNote = showDomainParticipationNote ? (
                <p className="contest-page-participants-domain-note" role="note">
                  Участие только для адресов e-mail на доменах:{' '}
                  <strong>{participantEmailDomains.join(', ')}</strong>.
                  {!isAuthenticated
                    ? ' Войдите с аккаунтом, у которого в профиле указана подходящая почта.'
                    : blockedByEmailDomain
                      ? ' Ваш e-mail в профиле не подходит под это ограничение.'
                      : null}
                </p>
              ) : null;
              if (!isAuthenticated) {
                return (
                  <>
                    {domainNote}
                    <div className="contest-page-participants-actions">
                      {hasNominations ? (
                        contestNominations.map((n) => (
                          <Button
                            key={n.id}
                            variant="primary"
                            size="large"
                            className="contest-page-add-participant-button"
                            onClick={() => navigate(buildLoginUrl(returnUrl))}
                          >
                            {participateIcon}
                            Участвовать — {n.title}
                          </Button>
                        ))
                      ) : (
                        <Button
                          variant="primary"
                          size="large"
                          className="contest-page-add-participant-button"
                          onClick={() => navigate(buildLoginUrl(returnUrl))}
                        >
                          Войти для участия
                        </Button>
                      )}
                    </div>
                  </>
                );
              }
              return (
                <>
                  {domainNote}
                  <div className="contest-page-participants-actions">
                    {hasNominations ? (
                      contestNominations.map((n) => {
                        const already =
                          userHasParticipantForNomination(myContestParticipants, currentUser?.id, n.id) &&
                          !canManageParticipants;
                        return (
                          <Button
                            key={n.id}
                            size="large"
                            disabled={already || blockedByEmailDomain}
                            className="contest-page-add-participant-button"
                            onClick={() => {
                              setAddParticipantNomination({ id: n.id, title: n.title });
                              setIsAddParticipantModalOpen(true);
                            }}
                          >
                            {participateIcon}
                            {already ? 'Уже участвуете' : `Участвовать — ${n.title}`}
                          </Button>
                        );
                      })
                    ) : (
                      <Button
                        size="large"
                        disabled={
                          (userHasParticipantForNomination(myContestParticipants, currentUser?.id, null) &&
                            !canManageParticipants) ||
                          blockedByEmailDomain
                        }
                        className="contest-page-add-participant-button"
                        onClick={() => {
                          setAddParticipantNomination(null);
                          setIsAddParticipantModalOpen(true);
                        }}
                      >
                        {participateIcon}
                        {userHasParticipantForNomination(myContestParticipants, currentUser?.id, null) &&
                        !canManageParticipants
                          ? 'Уже участвуете'
                          : 'Добавить участника'}
                      </Button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
          {participantsLoading ? (
            <div className="contest-page-participants-loading">
              <LoadingSpinner size="medium" />
            </div>
          ) : sortedParticipantIds.length === 0 ? (
            <div className="contest-page-participants-empty">
              {participantsJuryUnscoredOnly
                ? 'Среди видимых работ нет таких, где вам не хватает оценок по критериям (или вы оценили все).'
                : participantsVotedOnly
                  ? 'Нет работ, за которые вы проголосовали (с учётом выбранных фильтров).'
                  : participantsSubmissionFilter !== 'all'
                  ? participantsSubmissionFilter === 'pending'
                    ? 'Нет заявок со статусом «На модерации»'
                    : participantsSubmissionFilter === 'rejected'
                      ? 'Нет отклонённых заявок'
                      : participantsSubmissionFilter === 'accepted'
                        ? 'Нет принятых заявок'
                        : participantsSubmissionFilter === 'non_accepted'
                          ? 'Нет непринятых заявок'
                          : 'Нет участников'
                  : participantsNominationFilter !== 'all'
                    ? 'В выбранной номинации пока нет работ'
                    : 'Нет участников'}
            </div>
          ) : (
            <div className="contest-page-participants-list">
              {sortedParticipantIds.map((participantId) => {
                const participant = participants[participantId];
                return participant ? (
                  <ParticipantCard 
                    key={participantId} 
                    participant={participant} 
                    contestId={id!}
                    nominationTitle={
                      participant.nomination_id
                        ? nominationTitleById[participant.nomination_id]
                        : undefined
                    }
                    registrationFields={contestRegistrationFields}
                    contestStatus={currentContest.status}
                    publicVotingEnabled={currentContest.public_voting_enabled ?? true}
                    voteCtaLabel={voteCtaLabel}
                    juryVotingEnabled={currentContest.jury_voting_enabled ?? false}
                    isContestAdmin={isAdmin}
                    isVoted={
                      userVoteSlots[nominationVoteKey(participant.nomination_id)] === participant.id
                    }
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
          {participantsListPaginated && participantsListTotal > PARTICIPANTS_PAGE_SIZE ? (
            <div className="contest-page-participants-pager" role="navigation" aria-label="Страницы списка работ">
              <Button
                type="button"
                variant="secondary"
                disabled={participantsPage <= 0}
                onClick={() => setParticipantsPage((p) => Math.max(0, p - 1))}
              >
                Назад
              </Button>
              <span className="contest-page-participants-pager-info">
                Страница {participantsPage + 1} из {participantsTotalPages}
              </span>
              <Button
                type="button"
                variant="secondary"
                disabled={(participantsPage + 1) * PARTICIPANTS_PAGE_SIZE >= participantsListTotal}
                onClick={() => setParticipantsPage((p) => p + 1)}
              >
                Вперёд
              </Button>
            </div>
          ) : null}
        </div>
        </section>
      </div>

      <div className="contest-page-sidebar">
        <ChatWindow contestId={currentContest.id} contestStatus={currentContest.status} />
      </div>

      {id && (
        <AddParticipantModal
          isOpen={isAddParticipantModalOpen}
          onClose={() => {
            setIsAddParticipantModalOpen(false);
            setAddParticipantNomination(null);
          }}
          contestId={id}
          nominationId={addParticipantNomination?.id ?? null}
          nominationTitle={addParticipantNomination?.title ?? null}
          participantsListNominationFilter={participantsNominationFilter}
          participantsListSubmissionFilter={participantsSubmissionFilter}
          participantsListVotedOnly={participantsVotedOnly}
          participantsListJuryUnscoredOnly={participantsJuryUnscoredOnly}
          participantsListLimit={
            participantsListPaginated ? PARTICIPANTS_PAGE_SIZE : 10000
          }
          participantsListOffset={
            participantsListPaginated ? participantsPage * PARTICIPANTS_PAGE_SIZE : 0
          }
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
            if (id) {
              dispatch(
                fetchParticipantsByContest({
                  contestId: id,
                  nominationFilter: participantsNominationFilter,
                  submissionFilter: participantsSubmissionFilter,
                  juryUnscoredOnly: participantsJuryUnscoredOnly,
                  votedOnly: participantsVotedOnly,
                  limit: participantsListPaginated ? PARTICIPANTS_PAGE_SIZE : 10000,
                  offset: participantsListPaginated
                    ? participantsPage * PARTICIPANTS_PAGE_SIZE
                    : 0,
                })
              );
              if (participantsListPaginated && isAuthenticated) {
                dispatch(fetchMyParticipantsForContest({ contestId: id }));
              }
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
