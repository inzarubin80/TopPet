import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Contest, ContestTier, JuryMember, UserSearchHit } from '../../types/models';
import { getContestJury, addJuryMember, removeJuryMember } from '../../api/juryApi';
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
}

export const ContestJuryPanel: React.FC<ContestJuryPanelProps> = ({ contest, isAdmin }) => {
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

  const canEdit = isAdmin && contest.status === 'draft';
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

  return (
    <section className="contest-jury-panel" aria-labelledby="contest-jury-heading">
      <h2 id="contest-jury-heading">Жюри</h2>
      <p className="contest-jury-hint">
        {maxJuryHint(tier)} Редактирование только в статусе «Черновик».
      </p>
      {loading ? (
        <p className="contest-jury-muted">Загрузка…</p>
      ) : items.length === 0 ? (
        <p className="contest-jury-muted">Состав жюри пока не назначен.</p>
      ) : (
        <ul className="contest-jury-list">
          {items.map((j) => (
            <li key={j.id} className="contest-jury-item">
              <span className="contest-jury-name">{j.user_name || `Пользователь ${j.user_id}`}</span>
              <span className="contest-jury-id">id: {j.user_id}</span>
              {canEdit && (
                <Button
                  type="button"
                  variant="danger"
                  size="small"
                  disabled={submitting}
                  onClick={() => handleRemove(j.user_id)}
                >
                  Убрать
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="contest-jury-add contest-jury-section">
          <label htmlFor="jury-search-name" className="contest-jury-label">
            Добавить в жюри — поиск по имени
          </label>
          <p className="contest-jury-search-explainer">
            В списке показываются имя, email (если есть в профиле) и id.
          </p>
          <div className="contest-jury-search-wrap" ref={searchWrapRef}>
            <input
              id="jury-search-name"
              type="text"
              className="contest-jury-input contest-jury-input-wide"
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              onFocus={() => setPickerOpen(nameQuery.trim().length >= 2 && searchHits.length > 0)}
              placeholder="Минимум 2 символа имени"
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
