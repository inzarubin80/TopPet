import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
import { Participant, Nomination } from '../types/models';
import { ParticipantCard } from '../components/contest/ParticipantCard';
import { AddParticipantModal } from '../components/contest/AddParticipantModal';
import { EditParticipantModal } from '../components/contest/EditParticipantModal';
import { DeleteParticipantModal } from '../components/contest/DeleteParticipantModal';
import { DeleteContestModal } from '../components/contest/DeleteContestModal';
import { ChatWindow } from '../components/chat/ChatWindow';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import { getVotes } from '../api/votesApi';
import { useToast } from '../contexts/ToastContext';
import { errorHandler } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { useContestPermissions } from '../hooks/useContestPermissions';
import { ContestMetaTags } from '../components/seo/ContestMetaTags';
import { ContestOrganizerCriteriaPanel } from '../components/contest/ContestOrganizerCriteriaPanel';
import { ContestJuryPanel } from '../components/contest/ContestJuryPanel';
import { ContestJuryVotingTab } from '../components/contest/ContestJuryVotingTab';
import { ContestRulesViewer } from '../components/contest/ContestRulesViewer';
import { resolvePublicAssetUrl } from '../utils/seo';
import { getContestScheduleDisplayLines } from '../utils/scheduleTimezone';
import { listNominations } from '../api/nominationsApi';
import { sortNominationsByOrder } from '../components/contest/contestNominationsDisplay';
import { getContestJury } from '../api/juryApi';
import type { ParticipantsListSort, ParticipantsListSubmissionFilter } from '../api/participantsApi';
import { ParticipantGalleryNavigationState } from '../types/participantNavigation';
import { userMayRegisterForContest } from '../utils/contestParticipantDomains';
import { buildLoginUrl } from '../utils/navigation';
import './ContestPage.css';

const PARTICIPANTS_PAGE_SIZE = 24;
const EMPTY_STRING_ARRAY: string[] = [];
const EMPTY_PARTICIPANTS_ARRAY: Participant[] = [];

type ContestTab = 'about' | 'chat' | 'gallery' | 'winners' | 'jury_voting' | 'jury_chair';

function parseContestTabFromHash(hash: string): ContestTab {
  const h = (hash || '').replace(/^#/, '').trim().toLowerCase();
  if (
    h === 'chat' ||
    h === 'gallery' ||
    h === 'winners' ||
    h === 'about' ||
    h === 'jury_voting' ||
    h === 'jury_chair'
  ) {
    return h;
  }
  return 'about';
}

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
  const location = useLocation();
  const dispatch = useDispatch<AppDispatch>();
  const { showError } = useToast();
  const { currentContest, loading } = useSelector((state: RootState) => state.contests);
  const { items: participants, loading: participantsLoading } = useSelector(
    (state: RootState) => state.participants
  );
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const participantIds = useSelector((state: RootState) =>
    id ? state.participants.byContest[id] || EMPTY_STRING_ARRAY : EMPTY_STRING_ARRAY
  );
  const participantsListTotal = useSelector((state: RootState) =>
    id ? state.participants.listTotalByContest[id] ?? 0 : 0
  );
  const myContestParticipants = useSelector((state: RootState) =>
    id ? state.participants.mineByContest[id] ?? EMPTY_PARTICIPANTS_ARRAY : EMPTY_PARTICIPANTS_ARRAY
  );
  
  const [isAddParticipantModalOpen, setIsAddParticipantModalOpen] = useState(false);
  const [contestNominations, setContestNominations] = useState<Nomination[]>([]);
  const [participantsNominationFilter, setParticipantsNominationFilter] =
    useState<ParticipantsListNominationFilter>('all');
  const [participantsJuryUnscoredOnly, setParticipantsJuryUnscoredOnly] = useState(false);
  const [participantsSubmissionFilter, setParticipantsSubmissionFilter] =
    useState<ParticipantsListSubmissionFilter>('all');
  const [participantsVotedOnly, setParticipantsVotedOnly] = useState(false);
  const [participantsFavoritesOnly, setParticipantsFavoritesOnly] = useState(false);
  const [participantsSort, setParticipantsSort] = useState<ParticipantsListSort>('created_at');
  const [participantsPage, setParticipantsPage] = useState(0);
  const [isCurrentUserJuror, setIsCurrentUserJuror] = useState(false);
  const [isCurrentUserJuryChair, setIsCurrentUserJuryChair] = useState(false);
  const [addParticipantNomination, setAddParticipantNomination] = useState<{ id: string; title: string } | null>(
    null
  );
  const [isDeleteContestModalOpen, setIsDeleteContestModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditParticipantModalOpen, setIsEditParticipantModalOpen] = useState(false);
  const [isDeleteParticipantModalOpen, setIsDeleteParticipantModalOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [deletingParticipant, setDeletingParticipant] = useState<Participant | null>(null);

  // Note: Removed userParticipant check - users can now have unlimited participants

  const participantsListContestIdRef = useRef<string | undefined>(undefined);
  const participantsListFiltersRef = useRef({
    nomination: participantsNominationFilter as string,
    juryUnscored: participantsJuryUnscoredOnly,
    submission: participantsSubmissionFilter,
    votedOnly: participantsVotedOnly,
    favoritesOnly: participantsFavoritesOnly,
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
      setParticipantsFavoritesOnly(false);
      const initialSort: ParticipantsListSort = currentContest.public_voting_enabled
        ? 'votes'
        : currentContest.jury_voting_enabled
          ? 'jury'
          : 'created_at';
      setParticipantsSort(initialSort);
      setParticipantsPage(0);
      participantsListFiltersRef.current = {
        nomination: 'all',
        juryUnscored: false,
        submission: 'all',
        votedOnly: false,
        favoritesOnly: false,
        sort: initialSort,
      };
      return;
    }
    const filtersChanged =
      participantsListFiltersRef.current.nomination !== participantsNominationFilter ||
      participantsListFiltersRef.current.juryUnscored !== participantsJuryUnscoredOnly ||
      participantsListFiltersRef.current.submission !== participantsSubmissionFilter ||
      participantsListFiltersRef.current.votedOnly !== participantsVotedOnly ||
      participantsListFiltersRef.current.favoritesOnly !== participantsFavoritesOnly ||
      participantsListFiltersRef.current.sort !== participantsSort;
    if (filtersChanged) {
      participantsListFiltersRef.current = {
        nomination: participantsNominationFilter as string,
        juryUnscored: participantsJuryUnscoredOnly,
        submission: participantsSubmissionFilter,
        votedOnly: participantsVotedOnly,
        favoritesOnly: participantsFavoritesOnly,
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
        favoriteOnly: participantsFavoritesOnly,
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
    participantsFavoritesOnly,
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
      setIsCurrentUserJuryChair(false);
      return;
    }
    let cancelled = false;
    getContestJury(id)
      .then((members) => {
        if (!cancelled) {
          const currentMember = members.find((m) => m.user_id === currentUser?.id);
          setIsCurrentUserJuror(Boolean(currentMember));
          setIsCurrentUserJuryChair(Boolean(currentMember?.is_chair));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsCurrentUserJuror(false);
          setIsCurrentUserJuryChair(false);
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
  const juryPrizePlaces = [...(currentContest?.jury_prize_places ?? [])].sort((a, b) => a.place - b.place);
  const audiencePrizePlaces = [...(currentContest?.audience_prize_places ?? [])].sort(
    (a, b) => a.place - b.place
  );
  const activeTab = parseContestTabFromHash(location.hash);
  const canAccessJuryVotingTab =
    Boolean(currentContest?.jury_voting_enabled) && (isAdmin || isCurrentUserJuror);
  const canAccessJuryChairTab =
    Boolean(currentContest?.jury_voting_enabled) && (isAdmin || isCurrentUserJuryChair);

  useEffect(() => {
    if (activeTab === 'jury_voting' && !canAccessJuryVotingTab) {
      navigate(
        { pathname: location.pathname, search: location.search, hash: '#about' },
        { replace: true }
      );
      return;
    }
    if (activeTab === 'jury_chair' && !canAccessJuryChairTab) {
      navigate(
        { pathname: location.pathname, search: location.search, hash: '#about' },
        { replace: true }
      );
    }
  }, [
    activeTab,
    canAccessJuryVotingTab,
    canAccessJuryChairTab,
    navigate,
    location.pathname,
    location.search,
  ]);

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
  const participantGalleryNavigationState: ParticipantGalleryNavigationState | null = id
    ? {
        contestId: id,
        nominationFilter: participantsNominationFilter,
        submissionFilter: participantsSubmissionFilter,
        juryUnscoredOnly: participantsJuryUnscoredOnly,
        votedOnly: participantsVotedOnly,
        favoritesOnly: participantsFavoritesOnly,
        sort: participantsSort,
        page: participantsListPaginated ? participantsPage : 0,
        pageSize: participantsListPaginated ? PARTICIPANTS_PAGE_SIZE : 10000,
        total: participantsListTotal,
      }
    : null;

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

  const canAddParticipant =
    isAuthenticated &&
    (currentContest.status === 'registration' || currentContest.status === 'draft');
  const participationPeriodOpen =
    currentContest.status === 'registration' || currentContest.status === 'draft';
  const showGuestParticipationCta = !isAuthenticated && participationPeriodOpen;
  const showWorksParticipationChrome =
    canAddParticipant || canManageParticipants || showGuestParticipationCta;
  const showDomainParticipationNote =
    participantEmailDomainsActive &&
    (currentContest.status === 'registration' || currentContest.status === 'draft');
  const blockedByEmailDomain = showDomainParticipationNote && !mayRegisterByEmailDomains;
  /** Блокировка по домену e-mail имеет смысл только после входа; гостю показываем кнопку ведущую на логин. */
  const participationCtaDisabledByDomain = isAuthenticated && blockedByEmailDomain;
  const hasContestNominations = contestNominations.length > 0;
  const nominationsOpenToUser = hasContestNominations
    ? contestNominations.filter(
        (n) => !userHasParticipantForNomination(myContestParticipants, currentUser?.id, n.id)
      )
    : [];
  const alreadyInContestWithoutNominations =
    !hasContestNominations &&
    userHasParticipantForNomination(myContestParticipants, currentUser?.id, null);

  const domainNoteEl = showDomainParticipationNote ? (
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

  const participatePlusIcon = (
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

  const participateNominationCtaLabel = isAuthenticated
    ? 'Участвовать'
    : 'Зарегистрироваться для участия';

  const accentHex = (currentContest.theme_color || '').trim();
  const hasThemedAccent = /^#[0-9A-Fa-f]{6}$/.test(accentHex);
  const coverRaw = (currentContest.cover_url || '').trim();
  const hasHeroCover = Boolean(coverRaw);
  const logoRaw = (currentContest.logo_url || '').trim();
  const taglineRaw = (currentContest.tagline || '').trim();
  const sponsorNameRaw = (currentContest.sponsor_name || '').trim();
  const sponsorLogoRaw = (currentContest.sponsor_logo_url || '').trim();
  const sponsorUrlRaw = (currentContest.sponsor_url || '').trim();
  const hasSponsorBlock = Boolean(sponsorUrlRaw || sponsorNameRaw || sponsorLogoRaw);

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
        <nav className="contest-page-menu" aria-label="Меню конкурса">
          <button
            type="button"
            className={
              activeTab === 'about'
                ? 'contest-page-menu-item contest-page-menu-item--active'
                : 'contest-page-menu-item'
            }
            aria-current={activeTab === 'about' ? 'page' : undefined}
            onClick={() =>
              navigate(
                { pathname: location.pathname, search: location.search, hash: '#about' },
                { replace: true }
              )
            }
          >
            О конкурсе
          </button>
          <button
            type="button"
            className={
              activeTab === 'chat'
                ? 'contest-page-menu-item contest-page-menu-item--active'
                : 'contest-page-menu-item'
            }
            aria-current={activeTab === 'chat' ? 'page' : undefined}
            onClick={() =>
              navigate(
                { pathname: location.pathname, search: location.search, hash: '#chat' },
                { replace: true }
              )
            }
          >
            Чат
          </button>
          <button
            type="button"
            className={
              activeTab === 'gallery'
                ? 'contest-page-menu-item contest-page-menu-item--active'
                : 'contest-page-menu-item'
            }
            aria-current={activeTab === 'gallery' ? 'page' : undefined}
            onClick={() =>
              navigate(
                { pathname: location.pathname, search: location.search, hash: '#gallery' },
                { replace: true }
              )
            }
          >
            Галерея работ
          </button>
          <button
            type="button"
            className={
              activeTab === 'winners'
                ? 'contest-page-menu-item contest-page-menu-item--active'
                : 'contest-page-menu-item'
            }
            aria-current={activeTab === 'winners' ? 'page' : undefined}
            onClick={() =>
              navigate(
                { pathname: location.pathname, search: location.search, hash: '#winners' },
                { replace: true }
              )
            }
          >
            Победители
          </button>
          {canAccessJuryVotingTab ? (
            <button
              type="button"
              className={
                activeTab === 'jury_voting'
                  ? 'contest-page-menu-item contest-page-menu-item--active'
                  : 'contest-page-menu-item'
              }
              aria-current={activeTab === 'jury_voting' ? 'page' : undefined}
              onClick={() =>
                navigate(
                  { pathname: location.pathname, search: location.search, hash: '#jury_voting' },
                  { replace: true }
                )
              }
            >
              Голосование жюри
            </button>
          ) : null}
          {canAccessJuryChairTab ? (
            <button
              type="button"
              className={
                activeTab === 'jury_chair'
                  ? 'contest-page-menu-item contest-page-menu-item--active'
                  : 'contest-page-menu-item'
              }
              aria-current={activeTab === 'jury_chair' ? 'page' : undefined}
              onClick={() =>
                navigate(
                  { pathname: location.pathname, search: location.search, hash: '#jury_chair' },
                  { replace: true }
                )
              }
            >
              Председатель жюри
            </button>
          ) : null}
        </nav>

        {activeTab === 'about' ? (
          <section className="contest-page-overview" aria-label="О конкурсе">
        {hasHeroCover ? (
          <div
            className="contest-page-hero contest-page-hero--in-overview"
            style={{
              backgroundImage: `url(${resolvePublicAssetUrl(coverRaw)})`,
            }}
          >
            <div className="contest-page-hero-inner">
              {logoRaw ? (
                <img className="contest-page-hero-logo" src={resolvePublicAssetUrl(logoRaw)} alt="" />
              ) : null}
              <div className="contest-page-hero-title-row">
                <h1 className="contest-page-hero-title">{currentContest.title}</h1>
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

        {juryPrizePlaces.length > 0 || audiencePrizePlaces.length > 0 ? (
          <section className="contest-page-prize-places" aria-label="Призовые места конкурса">
            {juryPrizePlaces.length > 0 ? (
              <div className="contest-page-prize-places-group">
                <h2 className="contest-page-prize-places-title">Призы по итогам голосования жюри</h2>
                {juryPrizePlaces.map((item) => (
                  <p key={`jury-${item.place}`} className="contest-page-prize-place-item">
                    {item.place} место - {item.prize}
                  </p>
                ))}
              </div>
            ) : null}
            {audiencePrizePlaces.length > 0 ? (
              <div className="contest-page-prize-places-group">
                <h2 className="contest-page-prize-places-title">Призы по итогам пользовательского голосования</h2>
                {audiencePrizePlaces.map((item) => (
                  <p key={`audience-${item.place}`} className="contest-page-prize-place-item">
                    {item.place} место - {item.prize}
                  </p>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

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
          renderNominationAction={(n) => {
            if (!showWorksParticipationChrome) return null;
            if (userHasParticipantForNomination(myContestParticipants, currentUser?.id, n.id)) {
              return null;
            }
            return (
              <Button
                type="button"
                size="small"
                variant="primary"
                disabled={participationCtaDisabledByDomain}
                onClick={() => {
                  if (!isAuthenticated) {
                    navigate(buildLoginUrl(`${location.pathname}${location.search}`));
                    return;
                  }
                  setAddParticipantNomination({ id: n.id, title: n.title });
                  setIsAddParticipantModalOpen(true);
                }}
              >
                {participateNominationCtaLabel}
              </Button>
            );
          }}
        />

        {currentContest.jury_voting_enabled ? (
          <section className="contest-page-jury-block" aria-label="Состав жюри конкурса">
            <ContestJuryPanel contest={currentContest} isAdmin={false} />
          </section>
        ) : null}

        </div>
        </section>
        ) : null}

        {activeTab === 'gallery' ? (
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
                {isAuthenticated ? (
                  <label className="contest-page-participants-jury-filter">
                    <input
                      type="checkbox"
                      checked={participantsFavoritesOnly}
                      onChange={(e) => setParticipantsFavoritesOnly(e.target.checked)}
                    />
                    <span>Только избранное</span>
                  </label>
                ) : null}
                {showWorksParticipationChrome &&
                !hasContestNominations &&
                !alreadyInContestWithoutNominations ? (
                  <div className="contest-page-participants-filter">
                    <Button
                      type="button"
                      size="large"
                      disabled={participationCtaDisabledByDomain}
                      className="contest-page-add-participant-button"
                      onClick={() => {
                        if (!isAuthenticated) {
                          navigate(buildLoginUrl(`${location.pathname}${location.search}`));
                          return;
                        }
                        setAddParticipantNomination(null);
                        setIsAddParticipantModalOpen(true);
                      }}
                    >
                      {isAuthenticated ? (
                        <>
                          {participatePlusIcon}
                          Добавить участника
                        </>
                      ) : (
                        'Зарегистрироваться для участия'
                      )}
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
            {hasContestNominations ? (
              <div
                className="contest-page-nomination-tabs-bar"
                role="tablist"
                aria-label="Фильтр по номинации"
              >
                <div className="contest-page-nomination-tab-row">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={participantsNominationFilter === 'all'}
                    className={
                      participantsNominationFilter === 'all'
                        ? 'contest-page-nomination-tab contest-page-nomination-tab--active'
                        : 'contest-page-nomination-tab'
                    }
                    onClick={() => setParticipantsNominationFilter('all')}
                  >
                    Все номинации
                  </button>
                  {contestNominations.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      role="tab"
                      aria-selected={participantsNominationFilter === n.id}
                      className={
                        participantsNominationFilter === n.id
                          ? 'contest-page-nomination-tab contest-page-nomination-tab--active'
                          : 'contest-page-nomination-tab'
                      }
                      onClick={() => setParticipantsNominationFilter(n.id)}
                    >
                      {n.title}
                    </button>
                  ))}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={participantsNominationFilter === 'none'}
                    className={
                      participantsNominationFilter === 'none'
                        ? 'contest-page-nomination-tab contest-page-nomination-tab--active'
                        : 'contest-page-nomination-tab'
                    }
                    onClick={() => setParticipantsNominationFilter('none')}
                  >
                    Без номинации
                  </button>
                </div>
              </div>
            ) : null}
            {showWorksParticipationChrome ? (
              <>
                {domainNoteEl}
                {isAuthenticated &&
                !blockedByEmailDomain &&
                hasContestNominations &&
                nominationsOpenToUser.length === 0 &&
                contestNominations.length > 0 ? (
                  <p className="contest-page-participants-all-nominations-taken" role="status">
                    Вы уже подали заявки во всех номинациях этого конкурса.
                  </p>
                ) : null}
                {isAuthenticated &&
                !blockedByEmailDomain &&
                !hasContestNominations &&
                alreadyInContestWithoutNominations ? (
                  <p className="contest-page-participants-all-nominations-taken" role="status">
                    Вы уже подали заявку в этом конкурсе.
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
          {participantsLoading ? (
            <div className="contest-page-participants-loading">
              <LoadingSpinner size="medium" />
            </div>
          ) : participantIds.length === 0 ? (
            <div className="contest-page-participants-empty">
              {participantsJuryUnscoredOnly
                ? 'Среди видимых работ нет таких, где вам не хватает оценок по критериям (или вы оценили все).'
                : participantsFavoritesOnly
                  ? 'Нет работ в избранном (с учётом выбранных фильтров).'
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
                    juryVotingEnabled={currentContest.jury_voting_enabled ?? false}
                    isContestAdmin={isAdmin}
                    galleryNavigationState={participantGalleryNavigationState ?? undefined}
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
        ) : null}

        {activeTab === 'chat' ? (
          <section className="contest-page-chat" aria-label="Чат конкурса">
            <ChatWindow contestId={currentContest.id} contestStatus={currentContest.status} />
          </section>
        ) : null}

        {activeTab === 'winners' ? (
          <section className="contest-page-winners" aria-label="Победители">
            <div className="contest-page-winners-empty" />
          </section>
        ) : null}
        {activeTab === 'jury_voting' && canAccessJuryVotingTab ? (
          <section className="contest-page-jury-voting" aria-label="Голосование жюри">
            <ContestJuryVotingTab
              contestId={currentContest.id}
              contestStatus={currentContest.status}
              isJuror={isCurrentUserJuror}
              nominationTitleById={nominationTitleById}
              nominations={contestNominations}
            />
          </section>
        ) : null}
        {activeTab === 'jury_chair' && canAccessJuryChairTab ? (
          <section className="contest-page-winners" aria-label="Председатель жюри">
            <div className="contest-page-winners-empty">Раздел в разработке</div>
          </section>
        ) : null}
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
          participantsListFavoriteOnly={participantsFavoritesOnly}
          participantsListLimit={
            participantsListPaginated ? PARTICIPANTS_PAGE_SIZE : 10000
          }
          participantsListOffset={
            participantsListPaginated ? participantsPage * PARTICIPANTS_PAGE_SIZE : 0
          }
          participantsListSort={participantsSort}
          contestMinPhotoCount={currentContest?.min_photo_count}
          contestMaxPhotoCount={currentContest?.max_photo_count}
          entryTitleHint={currentContest?.entry_title_hint}
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
          contestMinPhotoCount={currentContest?.min_photo_count}
          contestMaxPhotoCount={currentContest?.max_photo_count}
          entryTitleHint={currentContest?.entry_title_hint}
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
                  favoriteOnly: participantsFavoritesOnly,
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
