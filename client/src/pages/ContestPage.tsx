import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import {
  fetchContest,
  deleteContest,
  setUserVotesForContest,
} from '../store/slices/contestsSlice';
import {
  fetchParticipantsByContest,
  fetchMyParticipantsForContest,
  ParticipantsListNominationFilter,
} from '../store/slices/participantsSlice';
import { Participant, ContestStatus, Nomination } from '../types/models';
import { ParticipantCard } from '../components/contest/ParticipantCard';
import { AddParticipantModal } from '../components/contest/AddParticipantModal';
import { EditParticipantModal } from '../components/contest/EditParticipantModal';
import { DeleteParticipantModal } from '../components/contest/DeleteParticipantModal';
import { ParticipantVotersModal } from '../components/contest/ParticipantVotersModal';
import { ParticipantJuryReportModal } from '../components/contest/ParticipantJuryReportModal';
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
import { ContestRulesViewer } from '../components/contest/ContestRulesViewer';
import { resolvePublicAssetUrl } from '../utils/seo';
import { getContestScheduleDisplayLines } from '../utils/scheduleTimezone';
import { listNominations } from '../api/nominationsApi';
import { sortNominationsByOrder } from '../components/contest/contestNominationsDisplay';
import { getContestJury } from '../api/juryApi';
import type { ParticipantsListSort, ParticipantsListSubmissionFilter } from '../api/participantsApi';
import { userMayRegisterForContest } from '../utils/contestParticipantDomains';
import { ContestWinnersSection } from '../components/contest/ContestWinnersSection';
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
  
  const [isAddParticipantModalOpen, setIsAddParticipantModalOpen] = useState(false);
  const [contestNominations, setContestNominations] = useState<Nomination[]>([]);
  const [participantsNominationFilter, setParticipantsNominationFilter] =
    useState<ParticipantsListNominationFilter>('all');
  const [participantsJuryUnscoredOnly, setParticipantsJuryUnscoredOnly] = useState(false);
  const [participantsSubmissionFilter, setParticipantsSubmissionFilter] =
    useState<ParticipantsListSubmissionFilter>('all');
  const [participantsVotedOnly, setParticipantsVotedOnly] = useState(false);
  const [participantsSort, setParticipantsSort] = useState<ParticipantsListSort>('created_at');
  const [participantsPage, setParticipantsPage] = useState(0);
  const [isCurrentUserJuror, setIsCurrentUserJuror] = useState(false);
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
  const [juryReportModalParticipant, setJuryReportModalParticipant] = useState<Participant | null>(null);
  const [juryReportModalOpen, setJuryReportModalOpen] = useState(false);
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
    sort: participantsSort,
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
      setParticipantsSort(
        currentContest.status === 'voting' || currentContest.status === 'finished' ? 'votes' : 'created_at'
      );
      setParticipantsPage(0);
      participantsListFiltersRef.current = {
        nomination: 'all',
        juryUnscored: false,
        submission: 'all',
        votedOnly: false,
        sort: currentContest.status === 'voting' || currentContest.status === 'finished' ? 'votes' : 'created_at',
      };
      return;
    }
    const filtersChanged =
      participantsListFiltersRef.current.nomination !== participantsNominationFilter ||
      participantsListFiltersRef.current.juryUnscored !== participantsJuryUnscoredOnly ||
      participantsListFiltersRef.current.submission !== participantsSubmissionFilter ||
      participantsListFiltersRef.current.votedOnly !== participantsVotedOnly ||
      participantsListFiltersRef.current.sort !== participantsSort;
    if (filtersChanged) {
      participantsListFiltersRef.current = {
        nomination: participantsNominationFilter as string,
        juryUnscored: participantsJuryUnscoredOnly,
        submission: participantsSubmissionFilter,
        votedOnly: participantsVotedOnly,
        sort: participantsSort,
      };
      if (participantsPage !== 0) {
        setParticipantsPage(0);
        return;
      }
    }
    const paginated =
      currentContest.status === 'draft' ||
      currentContest.status === 'publication' ||
      currentContest.status === 'registration';
    const limit = paginated ? PARTICIPANTS_PAGE_SIZE : 10000;
    const offset = paginated ? participantsPage * PARTICIPANTS_PAGE_SIZE : 0;
    dispatch(
      fetchParticipantsByContest({
        contestId: id,
        nominationFilter: participantsNominationFilter,
        submissionFilter: participantsSubmissionFilter,
        juryUnscoredOnly: participantsJuryUnscoredOnly,
        votedOnly: participantsVotedOnly,
        sort: participantsSort,
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
    participantsSort,
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
    if (s !== 'draft' && s !== 'publication' && s !== 'registration') {
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
        if (!cancelled) setContestNominations([...rows].sort(sortNominationsByOrder));
      })
      .catch(() => {
        if (!cancelled) setContestNominations([]);
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

  const contestScheduleLines = useMemo(() => {
    if (!currentContest) {
      return [] as string[];
    }
    return getContestScheduleDisplayLines(currentContest);
  }, [currentContest]);

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
    currentContest.status === 'draft' ||
    currentContest.status === 'publication' ||
    currentContest.status === 'registration';
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
    publication: 'Публикация',
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
  const sponsorNameRaw = (currentContest.sponsor_name || '').trim();
  const sponsorLogoRaw = (currentContest.sponsor_logo_url || '').trim();
  const sponsorUrlRaw = (currentContest.sponsor_url || '').trim();
  const hasSponsorBlock = Boolean(sponsorUrlRaw || sponsorNameRaw || sponsorLogoRaw);
  const voteCtaLabel = (currentContest.cta_label_override || '').trim() || undefined;

  const hasAudienceWinners =
    currentContest.status === 'finished' &&
    (currentContest.audience_winners?.length ?? 0) > 0 &&
    currentContest.public_voting_enabled;
  const hasJuryWinners =
    currentContest.status === 'finished' &&
    (currentContest.jury_winners?.length ?? 0) > 0 &&
    currentContest.jury_voting_enabled;
  const showContestWinnersSection = hasAudienceWinners || hasJuryWinners;

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
            <h2 className="contest-section-heading contest-page-prizes-heading">Призы</h2>
            <p className="contest-page-prizes-text">{prizeRaw}</p>
          </div>
        ) : null}

        {showContestWinnersSection && id ? (
          <ContestWinnersSection
            contestId={id}
            audienceWinners={hasAudienceWinners ? currentContest.audience_winners : undefined}
            juryWinners={hasJuryWinners ? currentContest.jury_winners : undefined}
          />
        ) : null}

        {(currentContest.rules_text ?? '').trim() ? (
          <div className="contest-page-rules-wrap">
            <ContestRulesViewer
              rulesText={currentContest.rules_text}
              contestTitle={currentContest.title}
              triggerClassName="contest-page-rules-open"
            />
          </div>
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

        {contestScheduleLines.length > 0 ? (
          <section
            className="contest-page-schedule-block"
            aria-labelledby="contest-schedule-heading"
          >
            <h2 id="contest-schedule-heading" className="contest-section-heading contest-page-schedule-heading">
              Расписание проведения
            </h2>
            <div className="contest-page-schedule contest-page-schedule--body">
              {contestScheduleLines.map((line, i) => (
                <div key={`schedule-${i}`} className="contest-page-schedule-line">
                  {line}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <ContestOrganizerCriteriaPanel
          contest={currentContest}
          isAdmin={isAdmin}
          readOnly
          audienceMode={!isAdmin}
          showJuryCriteriaSection={currentContest.jury_voting_enabled ?? false}
        />

        </div>
        </section>

        <section id="contest-works" className="contest-page-works" aria-labelledby="contest-works-heading">
        <div className="contest-page-participants">
          <div className="contest-page-participants-header">
            <div className="contest-page-participants-header-top">
              <div className="contest-page-works-title-wrap">
                <h2 id="contest-works-heading" className="contest-section-heading contest-page-works-title">
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
                {isAdmin && currentContest.jury_voting_enabled && id ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="small"
                    className="contest-page-jury-progress-open"
                    onClick={() => navigate(`/contests/${id}/jury-voting-progress`)}
                  >
                    Контроль оценок жюри
                  </Button>
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
                <div className="contest-page-participants-filter">
                  <label htmlFor="participants-sort">Порядок</label>
                  <select
                    id="participants-sort"
                    className="contest-page-participants-filter-select"
                    value={participantsSort}
                    onChange={(e) => setParticipantsSort(e.target.value as ParticipantsListSort)}
                  >
                    <option value="created_at">По дате подачи</option>
                    <option value="votes">По голосам зрителей</option>
                    <option value="jury">По баллам жюри</option>
                  </select>
                </div>
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
              const nominationsOpenToUser = hasNominations
                ? contestNominations.filter(
                    (n) => !userHasParticipantForNomination(myContestParticipants, currentUser?.id, n.id)
                  )
                : [];
              const alreadyInContestWithoutNominations =
                !hasNominations &&
                userHasParticipantForNomination(myContestParticipants, currentUser?.id, null);
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
                      nominationsOpenToUser.map((n) => (
                        <Button
                          key={n.id}
                          size="large"
                          disabled={blockedByEmailDomain}
                          className="contest-page-add-participant-button"
                          onClick={() => {
                            setAddParticipantNomination({ id: n.id, title: n.title });
                            setIsAddParticipantModalOpen(true);
                          }}
                        >
                          {participateIcon}
                          Участвовать — {n.title}
                        </Button>
                      ))
                    ) : !alreadyInContestWithoutNominations ? (
                      <Button
                        size="large"
                        disabled={blockedByEmailDomain}
                        className="contest-page-add-participant-button"
                        onClick={() => {
                          setAddParticipantNomination(null);
                          setIsAddParticipantModalOpen(true);
                        }}
                      >
                        {participateIcon}
                        Добавить участника
                      </Button>
                    ) : null}
                  </div>
                  {isAuthenticated &&
                  !blockedByEmailDomain &&
                  hasNominations &&
                  nominationsOpenToUser.length === 0 &&
                  contestNominations.length > 0 ? (
                    <p className="contest-page-participants-all-nominations-taken" role="status">
                      Вы уже подали заявки во всех номинациях этого конкурса.
                    </p>
                  ) : null}
                  {isAuthenticated && !blockedByEmailDomain && !hasNominations && alreadyInContestWithoutNominations ? (
                    <p className="contest-page-participants-all-nominations-taken" role="status">
                      Вы уже подали заявку в этом конкурсе.
                    </p>
                  ) : null}
                </>
              );
            })()}
          </div>
          {participantsLoading ? (
            <div className="contest-page-participants-loading">
              <LoadingSpinner size="medium" />
            </div>
          ) : participantIds.length === 0 ? (
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
              {participantIds.map((participantId) => {
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
                    onShowJuryReport={(p) => {
                      setJuryReportModalParticipant(p);
                      setJuryReportModalOpen(true);
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
          participantsListSort={participantsSort}
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
                  sort: participantsSort,
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

      {juryReportModalOpen && juryReportModalParticipant && id && (
        <ParticipantJuryReportModal
          isOpen={juryReportModalOpen}
          onClose={() => {
            setJuryReportModalOpen(false);
            setJuryReportModalParticipant(null);
          }}
          contestId={id}
          participantId={juryReportModalParticipant.id}
          participantName={juryReportModalParticipant.pet_name}
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
