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
import { ContestJuryChairTab } from '../components/contest/ContestJuryChairTab';
import { ContestUserVotingTab } from '../components/contest/ContestUserVotingTab';
import { ContestWinnersSection } from '../components/contest/ContestWinnersSection';
import { ContestRulesViewer } from '../components/contest/ContestRulesViewer';
import { useWebSocket } from '../hooks/useWebSocket';
import { resolvePublicAssetUrl } from '../utils/seo';
import { getContestScheduleDisplayLines } from '../utils/scheduleTimezone';
import { listNominations } from '../api/nominationsApi';
import { sortNominationsByOrder } from '../components/contest/contestNominationsDisplay';
import { getContestJury } from '../api/juryApi';
import type { ParticipantsListSort, ParticipantsListSubmissionFilter } from '../api/participantsApi';
import { ParticipantGalleryNavigationState } from '../types/participantNavigation';
import { buildLoginUrl } from '../utils/navigation';
import { SegmentMenu } from '../components/common/SegmentMenu';
import { NominationTabsBar } from '../components/common/NominationTabsBar';
import { getEffectiveContestStatus } from '../utils/contestEffectiveStatus';
import {
  getJuryChairboardPhaseBlockedMessage,
} from '../utils/juryChairboardAccess';
import '../components/contest/ContestJuryVotingTab.css';
import './ContestPage.css';

const PARTICIPANTS_PAGE_SIZE = 24;
const EMPTY_STRING_ARRAY: string[] = [];
const EMPTY_PARTICIPANTS_ARRAY: Participant[] = [];

type ContestTab = 'about' | 'chat' | 'gallery' | 'winners' | 'jury_voting' | 'jury_chair' | 'user_voting';

const CONTEST_TAB_HASH: Record<ContestTab, string> = {
  about: '#about',
  chat: '#chat',
  gallery: '#gallery',
  winners: '#winners',
  jury_voting: '#jury_voting',
  jury_chair: '#jury_chair',
  user_voting: '#user_voting',
};

function parseContestTabFromHash(hash: string): ContestTab {
  const h = (hash || '').replace(/^#/, '').trim().toLowerCase();
  if (
    h === 'chat' ||
    h === 'gallery' ||
    h === 'winners' ||
    h === 'about' ||
    h === 'jury_voting' ||
    h === 'jury_chair' ||
    h === 'user_voting'
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
  const [participantsSubmissionFilter, setParticipantsSubmissionFilter] =
    useState<ParticipantsListSubmissionFilter>('all');
  const [participantsVotedOnly, setParticipantsVotedOnly] = useState(false);
  const [participantsSort, setParticipantsSort] = useState<ParticipantsListSort>('created_at');
  const [participantsPage, setParticipantsPage] = useState(0);
  const [isCurrentUserJuror, setIsCurrentUserJuror] = useState(false);
  const [isCurrentUserJuryChair, setIsCurrentUserJuryChair] = useState(false);
  const [isDeleteContestModalOpen, setIsDeleteContestModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Note: Removed userParticipant check - users can now have unlimited participants

  const participantsListContestIdRef = useRef<string | undefined>(undefined);
  const participantsListFiltersRef = useRef({
    nomination: participantsNominationFilter as string,
    submission: participantsSubmissionFilter,
    votedOnly: participantsVotedOnly,
    sort: participantsSort,
  });
  /** Синхронно: идёт getContestJury — не редиректить с #jury_* на #about до ответа API. */
  const juryMembershipPendingRef = useRef(false);
  const [juryFetchNonce, setJuryFetchNonce] = useState(0);

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
      setParticipantsSubmissionFilter('all');
      setParticipantsVotedOnly(false);
      const initialSort: ParticipantsListSort = 'votes';
      setParticipantsSort(initialSort);
      setParticipantsPage(0);
      participantsListFiltersRef.current = {
        nomination: 'all',
        submission: 'all',
        votedOnly: false,
        sort: initialSort,
      };
      const paginatedOnReset =
        currentContest.status === 'draft' ||
        currentContest.status === 'publication' ||
        currentContest.status === 'registration';
      const limitOnReset = paginatedOnReset ? PARTICIPANTS_PAGE_SIZE : 10000;
      const offsetOnReset = 0;
      dispatch(
        fetchParticipantsByContest({
          contestId: id,
          nominationFilter: 'all',
          submissionFilter: 'all',
          votedOnly: false,
          sort: initialSort,
          limit: limitOnReset,
          offset: offsetOnReset,
        })
      );
      return;
    }
    const filtersChanged =
      participantsListFiltersRef.current.nomination !== participantsNominationFilter ||
      participantsListFiltersRef.current.submission !== participantsSubmissionFilter ||
      participantsListFiltersRef.current.votedOnly !== participantsVotedOnly ||
      participantsListFiltersRef.current.sort !== participantsSort;
    if (filtersChanged) {
      participantsListFiltersRef.current = {
        nomination: participantsNominationFilter as string,
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
    if (contestNominations.length <= 1 && participantsNominationFilter === 'none') {
      setParticipantsNominationFilter('all');
    }
  }, [contestNominations.length, participantsNominationFilter]);

  useEffect(() => {
    if (!id || !isAuthenticated || !currentContest?.jury_voting_enabled) {
      juryMembershipPendingRef.current = false;
      setIsCurrentUserJuror(false);
      setIsCurrentUserJuryChair(false);
      return;
    }
    juryMembershipPendingRef.current = true;
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
      })
      .finally(() => {
        if (!cancelled) {
          juryMembershipPendingRef.current = false;
          setJuryFetchNonce((n) => n + 1);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, isAuthenticated, currentContest?.jury_voting_enabled, currentUser?.id]);

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
  // Keep contest-level WS subscription active on all tabs (not only chat/participant cards),
  // so vote counters and personal vote slots update in real time on #user_voting too.
  useWebSocket(currentContest?.id ?? id ?? null, null);
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
  const juryPrizePlaces = useMemo(
    () => [...(currentContest?.jury_prize_places ?? [])].sort((a, b) => a.place - b.place),
    [currentContest?.jury_prize_places]
  );
  const audiencePrizePlaces = useMemo(
    () => [...(currentContest?.audience_prize_places ?? [])].sort((a, b) => a.place - b.place),
    [currentContest?.audience_prize_places]
  );
  const activeTab = parseContestTabFromHash(location.hash);
  const canAccessJuryVotingTab =
    Boolean(currentContest?.jury_voting_enabled) && (isAdmin || isCurrentUserJuror);
  const canAccessJuryChairTab =
    Boolean(currentContest?.jury_voting_enabled) && (isAdmin || isCurrentUserJuryChair);
  const canAccessUserVotingTab =
    (currentContest?.user_voting_mode === 'all_users' ||
      currentContest?.user_voting_mode === 'participants_only') &&
    (currentContest?.status === 'voting' || currentContest?.status === 'finished');

  const effectiveContestStatus = useMemo(
    () => (currentContest ? getEffectiveContestStatus(currentContest) : undefined),
    [currentContest]
  );
  const juryChairPhaseBlockedMessage = useMemo(
    () => (currentContest ? getJuryChairboardPhaseBlockedMessage(currentContest) : null),
    [currentContest]
  );

  const contestMenuItems = useMemo(() => {
    const items: { key: ContestTab; label: string }[] = [
      { key: 'about', label: 'О конкурсе' },
      { key: 'chat', label: 'Чат' },
      { key: 'gallery', label: 'Галерея работ' },
      { key: 'winners', label: 'Победители' },
    ];
    if (canAccessJuryVotingTab) {
      items.push({ key: 'jury_voting', label: 'Голосование жюри' });
    }
    if (canAccessJuryChairTab) {
      items.push({ key: 'jury_chair', label: 'Председатель жюри' });
    }
    if (canAccessUserVotingTab) {
      items.push({ key: 'user_voting', label: 'Голосование' });
    }
    return items;
  }, [canAccessJuryVotingTab, canAccessJuryChairTab, canAccessUserVotingTab]);

  const handleContestMenuChange = (key: ContestTab) => {
    navigate(
      { pathname: location.pathname, search: location.search, hash: CONTEST_TAB_HASH[key] },
      { replace: true }
    );
  };

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!currentContest || currentContest.id !== id) {
      return;
    }

    const juryEnabled = Boolean(currentContest.jury_voting_enabled);

    if (activeTab === 'jury_voting') {
      if (!juryEnabled) {
        navigate(
          { pathname: location.pathname, search: location.search, hash: '#about' },
          { replace: true }
        );
        return;
      }
      if (!isAuthenticated) {
        navigate(
          { pathname: location.pathname, search: location.search, hash: '#about' },
          { replace: true }
        );
        return;
      }
      if (isAdmin) {
        return;
      }
      if (juryMembershipPendingRef.current) {
        return;
      }
      if (!canAccessJuryVotingTab) {
        navigate(
          { pathname: location.pathname, search: location.search, hash: '#about' },
          { replace: true }
        );
      }
      return;
    }

    if (activeTab === 'jury_chair') {
      if (!juryEnabled) {
        navigate(
          { pathname: location.pathname, search: location.search, hash: '#about' },
          { replace: true }
        );
        return;
      }
      if (!isAuthenticated) {
        navigate(
          { pathname: location.pathname, search: location.search, hash: '#about' },
          { replace: true }
        );
        return;
      }
      if (isAdmin) {
        return;
      }
      if (juryMembershipPendingRef.current) {
        return;
      }
      if (!canAccessJuryChairTab) {
        navigate(
          { pathname: location.pathname, search: location.search, hash: '#about' },
          { replace: true }
        );
      }
    }
    if (activeTab === 'user_voting' && !canAccessUserVotingTab) {
      navigate(
        { pathname: location.pathname, search: location.search, hash: '#about' },
        { replace: true }
      );
    }
  }, [
    activeTab,
    canAccessJuryVotingTab,
    canAccessJuryChairTab,
    loading,
    currentContest,
    id,
    isAuthenticated,
    isAdmin,
    canAccessUserVotingTab,
    juryFetchNonce,
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
        votedOnly: participantsVotedOnly,
        sort: participantsSort,
        page: participantsListPaginated ? participantsPage : 0,
        pageSize: participantsListPaginated ? PARTICIPANTS_PAGE_SIZE : 10000,
        total: participantsListTotal,
      }
    : null;

  const showMyVotesFilter =
    isAuthenticated &&
    (currentContest.status === 'registration' ||
      currentContest.status === 'voting' ||
      currentContest.status === 'finished');

  const canAddParticipant = isAuthenticated && currentContest.status === 'registration';
  const participationPeriodOpen = currentContest.status === 'registration';
  const showGuestParticipationCta = !isAuthenticated && participationPeriodOpen;
  const showWorksParticipationChrome =
    canAddParticipant || canManageParticipants || showGuestParticipationCta;
  const hasContestNominations = contestNominations.length > 0;
  const nominationsOpenToUser = hasContestNominations
    ? contestNominations.filter(
        (n) => !userHasParticipantForNomination(myContestParticipants, currentUser?.id, n.id)
      )
    : [];
  const alreadyInContestWithoutNominations =
    !hasContestNominations &&
    userHasParticipantForNomination(myContestParticipants, currentUser?.id, null);

  const participateNominationCtaLabel = isAuthenticated
    ? 'Участвовать'
    : 'Зарегистрироваться для участия';

  const hideParticipateCta =
    isAuthenticated &&
    hasContestNominations &&
    nominationsOpenToUser.length === 0 &&
    contestNominations.length > 0;

  const hideParticipateCtaNoNominations =
    isAuthenticated &&
    !hasContestNominations &&
    alreadyInContestWithoutNominations;

  /** Только регистрация; в черновике CTA нет — API не принимает заявки. */
  const showParticipateCtaButton =
    currentContest.status === 'registration' &&
    (!isAuthenticated || (!hideParticipateCta && !hideParticipateCtaNoNominations));

  const handleParticipateClick = () => {
    if (!isAuthenticated) {
      navigate(buildLoginUrl(`${location.pathname}${location.search}`));
      return;
    }
    setIsAddParticipantModalOpen(true);
  };

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

  const contestMenuNav = (
    <nav className="contest-page-menu" aria-label="Меню конкурса">
      <div className="contest-page-menu-row">
        <div className="contest-page-menu-tabs">
          <SegmentMenu<ContestTab>
            variant="contest"
            items={contestMenuItems}
            activeKey={activeTab}
            onChange={handleContestMenuChange}
          />
        </div>
      </div>
    </nav>
  );

  const contestGallerySection = (
    <section
      id="contest-works"
      className="contest-page-works contest-page-works--full-bleed"
      aria-label="Галерея работ"
    >
      <div className="contest-page-participants">
        <div className="contest-page-gallery-toolbar">
        <div className="contest-page-participants-header">
          <div className="contest-page-participants-header-top">
            <div className="contest-page-participants-filters">
              <div className="contest-page-participants-filter">
                <label htmlFor="participants-sort">Порядок</label>
                <select
                  id="participants-sort"
                  className="contest-page-participants-filter-select"
                  value={participantsSort}
                  onChange={(e) => setParticipantsSort(e.target.value as ParticipantsListSort)}
                >
                  <option value="created_at">Новые</option>
                  <option value="votes">Популярные</option>
                  <option value="comments">Обсуждаемые</option>
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
              {showMyVotesFilter ? (
                <label className="contest-page-participants-jury-filter">
                  <input
                    type="checkbox"
                    checked={participantsVotedOnly}
                    onChange={(e) => setParticipantsVotedOnly(e.target.checked)}
                  />
                  <span>Мне нравится</span>
                </label>
              ) : null}
              {showParticipateCtaButton ? (
                <div className="contest-page-participants-filter">
                  <Button
                    type="button"
                    size="large"
                    className="contest-page-add-participant-button"
                    onClick={handleParticipateClick}
                  >
                    {participateNominationCtaLabel}
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
          {contestNominations.length > 1 ? (
            <NominationTabsBar
              allTab={{ label: 'Все номинации', id: 'all' }}
              tabs={contestNominations.map((n) => ({ id: n.id, label: n.title }))}
              selectedId={participantsNominationFilter}
              onSelect={(id) => setParticipantsNominationFilter(id as ParticipantsListNominationFilter)}
              ariaLabel="Фильтр по номинации"
            />
          ) : null}
          {showWorksParticipationChrome ? (
            <>
              {isAuthenticated &&
              hasContestNominations &&
              nominationsOpenToUser.length === 0 &&
              contestNominations.length > 0 ? (
                <p className="contest-page-participants-all-nominations-taken" role="status">
                  Вы уже подали заявки во всех номинациях этого конкурса.
                </p>
              ) : null}
              {isAuthenticated &&
              !hasContestNominations &&
              alreadyInContestWithoutNominations ? (
                <p className="contest-page-participants-all-nominations-taken" role="status">
                  Вы уже подали заявку в этом конкурсе.
                </p>
              ) : null}
            </>
          ) : null}
        </div>
        </div>
        <div className="contest-page-gallery-wide">
        {participantsLoading ? (
          <div className="contest-page-participants-loading">
            <LoadingSpinner size="medium" />
          </div>
        ) : participantIds.length === 0 ? (
          <div className="contest-page-participants-empty">
            {participantsVotedOnly
              ? 'Нет понравившихся работ (с учётом выбранных фильтров).'
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
                  isContestAdmin={isAdmin}
                  galleryNavigationState={participantGalleryNavigationState ?? undefined}
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
      </div>
    </section>
  );

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
        {activeTab === 'gallery' ? (
          <>
            <div className="contest-page-inner contest-page-inner--nav-only">{contestMenuNav}</div>
            {contestGallerySection}
          </>
        ) : (
          <div className="contest-page-inner">
            {contestMenuNav}
        {activeTab === 'about' ? (
          <section className="contest-page-overview" aria-label="О конкурсе">
        {hasHeroCover ? (
          <div className="contest-page-hero contest-page-hero--in-overview">
            <div className="contest-page-hero-cover">
              <img src={resolvePublicAssetUrl(coverRaw)} alt="" />
            </div>
            <div className="contest-page-hero-content">
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

        {showParticipateCtaButton ? (
          <div className="contest-page-participate-cta contest-page-participate-cta--after-description">
            <Button
              type="button"
              size="large"
              className="contest-page-add-participant-button"
              onClick={handleParticipateClick}
            >
              {participateNominationCtaLabel}
            </Button>
          </div>
        ) : null}

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
                <h2 className="contest-page-prize-places-title">Призы по итогам народного голосования</h2>
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
        />

        {currentContest.jury_voting_enabled ? (
          <section className="contest-page-jury-block" aria-label="Состав жюри конкурса">
            <ContestJuryPanel contest={currentContest} isAdmin={false} />
          </section>
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
            <ContestWinnersSection
              contest={currentContest}
              nominations={contestNominations}
              nominationTitleById={nominationTitleById}
              participants={participantsArray}
              participantsLoading={participantsLoading}
            />
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
        {activeTab === 'jury_chair' && canAccessJuryChairTab && currentContest ? (
          <section className="contest-page-jury-voting" aria-label="Председатель жюри">
            {juryChairPhaseBlockedMessage ? (
              <div className="contest-jury-voting">
                <div className="contest-jury-voting-card">
                  <p className="contest-jury-voting-empty" role="status">
                    {juryChairPhaseBlockedMessage}
                  </p>
                </div>
              </div>
            ) : (
              <ContestJuryChairTab
                contestId={currentContest.id}
                contestStatus={effectiveContestStatus ?? currentContest.status}
                nominationTitleById={nominationTitleById}
                nominations={contestNominations}
                juryPrizePlaces={juryPrizePlaces}
              />
            )}
          </section>
        ) : null}
        {activeTab === 'user_voting' && canAccessUserVotingTab ? (
          <section className="contest-page-jury-voting" aria-label="Пользовательское голосование">
            <ContestUserVotingTab
              contestId={currentContest.id}
              contestStatus={currentContest.status}
              nominations={contestNominations}
            />
          </section>
        ) : null}
          </div>
        )}
      </div>

      {id && (
        <AddParticipantModal
          isOpen={isAddParticipantModalOpen}
          onClose={() => {
            setIsAddParticipantModalOpen(false);
          }}
          contestId={id}
          nominations={contestNominations}
          myContestParticipants={myContestParticipants}
          participantsListNominationFilter={participantsNominationFilter}
          participantsListSubmissionFilter={participantsSubmissionFilter}
          participantsListVotedOnly={participantsVotedOnly}
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
          contestRulesText={currentContest?.rules_text}
          contestTitle={currentContest?.title}
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
