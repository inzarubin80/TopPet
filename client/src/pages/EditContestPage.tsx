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
import { ContestJuryPanel } from '../components/contest/ContestJuryPanel';
import { ContestAssetImageField } from '../components/contest/ContestAssetImageField';
import { useToast } from '../contexts/ToastContext';
import { userCanManageContest as canManageContest, canCreateContests } from '../utils/contestPermissions';
import { uploadContestAsset, type ContestAssetKind } from '../api/contestsApi';
import { getErrorMessage } from '../utils/errorHandler';
import { AxiosError } from 'axios';
import type { UpdateContestRequest } from '../types/api';
import {
  DEFAULT_SCHEDULE_TIMEZONE,
  SCHEDULE_TIMEZONE_OPTIONS,
  formatUtcIsoInTimeZone,
  zonedLocalStringToUtcIso,
} from '../utils/scheduleTimezone';
import './EditContestPage.css';

type LoadState = 'loading' | 'ready' | 'error';

const EditContestPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { showSuccess } = useToast();
  const currentContest = useSelector((state: RootState) => state.contests.currentContest);
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const panelRef = useRef<ContestOrganizerCriteriaPanelHandle>(null);
  const registrationFieldsRef = useRef<ContestRegistrationFieldsPanelHandle>(null);

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [publicVoting, setPublicVoting] = useState(true);
  const [juryVoting, setJuryVoting] = useState(false);
  const [coverUrl, setCoverUrl] = useState('');
  const [tagline, setTagline] = useState('');
  const [rulesText, setRulesText] = useState('');
  const [prizeText, setPrizeText] = useState('');
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assetUploading, setAssetUploading] = useState<ContestAssetKind | null>(null);
  const [juryCriteriaPortalHost, setJuryCriteriaPortalHost] = useState<HTMLDivElement | null>(null);

  const handleJuryCriteriaSlotRef = useCallback((el: HTMLDivElement | null) => {
    setJuryCriteriaPortalHost(el);
  }, []);

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
      setPrizeText('');
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
        setPrizeText(contest.prize_text ?? '');
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
        setLoadState('ready');
      })
      .catch(() => setLoadState('error'));
  }, [dispatch, id]);

  useEffect(() => {
    if (id === 'new' || loadState !== 'ready' || !id || currentContest?.id !== id) {
      return;
    }
    setTitle(currentContest.title);
    setDescription(currentContest.description || '');
    setPublicVoting(currentContest.public_voting_enabled ?? true);
    setJuryVoting(currentContest.jury_voting_enabled ?? false);
    setCoverUrl(currentContest.cover_url ?? '');
    setTagline(currentContest.tagline ?? '');
    setRulesText(currentContest.rules_text ?? '');
    setPrizeText(currentContest.prize_text ?? '');
    setLogoUrl(currentContest.logo_url ?? '');
    setThemeColor(currentContest.theme_color ?? '');
    setSponsorName(currentContest.sponsor_name ?? '');
    setSponsorLogoUrl(currentContest.sponsor_logo_url ?? '');
    setSponsorUrl(currentContest.sponsor_url ?? '');
    setCtaLabelOverride(currentContest.cta_label_override ?? '');
    const tz = currentContest.schedule_timezone?.trim() || DEFAULT_SCHEDULE_TIMEZONE;
    setScheduleTimezone(tz);
    setPublicationStartsLocal(formatUtcIsoInTimeZone(currentContest.publication_starts_at, tz));
    setRegistrationStartsLocal(formatUtcIsoInTimeZone(currentContest.registration_starts_at, tz));
    setVotingStartsLocal(formatUtcIsoInTimeZone(currentContest.voting_starts_at, tz));
    setVotingEndsLocal(formatUtcIsoInTimeZone(currentContest.voting_ends_at, tz));
    setParticipantEmailDomainsText((currentContest.participant_allowed_email_domains ?? []).join('\n'));
  }, [loadState, id, currentContest]);

  const handleSaveAll = async () => {
    if (!id || !title.trim()) {
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
        prize_text: prizeText.trim(),
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
      };

      const isNew = id === 'new';
      let contestId = id;

      if (isNew) {
        const created = await dispatch(
          createContest({ title: title.trim(), description: description.trim() })
        );
        if (!createContest.fulfilled.match(created)) {
          setError((created.payload as string) || 'Не удалось создать конкурс');
          return;
        }
        contestId = created.payload.id;
      }

      const result = await dispatch(
        updateContest({
          contestId,
          data,
        })
      );

      if (!updateContest.fulfilled.match(result)) {
        setError((result.payload as string) || 'Не удалось обновить конкурс');
        return;
      }

      await dispatch(fetchContest(contestId)).unwrap();

      if (!isNew) {
        const critOk = await panelRef.current?.saveJuryCriteria({ quietSuccess: true });
        if (critOk === false) {
          return;
        }

        const regOk = await registrationFieldsRef.current?.saveRegistrationFields({ quietSuccess: true });
        if (regOk === false) {
          return;
        }
      }

      if (isNew) {
        showSuccess('Черновик создан. Ниже можно настроить номинации и жюри.');
        navigate(`/contests/${contestId}/edit`, { replace: true });
        return;
      }

      showSuccess('Изменения сохранены');
      navigate(`/contests/${contestId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Не удалось сохранить';
      setError(message);
    } finally {
      setSaving(false);
    }
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

  if (loadState === 'loading') {
    return (
      <div className="edit-contest-page-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  const isNewContest = id === 'new';

  if (isNewContest) {
    if (!currentUser || !canCreateContests(currentUser)) {
      return <Navigate to="/" replace />;
    }
  } else {
    if (loadState === 'error' || !currentContest || currentContest.id !== id) {
      return <div className="edit-contest-page-error">Конкурс не найден</div>;
    }
    if (!currentUser || !canManageContest(currentContest, currentUser.id, currentUser)) {
      return <Navigate to={`/contests/${id}`} replace />;
    }
  }

  return (
    <div className="edit-contest-page">
      <div className="edit-contest-page-inner">
        <header className="edit-contest-page-header">
          <Link to={isNewContest ? '/' : `/contests/${id}`} className="edit-contest-page-back">
            <span className="edit-contest-page-back-icon" aria-hidden>
              ‹
            </span>
            {isNewContest ? 'На главную' : 'К конкурсу'}
          </Link>
          <div className="edit-contest-page-heading">
            <p className="edit-contest-page-eyebrow">Настройки</p>
            <h1 className="edit-contest-page-title">
              {isNewContest ? 'Новый конкурс' : 'Редактировать конкурс'}
            </h1>
            <p className="edit-contest-page-lead">
              {isNewContest
                ? 'Заполните настройки и нажмите «Создать черновик». Номинации, жюри и поля заявки станут доступны после первого сохранения.'
                : 'Название, описание, слоган и призы, затем номинации, оформление, голосование, при необходимости — жюри и поля заявки. Сохраняется одной кнопкой вверху страницы.'}
            </p>
          </div>
        </header>

        <div className="edit-contest-page-actions">
          <Button type="button" onClick={() => void handleSaveAll()} disabled={saving || !title.trim()}>
            {saving ? <LoadingSpinner size="small" /> : isNewContest ? 'Создать черновик' : 'Сохранить изменения'}
          </Button>
        </div>

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
            <Textarea
              label="Призы (текст)"
              value={prizeText}
              onChange={(e) => setPrizeText(e.target.value)}
              placeholder="Что выигрывают участники"
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
              <span className="edit-contest-schedule-tz-label">Часовой пояс</span>
              <select
                className="edit-contest-schedule-tz-select"
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

        {isNewContest ? (
          <section className="edit-contest-page-card" aria-labelledby="edit-section-deferred">
            <h2 id="edit-section-deferred" className="edit-contest-page-section-label">
              Номинации, жюри и заявка
            </h2>
            <p className="edit-contest-schedule-intro">
              Пока конкурс ещё не создан на сервере, здесь нельзя загрузить номинации, критерии жюри и поля заявки —
              для этого нужен <code>id</code> черновика. Нажмите «Создать черновик» вверху страницы: после сохранения
              откроется полная форма редактирования (номинации, критерии и состав жюри — вверху и в разделе
              «Настройки голосования»).
            </p>
          </section>
        ) : (
          <section
            className="edit-contest-page-card edit-contest-page-card--organizer"
            aria-label="Номинации"
          >
            <div className="edit-contest-page-organizer">
              <ContestOrganizerCriteriaPanel
                ref={panelRef}
                contest={currentContest!}
                isAdmin
                hideJuryCriteriaSaveButton
                formDisabled={saving}
                showJuryCriteriaSection={juryVoting}
                juryCriteriaPortalMode={juryVoting}
                juryCriteriaPortalHost={juryCriteriaPortalHost}
              />
            </div>
          </section>
        )}

        <section className="edit-contest-page-card" aria-labelledby="edit-section-appearance">
          <h2 id="edit-section-appearance" className="edit-contest-page-section-label">
            Оформление страницы конкурса
          </h2>
          <p className="edit-contest-appearance-intro">
            Баннер, логотипы и цвет акцента. Изображения выбираются только файлом (нужно включённое хранилище на сервере).
            {isNewContest
              ? ' Загрузка файлов будет доступна после создания черновика.'
              : ' Чтобы убрать картинку, нажмите «Убрать» и сохраните страницу.'}
          </p>
          <div className="edit-contest-page-fields edit-contest-appearance-fields">
            <ContestAssetImageField
              legend="Баннер (обложка)"
              url={coverUrl}
              onClear={() => setCoverUrl('')}
              onPickFile={(file) => handleContestAssetFile('cover', file)}
              uploading={assetUploading === 'cover'}
              disabled={saving || isNewContest}
            />
            <ContestAssetImageField
              legend="Логотип конкурса"
              url={logoUrl}
              onClear={() => setLogoUrl('')}
              onPickFile={(file) => handleContestAssetFile('logo', file)}
              uploading={assetUploading === 'logo'}
              disabled={saving || isNewContest}
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
                <span className="edit-contest-theme-picker-label">Палитра</span>
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
              disabled={saving || isNewContest}
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
                  {isNewContest
                    ? 'Критерии и состав жюри появятся после создания черновика (кнопка вверху страницы), затем — в этом разделе и в блоке номинаций ниже.'
                    : 'Включите, чтобы задать критерии оценки и состав жюри (ниже в этом разделе).'}
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

          {juryVoting && isNewContest ? (
            <div className="edit-contest-voting-deferred" role="status" aria-live="polite">
              <p className="edit-contest-voting-deferred-title">Жюри станет доступно после черновика</p>
              <p className="edit-contest-voting-deferred-text">
                Сейчас у конкурса ещё нет идентификатора на сервере — запросы критериев и состава жюри невозможны.
                Нажмите «Создать черновик» вверху: страница откроется в режиме редактирования, и здесь появятся панели
                настройки жюри (и критерии — также в блоке номинаций ниже).
              </p>
            </div>
          ) : null}

          {juryVoting && !isNewContest && currentContest ? (
            <div className="edit-contest-voting-jury" aria-label="Состав жюри">
              <div className="edit-contest-page-organizer">
                <ContestJuryPanel
                  contest={currentContest}
                  isAdmin
                  criteriaSlotRef={handleJuryCriteriaSlotRef}
                />
              </div>
            </div>
          ) : null}
        </section>

        {!isNewContest && currentContest ? (
          <section
            className="edit-contest-page-card edit-contest-page-card--organizer"
            aria-label="Поля заявки участника"
          >
            <div className="edit-contest-page-organizer">
              <ContestRegistrationFieldsPanel
                ref={registrationFieldsRef}
                contest={currentContest}
                isAdmin
                hideSaveButton
                formDisabled={saving}
              />
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
};

export default EditContestPage;
