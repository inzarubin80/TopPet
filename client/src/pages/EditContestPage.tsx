import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Navigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { fetchContest, updateContest, createContest, clearCurrentContest } from '../store/slices/contestsSlice';
import { Input } from '../components/common/Input';
import { Textarea } from '../components/common/Textarea';
import { Button } from '../components/common/Button';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import {
  ContestOrganizerCriteriaPanel,
  type ContestOrganizerCriteriaPanelHandle,
} from '../components/contest/ContestOrganizerCriteriaPanel';
import {
  ContestRegistrationFieldsPanel,
  type ContestRegistrationFieldsPanelHandle,
} from '../components/contest/ContestRegistrationFieldsPanel';
import {
  ContestJuryPanel,
  type ContestJuryPanelHandle,
} from '../components/contest/ContestJuryPanel';
import { ContestAssetImageField } from '../components/contest/ContestAssetImageField';
import { useToast } from '../contexts/ToastContext';
import { userCanManageContest as canManageContest, canCreateContests } from '../utils/contestPermissions';
import { recalculateContestVotingResults, uploadContestAsset, type ContestAssetKind } from '../api/contestsApi';
import { getErrorMessage } from '../utils/errorHandler';
import { AxiosError } from 'axios';
import type { UpdateContestRequest } from '../types/api';
import type { ContestPrizePlace } from '../types/models';
import {
  DEFAULT_SCHEDULE_TIMEZONE,
  SCHEDULE_TIMEZONE_OPTIONS,
  formatUtcIsoInTimeZone,
  zonedLocalStringToUtcIso,
} from '../utils/scheduleTimezone';
import './EditContestPage.css';

type LoadState = 'loading' | 'ready' | 'error';
type PrizePlacesKind = 'jury' | 'audience';

const emptyPrizePlace = (): ContestPrizePlace => ({ place: 1, prize: '' });

const normalizePrizePlaces = (items: ContestPrizePlace[]): ContestPrizePlace[] =>
  items
    .map((it) => ({ place: Number(it.place) || 0, prize: (it.prize || '').trim() }))
    .filter((it) => it.place > 0 || it.prize !== '')
    .sort((a, b) => a.place - b.place);

const EditContestSaveToolbar: React.FC<{
  saving: boolean;
  saveDisabled: boolean;
  onSave: () => void | Promise<void>;
  variant?: 'top' | 'bottom';
}> = ({ saving, saveDisabled, onSave, variant = 'top' }) => (
  <div
    className={
      variant === 'bottom'
        ? 'edit-contest-page-actions edit-contest-page-actions--bottom'
        : 'edit-contest-page-actions'
    }
  >
    <Button type="button" onClick={() => void onSave()} disabled={saving || saveDisabled}>
      {saving ? <LoadingSpinner size="small" /> : 'Сохранить изменения'}
    </Button>
  </div>
);

const EditContestPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { showSuccess, showError } = useToast();
  const currentContest = useSelector((state: RootState) => state.contests.currentContest);
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const panelRef = useRef<ContestOrganizerCriteriaPanelHandle>(null);
  const juryPanelRef = useRef<ContestJuryPanelHandle>(null);
  const registrationFieldsRef = useRef<ContestRegistrationFieldsPanelHandle>(null);

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [publicVoting, setPublicVoting] = useState(true);
  const [juryVoting, setJuryVoting] = useState(false);
  const [coverUrl, setCoverUrl] = useState('');
  const [tagline, setTagline] = useState('');
  const [rulesText, setRulesText] = useState('');
  const [juryPrizePlaces, setJuryPrizePlaces] = useState<ContestPrizePlace[]>([]);
  const [audiencePrizePlaces, setAudiencePrizePlaces] = useState<ContestPrizePlace[]>([]);
  const [logoUrl, setLogoUrl] = useState('');
  const [themeColor, setThemeColor] = useState('');
  const [sponsorName, setSponsorName] = useState('');
  const [sponsorLogoUrl, setSponsorLogoUrl] = useState('');
  const [sponsorUrl, setSponsorUrl] = useState('');
  const [ctaLabelOverride, setCtaLabelOverride] = useState('');
  const [publicationStartsLocal, setPublicationStartsLocal] = useState('');
  const [registrationStartsLocal, setRegistrationStartsLocal] = useState('');
  const [votingStartsLocal, setVotingStartsLocal] = useState('');
  const [votingEndsLocal, setVotingEndsLocal] = useState('');
  const [scheduleTimezone, setScheduleTimezone] = useState(DEFAULT_SCHEDULE_TIMEZONE);
  const [participantEmailDomainsText, setParticipantEmailDomainsText] = useState('');
  const [minPhotoCount, setMinPhotoCount] = useState(1);
  const [maxPhotoCount, setMaxPhotoCount] = useState(30);
  const [entryTitleHint, setEntryTitleHint] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assetUploading, setAssetUploading] = useState<ContestAssetKind | null>(null);
  const [recalculatingResults, setRecalculatingResults] = useState(false);
  const [juryCriteriaPortalHost, setJuryCriteriaPortalHost] = useState<HTMLDivElement | null>(null);

  const handleJuryCriteriaSlotRef = useCallback((el: HTMLDivElement | null) => {
    setJuryCriteriaPortalHost(el);
  }, []);

  /**
   * Синхронизирует флаг «голосование жюри» на сервере перед вызовами API жюри (добавление/порядок и т.д.),
   * если чекбокс включён локально, а на сервере ещё выключено. Остальные поля конкурса при этом не трогаем.
   */
  const ensureJuryVotingEnabledOnServer = useCallback(async (): Promise<boolean> => {
    if (!id || id === 'new' || !currentContest) return false;
    if (currentContest.jury_voting_enabled) return true;
    if (!juryVoting) {
      showError('Включите «Голосование жюри» в блоке «Настройки голосования».');
      return false;
    }
    const result = await dispatch(
      updateContest({
        contestId: id,
        data: { jury_voting_enabled: true },
      })
    );
    if (!updateContest.fulfilled.match(result)) {
      showError((result.payload as string) || 'Не удалось включить голосование жюри на сервере');
      return false;
    }
    return true;
  }, [id, currentContest, juryVoting, dispatch, showError]);

  const handleRecalculateVotingResults = useCallback(async () => {
    if (!id || id === 'new') return;
    setRecalculatingResults(true);
    try {
      await recalculateContestVotingResults(id);
      await dispatch(fetchContest(id)).unwrap();
      showSuccess('Результаты голосования пересчитаны и сохранены');
    } catch (err: unknown) {
      showError(getErrorMessage(err));
    } finally {
      setRecalculatingResults(false);
    }
  }, [id, dispatch, showSuccess, showError]);

  useEffect(() => {
    if (!juryVoting) {
      setJuryCriteriaPortalHost(null);
    }
  }, [juryVoting]);

  useEffect(() => {
    if (!id) {
      setLoadState('error');
      return;
    }
    if (id === 'new') {
      dispatch(clearCurrentContest());
      setTitle('');
      setDescription('');
      setPublicVoting(true);
      setJuryVoting(false);
      setCoverUrl('');
      setTagline('');
      setRulesText('');
      setJuryPrizePlaces([]);
      setAudiencePrizePlaces([]);
      setLogoUrl('');
      setThemeColor('');
      setSponsorName('');
      setSponsorLogoUrl('');
      setSponsorUrl('');
      setCtaLabelOverride('');
      setPublicationStartsLocal('');
      setRegistrationStartsLocal('');
      setVotingStartsLocal('');
      setVotingEndsLocal('');
      setScheduleTimezone(DEFAULT_SCHEDULE_TIMEZONE);
      setParticipantEmailDomainsText('');
      setMinPhotoCount(1);
      setMaxPhotoCount(30);
      setEntryTitleHint('');
      setLoadState('ready');
      return;
    }
    setLoadState('loading');
    dispatch(fetchContest(id))
      .unwrap()
      .then((contest) => {
        setTitle(contest.title);
        setDescription(contest.description || '');
        setPublicVoting(contest.public_voting_enabled ?? true);
        setJuryVoting(contest.jury_voting_enabled ?? false);
        setCoverUrl(contest.cover_url ?? '');
        setTagline(contest.tagline ?? '');
        setRulesText(contest.rules_text ?? '');
        setJuryPrizePlaces(contest.jury_prize_places ?? []);
        setAudiencePrizePlaces(contest.audience_prize_places ?? []);
        setLogoUrl(contest.logo_url ?? '');
        setThemeColor(contest.theme_color ?? '');
        setSponsorName(contest.sponsor_name ?? '');
        setSponsorLogoUrl(contest.sponsor_logo_url ?? '');
        setSponsorUrl(contest.sponsor_url ?? '');
        setCtaLabelOverride(contest.cta_label_override ?? '');
        const tz = contest.schedule_timezone?.trim() || DEFAULT_SCHEDULE_TIMEZONE;
        setScheduleTimezone(tz);
        setPublicationStartsLocal(formatUtcIsoInTimeZone(contest.publication_starts_at, tz));
        setRegistrationStartsLocal(formatUtcIsoInTimeZone(contest.registration_starts_at, tz));
        setVotingStartsLocal(formatUtcIsoInTimeZone(contest.voting_starts_at, tz));
        setVotingEndsLocal(formatUtcIsoInTimeZone(contest.voting_ends_at, tz));
        setParticipantEmailDomainsText((contest.participant_allowed_email_domains ?? []).join('\n'));
        setMinPhotoCount(contest.min_photo_count ?? 1);
        setMaxPhotoCount(contest.max_photo_count ?? 30);
        setEntryTitleHint(contest.entry_title_hint ?? '');
        setLoadState('ready');
      })
      .catch(() => setLoadState('error'));
  }, [dispatch, id]);

  const handleCreateContest = async () => {
    if (!title.trim()) {
      setError('Название обязательно');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const created = await dispatch(createContest({ title: title.trim(), description: '' }));
      if (!createContest.fulfilled.match(created)) {
        setError((created.payload as string) || 'Не удалось создать конкурс');
        return;
      }
      showSuccess('Конкурс создан');
      navigate(`/contests/${created.payload.id}/edit`, { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Не удалось создать конкурс';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    if (!id || id === 'new' || !title.trim()) {
      setError('Название обязательно');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const scheduleField = (local: string): string => {
        const t = local.trim();
        if (!t) return '';
        const iso = zonedLocalStringToUtcIso(t, scheduleTimezone);
        if (!iso) {
          throw new Error('Проверьте даты расписания (некорректное значение)');
        }
        return iso;
      };

      const data: UpdateContestRequest = {
        title: title.trim(),
        description: description.trim(),
        public_voting_enabled: publicVoting,
        jury_voting_enabled: juryVoting,
        cover_url: coverUrl.trim(),
        tagline: tagline.trim(),
        rules_text: rulesText,
        jury_prize_places: normalizePrizePlaces(juryPrizePlaces),
        audience_prize_places: normalizePrizePlaces(audiencePrizePlaces),
        logo_url: logoUrl.trim(),
        theme_color: themeColor.trim(),
        sponsor_name: sponsorName.trim(),
        sponsor_logo_url: sponsorLogoUrl.trim(),
        sponsor_url: sponsorUrl.trim(),
        cta_label_override: ctaLabelOverride.trim(),
        publication_starts_at: scheduleField(publicationStartsLocal),
        registration_starts_at: scheduleField(registrationStartsLocal),
        voting_starts_at: scheduleField(votingStartsLocal),
        voting_ends_at: scheduleField(votingEndsLocal),
        participant_allowed_email_domains: participantEmailDomainsText
          .split(/\r?\n|,|;/)
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
        schedule_timezone: scheduleTimezone,
        min_photo_count: minPhotoCount,
        max_photo_count: maxPhotoCount,
        entry_title_hint: entryTitleHint,
      };

      const result = await dispatch(
        updateContest({
          contestId: id,
          data,
        })
      );

      if (!updateContest.fulfilled.match(result)) {
        setError((result.payload as string) || 'Не удалось обновить конкурс');
        return;
      }

      await dispatch(fetchContest(id)).unwrap();

      const critOk = await panelRef.current?.saveJuryCriteria({ quietSuccess: true });
      if (critOk === false) {
        return;
      }

      const juryOk = await juryPanelRef.current?.flushPendingJuryMemberEdits({ quietSuccess: true });
      if (juryOk === false) {
        return;
      }

      const regOk = await registrationFieldsRef.current?.saveRegistrationFields({ quietSuccess: true });
      if (regOk === false) {
        return;
      }

      showSuccess('Изменения сохранены');
      navigate(`/contests/${id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Не удалось сохранить';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const updatePrizePlace = (kind: PrizePlacesKind, index: number, patch: Partial<ContestPrizePlace>) => {
    const setter = kind === 'jury' ? setJuryPrizePlaces : setAudiencePrizePlaces;
    setter((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item))
    );
  };

  const addPrizePlace = (kind: PrizePlacesKind) => {
    const setter = kind === 'jury' ? setJuryPrizePlaces : setAudiencePrizePlaces;
    setter((prev) => [...prev, emptyPrizePlace()]);
  };

  const removePrizePlace = (kind: PrizePlacesKind, index: number) => {
    const setter = kind === 'jury' ? setJuryPrizePlaces : setAudiencePrizePlaces;
    setter((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleContestAssetFile = async (kind: ContestAssetKind, file: File) => {
    if (!id || id === 'new') return;
    setError(null);
    setAssetUploading(kind);
    try {
      const contest = await uploadContestAsset(id, kind, file);
      if (kind === 'cover') {
        setCoverUrl(contest.cover_url ?? '');
      } else if (kind === 'logo') {
        setLogoUrl(contest.logo_url ?? '');
      } else {
        setSponsorLogoUrl(contest.sponsor_logo_url ?? '');
      }
      showSuccess('Изображение загружено и сохранено');
    } catch (e: unknown) {
      const ax = e as AxiosError;
      const status = ax.response?.status;
      const base = getErrorMessage(e);
      const message =
        status === 404
          ? 'Загрузка файлов недоступна (нет маршрута или конкурс не найден). Проверьте настройки сервера или обратитесь к администратору.'
          : base;
      setError(message);
    } finally {
      setAssetUploading(null);
    }
  };

  const handleScheduleTimezoneChange = (next: string) => {
    const prev = scheduleTimezone;
    setScheduleTimezone(next);
    const convert = (local: string): string => {
      if (!local.trim()) return '';
      const iso = zonedLocalStringToUtcIso(local, prev);
      return iso ? formatUtcIsoInTimeZone(iso, next) : '';
    };
    setPublicationStartsLocal((v) => convert(v));
    setRegistrationStartsLocal((v) => convert(v));
    setVotingStartsLocal((v) => convert(v));
    setVotingEndsLocal((v) => convert(v));
  };

  if (!id) {
    return <div className="edit-contest-page-error">Конкурс не найден</div>;
  }

  if (id === 'new') {
    if (!currentUser || !canCreateContests(currentUser)) {
      return <Navigate to="/" replace />;
    }
    return (
      <div className="edit-contest-page edit-contest-page--create">
        <div className="edit-contest-page-inner">
          <header className="edit-contest-page-header">
            <Link to="/" className="edit-contest-page-back">
              <span className="edit-contest-page-back-icon" aria-hidden>
                ‹
              </span>
              На главную
            </Link>
            <div className="edit-contest-page-heading">
              <p className="edit-contest-page-eyebrow">Настройки</p>
              <h1 className="edit-contest-page-title">Новый конкурс</h1>
              <p className="edit-contest-page-lead">
                Введите название и нажмите «Добавить» — конкурс будет создан, откроется полная форма
                редактирования (номинации, жюри, поля заявки и оформление).
              </p>
            </div>
          </header>

          {error && (
            <div className="edit-contest-page-error-banner" role="alert">
              <ErrorMessage message={error} />
            </div>
          )}

          <section className="edit-contest-page-card edit-contest-page-card--create" aria-label="Создание конкурса">
            <div className="edit-contest-page-fields">
              <Input
                label="Название"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например, «Весенний фотоконкурс»"
                required
                disabled={saving}
              />
            </div>
            <div className="edit-contest-page-actions">
              <Button type="button" onClick={() => void handleCreateContest()} disabled={saving || !title.trim()}>
                {saving ? <LoadingSpinner size="small" /> : 'Добавить'}
              </Button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (loadState === 'loading') {
    return (
      <div className="edit-contest-page-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (loadState === 'error' || !currentContest || currentContest.id !== id) {
    return <div className="edit-contest-page-error">Конкурс не найден</div>;
  }
  if (!currentUser || !canManageContest(currentContest, currentUser.id, currentUser)) {
    return <Navigate to={`/contests/${id}`} replace />;
  }

  return (
    <div className="edit-contest-page">
      <div className="edit-contest-page-inner">
        <header className="edit-contest-page-header">
          <Link to={`/contests/${id}`} className="edit-contest-page-back">
            <span className="edit-contest-page-back-icon" aria-hidden>
              ‹
            </span>
            К конкурсу
          </Link>
          <div className="edit-contest-page-heading">
            <p className="edit-contest-page-eyebrow">Настройки</p>
            <h1 className="edit-contest-page-title">Редактировать конкурс</h1>
            <p className="edit-contest-page-lead">
              Тексты, расписание, лимиты фото и флаги голосования, критерии жюри, поля заявки и правки портфолио членов
              жюри фиксируются кнопкой «Сохранить изменения» вверху или внизу страницы. Загрузка картинок конкурса,
              состав номинаций (добавление, порядок, логотипы) и состав жюри (добавление, порядок) сохраняются сразу при
              действии — так проще проверить лимиты и файлы на сервере.
            </p>
          </div>
        </header>

        <EditContestSaveToolbar
          saving={saving}
          saveDisabled={!title.trim()}
          onSave={handleSaveAll}
        />

        {error && (
          <div className="edit-contest-page-error-banner" role="alert">
            <ErrorMessage message={error} />
          </div>
        )}

        <section className="edit-contest-page-card" aria-labelledby="edit-section-main">
          <h2 id="edit-section-main" className="edit-contest-page-section-label">
            Основное
          </h2>
          <div className="edit-contest-page-fields">
            <Input
              label="Название"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например, «Весенний фотоконкурс»"
              required
              disabled={saving}
            />
            <Textarea
              label="Описание"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Кратко опишите конкурс для участников"
              disabled={saving}
            />
            <Input
              label="Слоган (подзаголовок)"
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Короткая строка под названием на странице конкурса"
              disabled={saving}
            />
          </div>
        </section>

        <section className="edit-contest-page-card" aria-labelledby="edit-section-participant-domains">
          <h2 id="edit-section-participant-domains" className="edit-contest-page-section-label">
            Кто может подать заявку
          </h2>
          <p className="edit-contest-schedule-intro">
            Необязательно. Укажите домены корпоративной почты (по одному в строке, без символа @), например{' '}
            <code>company.ru</code>. Заявку сможет отправить только пользователь с e-mail на один из этих доменов
            (включая поддомены). Организаторы конкурса не ограничены. Пустое поле — участвовать может любой
            авторизованный пользователь.
          </p>
          <div className="edit-contest-page-fields">
            <Textarea
              label="Домены e-mail"
              value={participantEmailDomainsText}
              onChange={(e) => setParticipantEmailDomainsText(e.target.value)}
              placeholder={'company.ru\npartner.org'}
              disabled={saving}
            />
          </div>
        </section>

        <section className="edit-contest-page-card" aria-labelledby="edit-section-photo-limits">
          <h2 id="edit-section-photo-limits" className="edit-contest-page-section-label">
            Фотографии в заявке
          </h2>
          <p className="edit-contest-schedule-intro">
            Сколько фото может быть в одной заявке участника. Одно и то же ограничение действует для всего конкурса,
            в том числе при нескольких номинациях.
          </p>
          <div className="edit-contest-page-fields edit-contest-page-fields--inline">
            <label className="edit-contest-photo-limit">
              <span className="edit-contest-field-label">Минимум</span>
              <select
                className="edit-contest-control-select"
                value={minPhotoCount}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setMinPhotoCount(v);
                  if (maxPhotoCount < v) setMaxPhotoCount(v);
                }}
                disabled={saving}
                aria-label="Минимум фотографий в заявке"
              >
                {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="edit-contest-photo-limit">
              <span className="edit-contest-field-label">Максимум</span>
              <select
                className="edit-contest-control-select"
                value={maxPhotoCount}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setMaxPhotoCount(v);
                  if (minPhotoCount > v) setMinPhotoCount(v);
                }}
                disabled={saving}
                aria-label="Максимум фотографий в заявке"
              >
                {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="edit-contest-page-card" aria-labelledby="edit-section-schedule">
          <h2 id="edit-section-schedule" className="edit-contest-page-section-label">
            Расписание фаз
          </h2>
          <p className="edit-contest-schedule-intro">
            Время ниже задаётся в выбранном часовом поясе; на сервере моменты хранятся в UTC. Пустое поле сбрасывает
            дату. Приём заявок идёт до «Начало голосования». Фоновый процесс (интервал{' '}
            <code>CONTEST_SCHEDULER_INTERVAL_SEC</code>, по умолчанию 60 с) сверяет текущее время с датами и выставляет
            статус: окончание голосования → завершён; иначе начало голосования → голосование; иначе начало регистрации →
            регистрация; иначе начало публикации → публикация; иначе → черновик (в том числе если даты перенесены в
            будущее).
          </p>
          <div className="edit-contest-page-fields">
            <label className="edit-contest-schedule-tz">
              <span className="edit-contest-field-label">Часовой пояс</span>
              <select
                className="edit-contest-control-select"
                value={scheduleTimezone}
                onChange={(e) => handleScheduleTimezoneChange(e.target.value)}
                disabled={saving}
                aria-label="Часовой пояс расписания"
              >
                {!SCHEDULE_TIMEZONE_OPTIONS.some((o) => o.value === scheduleTimezone) ? (
                  <option value={scheduleTimezone}>{scheduleTimezone}</option>
                ) : null}
                {SCHEDULE_TIMEZONE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Начало публикации (анонс)"
              type="datetime-local"
              value={publicationStartsLocal}
              onChange={(e) => setPublicationStartsLocal(e.target.value)}
              disabled={saving}
            />
            <Input
              label="Начало регистрации"
              type="datetime-local"
              value={registrationStartsLocal}
              onChange={(e) => setRegistrationStartsLocal(e.target.value)}
              disabled={saving}
            />
            <Input
              label="Начало голосования"
              type="datetime-local"
              value={votingStartsLocal}
              onChange={(e) => setVotingStartsLocal(e.target.value)}
              disabled={saving}
            />
            <Input
              label="Окончание голосования"
              type="datetime-local"
              value={votingEndsLocal}
              onChange={(e) => setVotingEndsLocal(e.target.value)}
              disabled={saving}
            />
          </div>
        </section>

        <section
          className="edit-contest-page-card edit-contest-page-card--organizer"
          aria-label="Номинации"
        >
          <div className="edit-contest-page-organizer">
            <ContestOrganizerCriteriaPanel
              ref={panelRef}
              contest={currentContest}
              isAdmin
              hideJuryCriteriaSaveButton
              formDisabled={saving}
              showJuryCriteriaSection={juryVoting}
              juryCriteriaPortalMode={juryVoting}
              juryCriteriaPortalHost={juryCriteriaPortalHost}
            />
          </div>
        </section>

        <section className="edit-contest-page-card" aria-labelledby="edit-section-appearance">
          <h2 id="edit-section-appearance" className="edit-contest-page-section-label">
            Оформление страницы конкурса
          </h2>
          <p className="edit-contest-appearance-intro">
            Баннер, логотипы и цвет акцента. Файл при выборе сразу загружается на сервер; остальное оформление (тексты,
            ссылки, цвет) — по кнопке «Сохранить изменения». Чтобы снять картинку с публикации, нажмите «Убрать» и
            сохраните страницу.
          </p>
          <div className="edit-contest-page-fields edit-contest-appearance-fields">
            <ContestAssetImageField
              legend="Баннер (обложка)"
              url={coverUrl}
              onClear={() => setCoverUrl('')}
              onPickFile={(file) => handleContestAssetFile('cover', file)}
              uploading={assetUploading === 'cover'}
              disabled={saving}
            />
            <ContestAssetImageField
              legend="Логотип конкурса"
              url={logoUrl}
              onClear={() => setLogoUrl('')}
              onPickFile={(file) => handleContestAssetFile('logo', file)}
              uploading={assetUploading === 'logo'}
              disabled={saving}
            />
            <div className="edit-contest-theme-row">
              <Input
                label="Цвет акцента (HEX)"
                type="text"
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value)}
                placeholder="#2563eb или пусто"
                disabled={saving}
              />
              <label className="edit-contest-theme-picker-wrap">
                <span className="edit-contest-field-label">Палитра</span>
                <input
                  type="color"
                  className="edit-contest-theme-picker"
                  value={/^#[0-9A-Fa-f]{6}$/.test(themeColor.trim()) ? themeColor.trim() : '#2563eb'}
                  onChange={(e) => setThemeColor(e.target.value)}
                  disabled={saving}
                  aria-label="Выбор цвета акцента"
                />
              </label>
            </div>
            <Textarea
              label="Правила конкурса (многострочный текст)"
              value={rulesText}
              onChange={(e) => setRulesText(e.target.value)}
              placeholder="Условия участия, критерии, запреты…"
              rows={10}
              disabled={saving}
              className="edit-contest-rules-textarea"
            />
            <Input
              label="Название спонсора"
              type="text"
              value={sponsorName}
              onChange={(e) => setSponsorName(e.target.value)}
              disabled={saving}
            />
            <ContestAssetImageField
              legend="Логотип спонсора"
              url={sponsorLogoUrl}
              onClear={() => setSponsorLogoUrl('')}
              onPickFile={(file) => handleContestAssetFile('sponsor_logo', file)}
              uploading={assetUploading === 'sponsor_logo'}
              disabled={saving}
            />
            <Input
              label="Ссылка на сайт спонсора"
              type="url"
              value={sponsorUrl}
              onChange={(e) => setSponsorUrl(e.target.value)}
              placeholder="https://…"
              disabled={saving}
            />
            <Input
              label="Текст на кнопке голосования"
              type="text"
              value={ctaLabelOverride}
              onChange={(e) => setCtaLabelOverride(e.target.value)}
              placeholder="По умолчанию: «Проголосовать»"
              disabled={saving}
            />
          </div>
        </section>

        <section className="edit-contest-page-card" aria-labelledby="edit-section-voting">
          <h2 id="edit-section-voting" className="edit-contest-page-section-label">
            Настройки голосования
          </h2>
          <div className="edit-contest-voting">
            <label className="edit-contest-voting-row">
              <input
                type="checkbox"
                checked={juryVoting}
                onChange={(e) => setJuryVoting(e.target.checked)}
                disabled={saving}
              />
              <span className="edit-contest-voting-text">
                <span className="edit-contest-voting-label">Голосование жюри</span>
                <p className="edit-contest-voting-hint">
                  Включите, чтобы открыть ниже отдельные блоки критериев оценки и состава жюри.
                </p>
              </span>
            </label>
            <label className="edit-contest-voting-row">
              <input
                type="checkbox"
                checked={publicVoting}
                onChange={(e) => setPublicVoting(e.target.checked)}
                disabled={saving}
              />
              <span className="edit-contest-voting-text">
                <span className="edit-contest-voting-label">Пользовательское голосование</span>
                <p className="edit-contest-voting-hint">
                  Если включено, посетители смогут голосовать за участников в фазе «Голосование». Если выключено —
                  только жюри (при включённом голосовании жюри).
                </p>
              </span>
            </label>
          </div>
          <div className="edit-contest-prize-places-wrap">
            <div className="edit-contest-prize-places">
              <p className="edit-contest-field-label">Места жюри и призы</p>
              <div className="edit-contest-prize-places-list">
                {juryPrizePlaces.map((item, index) => (
                  <div key={`jury-${index}`} className="edit-contest-prize-place-row">
                    <Input
                      label="Место"
                      type="number"
                      value={String(item.place)}
                      onChange={(e) => updatePrizePlace('jury', index, { place: Number(e.target.value) || 0 })}
                      disabled={saving}
                    />
                    <Input
                      label="Приз"
                      type="text"
                      value={item.prize}
                      onChange={(e) => updatePrizePlace('jury', index, { prize: e.target.value })}
                      disabled={saving}
                    />
                    <Button type="button" variant="secondary" onClick={() => removePrizePlace('jury', index)} disabled={saving}>
                      Удалить
                    </Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="secondary" onClick={() => addPrizePlace('jury')} disabled={saving}>
                Добавить место жюри
              </Button>
            </div>
            <div className="edit-contest-prize-places">
              <p className="edit-contest-field-label">Места зрительских симпатий и призы</p>
              <div className="edit-contest-prize-places-list">
                {audiencePrizePlaces.map((item, index) => (
                  <div key={`audience-${index}`} className="edit-contest-prize-place-row">
                    <Input
                      label="Место"
                      type="number"
                      value={String(item.place)}
                      onChange={(e) => updatePrizePlace('audience', index, { place: Number(e.target.value) || 0 })}
                      disabled={saving}
                    />
                    <Input
                      label="Приз"
                      type="text"
                      value={item.prize}
                      onChange={(e) => updatePrizePlace('audience', index, { prize: e.target.value })}
                      disabled={saving}
                    />
                    <Button type="button" variant="secondary" onClick={() => removePrizePlace('audience', index)} disabled={saving}>
                      Удалить
                    </Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="secondary" onClick={() => addPrizePlace('audience')} disabled={saving}>
                Добавить место зрителей
              </Button>
            </div>
          </div>
        </section>

        {currentContest.status === 'finished' ? (
          <section className="edit-contest-page-card" aria-labelledby="edit-section-voting-results-snapshot">
            <h2 id="edit-section-voting-results-snapshot" className="edit-contest-page-section-label">
              Результаты голосования
            </h2>
            <p className="edit-contest-schedule-intro">
              Снимок призовых мест фиксируется при завершении конкурса. Если изменились голоса или настройки мест,
              нажмите «Пересчитать», чтобы обновить сохранённые победители (например, после исправления данных).
            </p>
            {currentContest.voting_results_computed_at ? (
              <p className="edit-contest-schedule-intro">
                Последнее сохранение снимка:{' '}
                <strong>{new Date(currentContest.voting_results_computed_at).toLocaleString()}</strong>
              </p>
            ) : null}
            <div className="edit-contest-page-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleRecalculateVotingResults()}
                disabled={recalculatingResults || saving}
              >
                {recalculatingResults ? <LoadingSpinner size="small" /> : 'Пересчитать результаты голосования'}
              </Button>
            </div>
          </section>
        ) : null}

        {juryVoting ? (
          <section
            className="edit-contest-page-card edit-contest-page-card--organizer"
            aria-labelledby="edit-section-jury-criteria"
          >
            <h2 id="edit-section-jury-criteria" className="edit-contest-page-section-label">
              Критерии оценки
            </h2>
            <p className="edit-contest-schedule-intro">
              Шкалы и формулировки, по которым жюри выставляет баллы. Сохраняются вместе со страницей конкурса
              (кнопка «Сохранить изменения»).
            </p>
            <div className="edit-contest-page-organizer">
              <div
                className="edit-contest-jury-criteria-portal-host"
                ref={handleJuryCriteriaSlotRef}
              />
            </div>
          </section>
        ) : null}

        {juryVoting ? (
          <section
            className="edit-contest-page-card edit-contest-page-card--organizer"
            aria-labelledby="edit-section-jury-members"
          >
            <h2 id="edit-section-jury-members" className="edit-contest-page-section-label">
              Состав жюри
            </h2>
            <div className="edit-contest-page-organizer edit-contest-page-organizer--jury-members">
              <ContestJuryPanel
                ref={juryPanelRef}
                contest={currentContest}
                isAdmin
                ensureJuryVotingEnabledOnServer={ensureJuryVotingEnabledOnServer}
              />
            </div>
          </section>
        ) : null}

        <section
          className="edit-contest-page-card edit-contest-page-card--organizer"
          aria-label="Поля заявки участника"
        >
          <div className="edit-contest-page-organizer">
            <Textarea
              label="Подсказка к полю «Наименование» в заявке"
              value={entryTitleHint}
              onChange={(e) => setEntryTitleHint(e.target.value)}
              placeholder="Например: укажите краткое название работы так, как оно должно отображаться в списке участников."
              rows={4}
              disabled={saving}
              className="edit-contest-entry-title-hint"
            />
            <ContestRegistrationFieldsPanel
              ref={registrationFieldsRef}
              contest={currentContest}
              isAdmin
              hideSaveButton
              formDisabled={saving}
            />
          </div>
        </section>

        <EditContestSaveToolbar
          saving={saving}
          saveDisabled={!title.trim()}
          onSave={handleSaveAll}
          variant="bottom"
        />
      </div>
    </div>
  );
};

export default EditContestPage;
