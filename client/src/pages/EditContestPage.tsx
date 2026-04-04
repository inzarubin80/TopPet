import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Navigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { fetchContest, updateContest } from '../store/slices/contestsSlice';
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
import { userCanManageContest as canManageContest } from '../utils/contestPermissions';
import { uploadContestAsset, type ContestAssetKind } from '../api/contestsApi';
import { getErrorMessage } from '../utils/errorHandler';
import { AxiosError } from 'axios';
import type { UpdateContestRequest } from '../types/api';
import './EditContestPage.css';

/** ISO из API → значение для input datetime-local (локальное время браузера). */
function contestIsoToDatetimeLocal(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocalToIso(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

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
  const [rulesUrl, setRulesUrl] = useState('');
  const [prizeText, setPrizeText] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [themeColor, setThemeColor] = useState('');
  const [sponsorName, setSponsorName] = useState('');
  const [sponsorLogoUrl, setSponsorLogoUrl] = useState('');
  const [sponsorUrl, setSponsorUrl] = useState('');
  const [ctaLabelOverride, setCtaLabelOverride] = useState('');
  const [registrationStartsLocal, setRegistrationStartsLocal] = useState('');
  const [registrationEndsLocal, setRegistrationEndsLocal] = useState('');
  const [votingStartsLocal, setVotingStartsLocal] = useState('');
  const [votingEndsLocal, setVotingEndsLocal] = useState('');
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
        setRulesUrl(contest.rules_url ?? '');
        setPrizeText(contest.prize_text ?? '');
        setLogoUrl(contest.logo_url ?? '');
        setThemeColor(contest.theme_color ?? '');
        setSponsorName(contest.sponsor_name ?? '');
        setSponsorLogoUrl(contest.sponsor_logo_url ?? '');
        setSponsorUrl(contest.sponsor_url ?? '');
        setCtaLabelOverride(contest.cta_label_override ?? '');
        setRegistrationStartsLocal(contestIsoToDatetimeLocal(contest.registration_starts_at));
        setRegistrationEndsLocal(contestIsoToDatetimeLocal(contest.registration_ends_at));
        setVotingStartsLocal(contestIsoToDatetimeLocal(contest.voting_starts_at));
        setVotingEndsLocal(contestIsoToDatetimeLocal(contest.voting_ends_at));
        setLoadState('ready');
      })
      .catch(() => setLoadState('error'));
  }, [dispatch, id]);

  useEffect(() => {
    if (loadState !== 'ready' || !id || currentContest?.id !== id) {
      return;
    }
    setTitle(currentContest.title);
    setDescription(currentContest.description || '');
    setPublicVoting(currentContest.public_voting_enabled ?? true);
    setJuryVoting(currentContest.jury_voting_enabled ?? false);
    setCoverUrl(currentContest.cover_url ?? '');
    setTagline(currentContest.tagline ?? '');
    setRulesUrl(currentContest.rules_url ?? '');
    setPrizeText(currentContest.prize_text ?? '');
    setLogoUrl(currentContest.logo_url ?? '');
    setThemeColor(currentContest.theme_color ?? '');
    setSponsorName(currentContest.sponsor_name ?? '');
    setSponsorLogoUrl(currentContest.sponsor_logo_url ?? '');
    setSponsorUrl(currentContest.sponsor_url ?? '');
    setCtaLabelOverride(currentContest.cta_label_override ?? '');
    setRegistrationStartsLocal(contestIsoToDatetimeLocal(currentContest.registration_starts_at));
    setRegistrationEndsLocal(contestIsoToDatetimeLocal(currentContest.registration_ends_at));
    setVotingStartsLocal(contestIsoToDatetimeLocal(currentContest.voting_starts_at));
    setVotingEndsLocal(contestIsoToDatetimeLocal(currentContest.voting_ends_at));
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
        const iso = datetimeLocalToIso(t);
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
        rules_url: rulesUrl.trim(),
        prize_text: prizeText.trim(),
        logo_url: logoUrl.trim(),
        theme_color: themeColor.trim(),
        sponsor_name: sponsorName.trim(),
        sponsor_logo_url: sponsorLogoUrl.trim(),
        sponsor_url: sponsorUrl.trim(),
        cta_label_override: ctaLabelOverride.trim(),
        registration_starts_at: scheduleField(registrationStartsLocal),
        registration_ends_at: scheduleField(registrationEndsLocal),
        voting_starts_at: scheduleField(votingStartsLocal),
        voting_ends_at: scheduleField(votingEndsLocal),
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

  const handleContestAssetFile = async (kind: ContestAssetKind, file: File) => {
    if (!id) return;
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
          ? 'Загрузка файлов недоступна (нет маршрута или конкурс не найден). Укажите ссылку на изображение ниже.'
          : base;
      setError(message);
    } finally {
      setAssetUploading(null);
    }
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
              Название, описание, слоган и призы, затем номинации, оформление, голосование, при необходимости — жюри и
              поля заявки. Сохраняется одной кнопкой внизу страницы.
            </p>
          </div>
        </header>

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

        <section className="edit-contest-page-card" aria-labelledby="edit-section-schedule">
          <h2 id="edit-section-schedule" className="edit-contest-page-section-label">
            Расписание фаз
          </h2>
          <p className="edit-contest-schedule-intro">
            Даты в локальном времени браузера; на сервере хранятся в UTC. Пустое поле сбрасывает дату. Фоновый процесс
            на сервере (интервал <code>CONTEST_SCHEDULER_INTERVAL_SEC</code>, по умолчанию 60 с) переводит статус:
            черновик → регистрация → голосование → завершён, когда наступает соответствующий момент. Ручное открытие
            регистрации по-прежнему доступно.
          </p>
          <div className="edit-contest-page-fields">
            <Input
              label="Начало регистрации"
              type="datetime-local"
              value={registrationStartsLocal}
              onChange={(e) => setRegistrationStartsLocal(e.target.value)}
              disabled={saving}
            />
            <Input
              label="Окончание регистрации"
              type="datetime-local"
              value={registrationEndsLocal}
              onChange={(e) => setRegistrationEndsLocal(e.target.value)}
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
            Баннер, логотипы и цвет акцента. В черновике можно загрузить файлы (если на сервере включено хранилище) или
            указать прямую ссылку на изображение.
          </p>
          <div className="edit-contest-page-fields edit-contest-appearance-fields">
            <ContestAssetImageField
              legend="Баннер (обложка)"
              url={coverUrl}
              onUrlChange={setCoverUrl}
              onPickFile={(file) => handleContestAssetFile('cover', file)}
              uploading={assetUploading === 'cover'}
              disabled={saving}
            />
            <ContestAssetImageField
              legend="Логотип конкурса"
              url={logoUrl}
              onUrlChange={setLogoUrl}
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
                placeholder="#c2410c или пусто"
                disabled={saving}
              />
              <label className="edit-contest-theme-picker-wrap">
                <span className="edit-contest-theme-picker-label">Палитра</span>
                <input
                  type="color"
                  className="edit-contest-theme-picker"
                  value={/^#[0-9A-Fa-f]{6}$/.test(themeColor.trim()) ? themeColor.trim() : '#c2410c'}
                  onChange={(e) => setThemeColor(e.target.value)}
                  disabled={saving}
                  aria-label="Выбор цвета акцента"
                />
              </label>
            </div>
            <Input
              label="Ссылка на полные правила"
              type="url"
              value={rulesUrl}
              onChange={(e) => setRulesUrl(e.target.value)}
              placeholder="https://…"
              disabled={saving}
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
              onUrlChange={setSponsorLogoUrl}
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
                  Включите, чтобы задать критерии оценки и состав жюри (доступно в черновике ниже на этой странице).
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
        </section>

        {juryVoting && (
          <section
            className="edit-contest-page-card edit-contest-page-card--organizer"
            aria-label="Жюри: критерии оценки и состав"
          >
            <div className="edit-contest-page-organizer">
              <ContestJuryPanel
                contest={currentContest}
                isAdmin
                criteriaSlotRef={handleJuryCriteriaSlotRef}
              />
            </div>
          </section>
        )}

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

        <footer className="edit-contest-page-footer">
          <Button type="button" onClick={() => void handleSaveAll()} disabled={saving || !title.trim()}>
            {saving ? <LoadingSpinner size="small" /> : 'Сохранить изменения'}
          </Button>
        </footer>
      </div>
    </div>
  );
};

export default EditContestPage;
