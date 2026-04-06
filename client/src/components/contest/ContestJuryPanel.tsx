import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { useToast } from '../../contexts/ToastContext';
import { errorHandler } from '../../utils/errorHandler';
import './ContestJuryPanel.css';

const maxJuryHint = (tier: ContestTier | undefined) =>
  tier === 'pro' ? 'На тарифе Pro — до 50 человек.' : 'На бесплатном тарифе — до 2 человек.';

interface ContestJuryPanelProps {
  contest: Contest;
  isAdmin: boolean;
  /** Слот для переноса блока критериев жюри (например, с порталом со страницы редактирования). */
  criteriaSlotRef?: React.RefCallback<HTMLDivElement | null>;
}

export const ContestJuryPanel: React.FC<ContestJuryPanelProps> = ({ contest, isAdmin, criteriaSlotRef }) => {
  const { showError, showSuccess } = useToast();
  const [items, setItems] = useState<JuryMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [nameQuery, setNameQuery] = useState('');
  const [searchHits, setSearchHits] = useState<UserSearchHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getContestJury(contest.id);
      setItems(list);
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
    setSubmitting(true);
    try {
      await removeJuryMember(contest.id, userId);
      setItems((prev) => prev.filter((j) => j.user_id !== userId));
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

  const saveMemberDetails = async (j: JuryMember, portfolio: string, bio: string) => {
    setSubmitting(true);
    try {
      const updated = await patchJuryMember(contest.id, j.user_id, {
        portfolio_url: portfolio,
        bio_short: bio,
      });
      setItems((prev) => prev.map((x) => (x.user_id === j.user_id ? updated : x)));
      showSuccess('Сохранено');
    } catch (e) {
      errorHandler.handleError(e, showError, false);
      showError('Не удалось сохранить');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="contest-jury-panel" aria-labelledby="contest-jury-heading">
      <h3 id="contest-jury-heading">Состав жюри</h3>
      <p className="contest-jury-hint">
        {maxJuryHint(tier)} Состав жюри может менять организатор в любой фазе конкурса.
        {canEdit
          ? ' Для каждого члена можно задать порядок отображения, ссылку на портфолио и краткое описание.'
          : null}
      </p>
      {criteriaSlotRef ? <div className="contest-jury-criteria-slot" ref={criteriaSlotRef} /> : null}
      {loading ? (
        <p className="contest-jury-muted">Загрузка…</p>
      ) : items.length === 0 ? (
        <p className="contest-jury-muted">Состав жюри пока не назначен.</p>
      ) : (
        <ul className="contest-jury-list">
          {items.map((j, idx) => (
            <li key={j.id} className="contest-jury-item">
              <div className="contest-jury-item-head">
                <span className="contest-jury-name">{j.user_name || `Пользователь ${j.user_id}`}</span>
                <span className="contest-jury-id">id: {j.user_id}</span>
                {canEdit && (
                  <div className="contest-jury-order-actions">
                    <button
                      type="button"
                      className="contest-jury-order-btn"
                      disabled={submitting || idx === 0}
                      onClick={() => moveMember(idx, -1)}
                      aria-label="Выше в списке"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="contest-jury-order-btn"
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
                  disabled={submitting}
                  onSave={(portfolio, bio) => saveMemberDetails(j, portfolio, bio)}
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
    </section>
  );
};

const JuryMemberEditFields: React.FC<{
  member: JuryMember;
  disabled: boolean;
  onSave: (portfolio: string, bio: string) => void | Promise<void>;
}> = ({ member, disabled, onSave }) => {
  const [portfolio, setPortfolio] = useState(member.portfolio_url ?? '');
  const [bio, setBio] = useState(member.bio_short ?? '');

  useEffect(() => {
    setPortfolio(member.portfolio_url ?? '');
    setBio(member.bio_short ?? '');
  }, [member.user_id, member.portfolio_url, member.bio_short]);

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
          onChange={(e) => setPortfolio(e.target.value)}
          placeholder="https://…"
          disabled={disabled}
          autoComplete="off"
        />
      </div>
      <div className="contest-jury-field">
        <label className="contest-jury-field-label" htmlFor={`jury-bio-${member.user_id}`}>
          Краткое описание
        </label>
        <textarea
          id={`jury-bio-${member.user_id}`}
          className="contest-jury-field-textarea"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          placeholder="Например, экспертиза по породам, опыт в выставках…"
          disabled={disabled}
        />
      </div>
      <div className="contest-jury-field-actions">
        <Button
          type="button"
          variant="secondary"
          size="small"
          disabled={disabled}
          onClick={() => void onSave(portfolio.trim(), bio.trim())}
        >
          Сохранить
        </Button>
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
      {bio ? <p className="contest-jury-public-bio">{bio}</p> : null}
      {url ? (
        <a
          className="contest-jury-public-link"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Портфолио / профиль
        </a>
      ) : null}
    </div>
  );
};
