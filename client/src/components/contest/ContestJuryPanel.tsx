import React, { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { Contest, ContestTier, JuryMember, UserSearchHit } from '../../types/models';
import {
  getContestJury,
  addJuryMember,
  removeJuryMember,
  patchJuryMember,
  reorderJuryMembers,
} from '../../api/juryApi';
import { searchUsers } from '../../api/usersApi';
import { Button } from '../common/Button';
import { MessengerUserAvatar } from '../common/MessengerUserPresentation';
import '../common/ReorderIconButtons.css';
import { useToast } from '../../contexts/ToastContext';
import { errorHandler } from '../../utils/errorHandler';
import './ContestJuryPanel.css';

const maxJuryHint = (tier: ContestTier | undefined) =>
  tier === 'pro' ? 'На тарифе Pro — до 50 человек.' : 'На бесплатном тарифе — до 2 человек.';

export type ContestJuryPanelHandle = {
  /** Отправить на сервер несохранённые правки портфолио и описания членов жюри (общее сохранение страницы). */
  flushPendingJuryMemberEdits: (opts?: { quietSuccess?: boolean }) => Promise<boolean>;
};

interface ContestJuryPanelProps {
  contest: Contest;
  isAdmin: boolean;
  /** Слот для переноса блока критериев жюри (например, с порталом со страницы редактирования). */
  criteriaSlotRef?: React.RefCallback<HTMLDivElement | null>;
  /**
   * Перед запросами к API жюри: включить голосование жюри на сервере, если включён только локальный чекбокс
   * (страница ещё не сохранена). Редактирование конкурса: передаётся с EditContestPage.
   */
  ensureJuryVotingEnabledOnServer?: () => Promise<boolean>;
}

export const ContestJuryPanel = forwardRef<ContestJuryPanelHandle, ContestJuryPanelProps>(
  function ContestJuryPanel({ contest, isAdmin, criteriaSlotRef, ensureJuryVotingEnabledOnServer }, ref) {
    const { showError, showSuccess } = useToast();
    const [items, setItems] = useState<JuryMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [nameQuery, setNameQuery] = useState('');
    const [searchHits, setSearchHits] = useState<UserSearchHit[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    /** Локальные правки полей; на сервер — через flushPendingJuryMemberEdits. */
    const [memberFieldEdits, setMemberFieldEdits] = useState<
      Record<number, { portfolio: string; bio: string; isChair: boolean }>
    >({});
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const searchWrapRef = useRef<HTMLDivElement | null>(null);

    const load = useCallback(async () => {
      setLoading(true);
      try {
        const list = await getContestJury(contest.id);
        setItems(list);
        setMemberFieldEdits({});
      } catch (e) {
        errorHandler.handleError(e, showError, false);
        showError('Не удалось загрузить состав жюри');
      } finally {
        setLoading(false);
      }
    }, [contest.id, showError]);

    useEffect(() => {
      load();
    }, [load]);

    const canEdit = isAdmin;
    const tier = contest.tier || 'free';

    const juryUserIds = new Set(items.map((j) => j.user_id));

    useEffect(() => {
      if (!canEdit) {
        return;
      }
      const q = nameQuery.trim();
      if (q.length < 2) {
        setSearchHits([]);
        setPickerOpen(false);
        return;
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(async () => {
        setSearchLoading(true);
        try {
          const list = await searchUsers(q, 20);
          setSearchHits(list);
          setPickerOpen(true);
        } catch (e) {
          errorHandler.handleError(e, showError, false);
          setSearchHits([]);
        } finally {
          setSearchLoading(false);
        }
      }, 350);
      return () => {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
      };
    }, [nameQuery, canEdit, showError]);

    useEffect(() => {
      const onDoc = (e: MouseEvent) => {
        if (!pickerOpen || !searchWrapRef.current) return;
        if (!searchWrapRef.current.contains(e.target as Node)) {
          setPickerOpen(false);
        }
      };
      document.addEventListener('mousedown', onDoc);
      return () => document.removeEventListener('mousedown', onDoc);
    }, [pickerOpen]);

    const handlePickSearchHit = async (hit: UserSearchHit) => {
      if (juryUserIds.has(hit.id)) {
        showError('Этот пользователь уже в жюри');
        setPickerOpen(false);
        return;
      }
      if (ensureJuryVotingEnabledOnServer) {
        const synced = await ensureJuryVotingEnabledOnServer();
        if (!synced) return;
      }
      setSubmitting(true);
      try {
        const m = await addJuryMember(contest.id, hit.id);
        setItems((prev) => [...prev, m]);
        setNameQuery('');
        setSearchHits([]);
        setPickerOpen(false);
        showSuccess('Член жюри добавлен');
      } catch (e) {
        errorHandler.handleError(e, showError, false);
        showError('Не удалось добавить (проверьте лимит тарифа)');
      } finally {
        setSubmitting(false);
      }
    };

    const handleRemove = async (userId: number) => {
      if (ensureJuryVotingEnabledOnServer) {
        const synced = await ensureJuryVotingEnabledOnServer();
        if (!synced) return;
      }
      setSubmitting(true);
      try {
        await removeJuryMember(contest.id, userId);
        setItems((prev) => prev.filter((j) => j.user_id !== userId));
        setMemberFieldEdits((prev) => {
          const next = { ...prev };
          delete next[userId];
          return next;
        });
        showSuccess('Удалено из жюри');
      } catch (e) {
        errorHandler.handleError(e, showError, false);
        showError('Не удалось удалить');
      } finally {
        setSubmitting(false);
      }
    };

    const moveMember = async (index: number, delta: -1 | 1) => {
      const j = index + delta;
      if (j < 0 || j >= items.length) return;
      if (ensureJuryVotingEnabledOnServer) {
        const synced = await ensureJuryVotingEnabledOnServer();
        if (!synced) return;
      }
      const next = [...items];
      [next[index], next[j]] = [next[j], next[index]];
      setSubmitting(true);
      try {
        await reorderJuryMembers(
          contest.id,
          next.map((x) => x.user_id)
        );
        setItems(next);
        showSuccess('Порядок обновлён');
      } catch (e) {
        errorHandler.handleError(e, showError, false);
        showError('Не удалось изменить порядок');
        void load();
      } finally {
        setSubmitting(false);
      }
    };

    const getPortfolio = (m: JuryMember) => memberFieldEdits[m.user_id]?.portfolio ?? m.portfolio_url ?? '';
    const getBio = (m: JuryMember) => memberFieldEdits[m.user_id]?.bio ?? m.bio_short ?? '';
    const getIsChair = (m: JuryMember) => memberFieldEdits[m.user_id]?.isChair ?? Boolean(m.is_chair);

    const setPortfolio = (m: JuryMember, v: string) => {
      setMemberFieldEdits((prev) => ({
        ...prev,
        [m.user_id]: {
          portfolio: v,
          bio: prev[m.user_id]?.bio ?? (m.bio_short ?? ''),
          isChair: prev[m.user_id]?.isChair ?? Boolean(m.is_chair),
        },
      }));
    };

    const setBio = (m: JuryMember, v: string) => {
      setMemberFieldEdits((prev) => ({
        ...prev,
        [m.user_id]: {
          portfolio: prev[m.user_id]?.portfolio ?? (m.portfolio_url ?? ''),
          bio: v,
          isChair: prev[m.user_id]?.isChair ?? Boolean(m.is_chair),
        },
      }));
    };

    const setIsChair = (m: JuryMember, v: boolean) => {
      setMemberFieldEdits((prev) => {
        const next: Record<number, { portfolio: string; bio: string; isChair: boolean }> = {
          ...prev,
          [m.user_id]: {
            portfolio: prev[m.user_id]?.portfolio ?? (m.portfolio_url ?? ''),
            bio: prev[m.user_id]?.bio ?? (m.bio_short ?? ''),
            isChair: v,
          },
        };
        if (v) {
          for (const key of Object.keys(next)) {
            const uid = Number(key);
            if (uid !== m.user_id) {
              next[uid] = { ...next[uid], isChair: false };
            }
          }
        }
        return next;
      });
    };

    const flushPendingJuryMemberEdits = useCallback(
      async (_opts?: { quietSuccess?: boolean }): Promise<boolean> => {
        if (!canEdit) {
          return true;
        }
        const pending = items.filter((m) => {
          const e = memberFieldEdits[m.user_id];
          if (!e) {
            return false;
          }
          return (
            e.portfolio !== (m.portfolio_url ?? '') || e.bio !== (m.bio_short ?? '')
            || e.isChair !== Boolean(m.is_chair)
          );
        });
        if (pending.length === 0) {
          return true;
        }
        if (ensureJuryVotingEnabledOnServer) {
          const synced = await ensureJuryVotingEnabledOnServer();
          if (!synced) return false;
        }
        setSubmitting(true);
        try {
          for (const m of pending) {
            const e = memberFieldEdits[m.user_id]!;
            const updated = await patchJuryMember(contest.id, m.user_id, {
              portfolio_url: e.portfolio,
              bio_short: e.bio,
              is_chair: e.isChair,
            });
            setItems((prev) => prev.map((x) => (x.user_id === m.user_id ? updated : x)));
          }
          setMemberFieldEdits({});
          return true;
        } catch (e) {
          errorHandler.handleError(e, showError, false);
          showError('Не удалось сохранить данные членов жюри');
          return false;
        } finally {
          setSubmitting(false);
        }
      },
      [canEdit, contest.id, items, memberFieldEdits, showError, ensureJuryVotingEnabledOnServer]
    );

    useImperativeHandle(
      ref,
      () => ({
        flushPendingJuryMemberEdits,
      }),
      [flushPendingJuryMemberEdits]
    );

    return (
      <section
        className={`contest-jury-panel${canEdit ? '' : ' contest-jury-panel--public'}`}
        aria-label="Жюри конкурса"
      >
        {criteriaSlotRef ? (
          <div className="contest-jury-panel-criteria-region">
            <div className="contest-jury-criteria-slot" ref={criteriaSlotRef} />
          </div>
        ) : null}

        <div className="contest-jury-panel-members-region">
          <h2
            id="contest-jury-heading"
            className={`contest-jury-panel-members-title${canEdit ? '' : ' contest-section-heading'}`}
          >
            Состав жюри
          </h2>
          {canEdit ? (
            <p className="contest-jury-hint">
              {maxJuryHint(tier)} Состав жюри может менять организатор в любой фазе конкурса. Добавление и удаление
              членов жюри и порядок в списке применяются сразу. Портфолио и краткое описание — вместе со страницей
              конкурса (кнопка «Сохранить изменения»).
            </p>
          ) : null}
          {loading ? (
            <p className="contest-jury-muted">Загрузка…</p>
          ) : items.length === 0 ? (
            <p className="contest-jury-muted">Состав жюри пока не назначен.</p>
          ) : (
            <ul className="contest-jury-list">
              {items.map((j, idx) => (
                <li key={j.id} className="contest-jury-item">
                  <div className="contest-jury-item-head">
                    <div className="contest-jury-item-lead">
                      <MessengerUserAvatar
                        userId={j.user_id}
                        userName={j.user_name || `Пользователь ${j.user_id}`}
                        userAvatarUrl={j.user_avatar_url}
                        size="md"
                        className="contest-jury-avatar"
                      />
                      <span className="contest-jury-name">{j.user_name || `Пользователь ${j.user_id}`}</span>
                      {canEdit ? <span className="contest-jury-id">id: {j.user_id}</span> : null}
                    </div>
                    {canEdit && (
                      <div className="reorder-icon-actions reorder-icon-actions--end">
                        <button
                          type="button"
                          className="reorder-icon-btn"
                          disabled={submitting || idx === 0}
                          onClick={() => moveMember(idx, -1)}
                          aria-label="Выше в списке"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="reorder-icon-btn"
                          disabled={submitting || idx === items.length - 1}
                          onClick={() => moveMember(idx, 1)}
                          aria-label="Ниже в списке"
                        >
                          ↓
                        </button>
                        <Button
                          type="button"
                          variant="danger"
                          size="small"
                          disabled={submitting}
                          onClick={() => handleRemove(j.user_id)}
                        >
                          Убрать
                        </Button>
                      </div>
                    )}
                  </div>
                  {canEdit ? (
                    <JuryMemberEditFields
                      member={j}
                      portfolio={getPortfolio(j)}
                      bio={getBio(j)}
                      isChair={getIsChair(j)}
                      disabled={submitting}
                      onPortfolioChange={(v) => setPortfolio(j, v)}
                      onBioChange={(v) => setBio(j, v)}
                      onIsChairChange={(v) => setIsChair(j, v)}
                    />
                  ) : (
                    <JuryMemberPublicView member={j} />
                  )}
                </li>
              ))}
            </ul>
          )}
          {canEdit && (
            <div className="contest-jury-add contest-jury-section">
              <label htmlFor="jury-search-name" className="contest-jury-label">
                Добавить в жюри — поиск по email или имени
              </label>
              <p className="contest-jury-search-explainer">
                Введите часть почты или имени (от 2 символов). В списке — имя, email и id.
              </p>
              <div className="contest-jury-search-wrap" ref={searchWrapRef}>
                <input
                  id="jury-search-name"
                  type="text"
                  className="contest-jury-input contest-jury-input-wide"
                  value={nameQuery}
                  onChange={(e) => setNameQuery(e.target.value)}
                  onFocus={() => setPickerOpen(nameQuery.trim().length >= 2 && searchHits.length > 0)}
                  placeholder="Email или имя (от 2 символов)"
                  disabled={submitting}
                  autoComplete="off"
                />
                {searchLoading && <span className="contest-jury-search-status">…</span>}
                {pickerOpen && searchHits.length > 0 && (
                  <ul className="contest-jury-search-dropdown">
                    {searchHits.map((h) => (
                      <li key={h.id}>
                        <button
                          type="button"
                          className="contest-jury-search-option"
                          onClick={() => handlePickSearchHit(h)}
                        >
                          <span className="contest-jury-search-option-main">
                            <span className="contest-jury-search-option-name">{h.name}</span>
                            {h.email ? (
                              <span className="contest-jury-search-option-email">{h.email}</span>
                            ) : (
                              <span className="contest-jury-search-option-email contest-jury-search-option-email-missing">
                                почта не указана
                              </span>
                            )}
                          </span>
                          <span className="contest-jury-search-option-id">id {h.id}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }
);

const JuryMemberEditFields: React.FC<{
  member: JuryMember;
  portfolio: string;
  bio: string;
  isChair: boolean;
  disabled: boolean;
  onPortfolioChange: (v: string) => void;
  onBioChange: (v: string) => void;
  onIsChairChange: (v: boolean) => void;
}> = ({ member, portfolio, bio, isChair, disabled, onPortfolioChange, onBioChange, onIsChairChange }) => {
  return (
    <div className="contest-jury-edit-fields">
      <div className="contest-jury-field">
        <label className="contest-jury-field-label" htmlFor={`jury-portfolio-${member.user_id}`}>
          Ссылка на портфолио или профиль
        </label>
        <input
          id={`jury-portfolio-${member.user_id}`}
          type="url"
          className="contest-jury-field-input url-input"
          value={portfolio}
          onChange={(e) => onPortfolioChange(e.target.value)}
          placeholder="https://…"
          disabled={disabled}
          autoComplete="off"
        />
      </div>
      <div className="contest-jury-field">
        <label className="contest-jury-field-label contest-jury-field-label--checkbox">
          <input
            type="checkbox"
            checked={isChair}
            onChange={(e) => onIsChairChange(e.target.checked)}
            disabled={disabled}
          />
          <span>Председатель жюри</span>
        </label>
      </div>
      <div className="contest-jury-field">
        <label className="contest-jury-field-label" htmlFor={`jury-bio-${member.user_id}`}>
          Краткое описание
        </label>
        <textarea
          id={`jury-bio-${member.user_id}`}
          className="contest-jury-field-textarea"
          value={bio}
          onChange={(e) => onBioChange(e.target.value)}
          rows={3}
          placeholder="Например, экспертиза по породам, опыт в выставках…"
          disabled={disabled}
        />
      </div>
    </div>
  );
};

const JuryMemberPublicView: React.FC<{ member: JuryMember }> = ({ member }) => {
  const url = (member.portfolio_url ?? '').trim();
  const bio = (member.bio_short ?? '').trim();
  if (!url && !bio) {
    return null;
  }
  return (
    <div className="contest-jury-public">
      {bio ? (
        <div className="contest-jury-public-section">
          <p className="contest-jury-public-bio">{bio}</p>
        </div>
      ) : null}
      {url ? (
        <div className="contest-jury-public-section">
          <a
            className="contest-jury-public-link"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Открыть партфолио
          </a>
        </div>
      ) : null}
    </div>
  );
};
