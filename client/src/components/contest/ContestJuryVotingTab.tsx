import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../common/Button';
import { JuryParticipantWorkCell } from './JuryParticipantWorkCell';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { listJuryCriteria } from '../../api/juryCriteriaApi';
import { getMyJuryScores, putMyJuryScores } from '../../api/juryScoresApi';
import {
  getParticipantsByContest,
  type ParticipantsListNominationFilter,
} from '../../api/participantsApi';
import type { ContestID, ContestStatus, JuryCriterion, Nomination, Participant, ParticipantID } from '../../types/models';
import { getParticipantDisplayTitle } from '../../utils/seo';
import { formatJuryTotalScore } from '../../utils/juryLabels';
import { useToast } from '../../contexts/ToastContext';
import { getApiErrorMessage } from '../../types/api';
import './ContestJuryVotingTab.css';

const DEBOUNCE_MS = 500;
const RETRY_DELAYS_MS = [1000, 2000, 4000];
const MAX_AUTO_RETRIES = 3;
const ONLINE_FLUSH_CONCURRENCY = 3;

/** Сортировка таблицы: взвешенный итог или id критерия (сырой балл по критерию). */
type JuryVotingSortColumn = 'total' | string;

type SyncStatus = 'synced' | 'pending' | 'saving' | 'error';

type Props = {
  contestId: ContestID;
  contestStatus: ContestStatus;
  /** Член жюри может выставлять баллы */
  isJuror: boolean;
  /** Подписи номинаций для строки автора */
  nominationTitleById: Record<string, string>;
  /** Номинации конкурса — при более чем одной номинации показывается отбор */
  nominations: Nomination[];
};

/** Середина шкалы, привязанная к шагу; при ровно «половине между двумя баллами» — нижний (1–10 → 5, не 6). */
function defaultScore(c: JuryCriterion): number {
  const min = c.scale_min;
  const max = c.scale_max;
  const step = c.scale_step || 1;
  if (min >= max) return min;
  const mid = (min + max) / 2;
  const stepsFromMin = (mid - min) / step;
  const k = Math.floor(stepsFromMin + Number.EPSILON);
  const v = min + k * step;
  return Math.min(max, Math.max(min, v));
}

function rowSnapshot(
  row: Record<string, number> | undefined,
  crit: JuryCriterion[]
): string {
  return JSON.stringify(crit.map((c) => ({ id: c.id, v: row?.[c.id] })));
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return out;
}

async function runPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
}

export const ContestJuryVotingTab: React.FC<Props> = ({
  contestId,
  contestStatus,
  isJuror,
  nominationTitleById,
  nominations,
}) => {
  const { showError } = useToast();
  const [nominationFilter, setNominationFilter] = useState<ParticipantsListNominationFilter>('all');
  /** Только заявки с отметкой «Мне нравится» у текущего пользователя. */
  const [likesOnly, setLikesOnly] = useState(false);

  useEffect(() => {
    if (nominations.length <= 1 && nominationFilter === 'none') {
      setNominationFilter('all');
    }
  }, [nominations.length, nominationFilter]);
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [criteria, setCriteria] = useState<JuryCriterion[]>([]);
  /** scores[participantId][criterionId] */
  const [scores, setScores] = useState<Record<string, Record<string, number>>>({});
  const [syncByParticipant, setSyncByParticipant] = useState<Record<string, SyncStatus>>({});
  const [sort, setSort] = useState<{ column: JuryVotingSortColumn; desc: boolean }>({
    column: 'total',
    desc: true,
  });
  const [isOnline, setIsOnline] = useState(
    () => (typeof navigator !== 'undefined' ? navigator.onLine : true)
  );

  const scoresRef = useRef(scores);
  const criteriaRef = useRef(criteria);
  const canEditRef = useRef(false);
  const contestIdRef = useRef(contestId);
  /** В браузере setTimeout возвращает number (не NodeJS.Timeout). */
  const debounceTimersRef = useRef<Map<string, number>>(new Map());
  const retryTimersRef = useRef<Map<string, number>>(new Map());
  const retryCountRef = useRef<Map<string, number>>(new Map());
  const scheduleDebounceRef = useRef<(participantId: string) => void>(() => {});

  scoresRef.current = scores;
  criteriaRef.current = criteria;
  contestIdRef.current = contestId;

  const readOnly =
    contestStatus === 'finished' || contestStatus === 'draft' || contestStatus === 'publication';
  const canEdit = !readOnly && (contestStatus === 'registration' || contestStatus === 'voting') && isJuror;
  canEditRef.current = canEdit;

  const weightedTotal = useCallback((participantId: ParticipantID): number => {
    const row = scores[participantId];
    if (!row || criteria.length === 0) return 0;
    let t = 0;
    for (const c of criteria) {
      const w = c.weight ?? 1;
      const v = row[c.id];
      if (v === undefined) continue;
      t += v * w;
    }
    return t;
  }, [scores, criteria]);

  const weightedMaxOneJuror = useMemo(() => {
    return criteria.reduce((s, c) => s + c.scale_max * (c.weight ?? 1), 0);
  }, [criteria]);

  const criterionById = useMemo(() => new Map(criteria.map((c) => [c.id, c])), [criteria]);

  const onSortColumn = useCallback((col: JuryVotingSortColumn) => {
    setSort((s) => {
      if (s.column === col) {
        return { column: col, desc: !s.desc };
      }
      return { column: col, desc: true };
    });
  }, []);

  const clearParticipantTimers = useCallback((participantId: string) => {
    const d = debounceTimersRef.current.get(participantId);
    if (d) {
      clearTimeout(d);
      debounceTimersRef.current.delete(participantId);
    }
    const r = retryTimersRef.current.get(participantId);
    if (r) {
      clearTimeout(r);
      retryTimersRef.current.delete(participantId);
    }
  }, []);

  const flushParticipant = useCallback(
    async (participantId: string): Promise<void> => {
      if (!canEditRef.current) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setSyncByParticipant((prev) => ({ ...prev, [participantId]: 'pending' }));
        return;
      }

      const crit = criteriaRef.current;
      const row = scoresRef.current[participantId];
      if (!row || crit.length === 0) return;

      const items = crit
        .map((c) => {
          const score = row[c.id];
          if (score === undefined) return null;
          return { criterion_id: c.id, score };
        })
        .filter((x): x is { criterion_id: string; score: number } => x !== null);
      if (items.length === 0) {
        setSyncByParticipant((prev) => ({ ...prev, [participantId]: 'synced' }));
        return;
      }

      const sentSnapshot = rowSnapshot(row, crit);

      setSyncByParticipant((prev) => ({ ...prev, [participantId]: 'saving' }));

      try {
        await putMyJuryScores(contestIdRef.current, participantId, items);
        retryCountRef.current.delete(participantId);

        const currentRow = scoresRef.current[participantId];
        const currentSnapshot = rowSnapshot(currentRow, crit);
        if (currentSnapshot !== sentSnapshot) {
          scheduleDebounceRef.current(participantId);
        } else {
          setSyncByParticipant((prev) => ({ ...prev, [participantId]: 'synced' }));
        }
      } catch (e: unknown) {
        const n = (retryCountRef.current.get(participantId) ?? 0) + 1;
        retryCountRef.current.set(participantId, n);

        if (n <= MAX_AUTO_RETRIES && typeof navigator !== 'undefined' && navigator.onLine) {
          const delay = RETRY_DELAYS_MS[Math.min(n - 1, RETRY_DELAYS_MS.length - 1)];
          setSyncByParticipant((prev) => ({ ...prev, [participantId]: 'pending' }));
          const rt = window.setTimeout(() => {
            retryTimersRef.current.delete(participantId);
            void flushParticipant(participantId);
          }, delay);
          retryTimersRef.current.set(participantId, rt);
        } else {
          retryCountRef.current.delete(participantId);
          setSyncByParticipant((prev) => ({ ...prev, [participantId]: 'error' }));
          showError(getApiErrorMessage(e));
        }
      }
    },
    [showError]
  );

  const scheduleDebounce = useCallback(
    (participantId: string) => {
      clearParticipantTimers(participantId);
      setSyncByParticipant((prev) => ({ ...prev, [participantId]: 'pending' }));

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return;
      }

      const tid = window.setTimeout(() => {
        debounceTimersRef.current.delete(participantId);
        void flushParticipant(participantId);
      }, DEBOUNCE_MS);
      debounceTimersRef.current.set(participantId, tid);
    },
    [clearParticipantTimers, flushParticipant]
  );

  scheduleDebounceRef.current = scheduleDebounce;

  const participantsRef = useRef(participants);
  participantsRef.current = participants;
  const syncRef = useRef(syncByParticipant);
  syncRef.current = syncByParticipant;
  const flushParticipantRef = useRef(flushParticipant);
  flushParticipantRef.current = flushParticipant;
  const clearTimersRef = useRef(clearParticipantTimers);
  clearTimersRef.current = clearParticipantTimers;

  const load = useCallback(async () => {
    if (!isJuror) {
      setLoading(false);
      setParticipants([]);
      setCriteria([]);
      setScores({});
      setSyncByParticipant({});
      return;
    }
    setLoading(true);
    try {
      const [critRes, partRes] = await Promise.all([
        listJuryCriteria(contestId),
        getParticipantsByContest(contestId, nominationFilter, {
          limit: 10000,
          offset: 0,
          sort: 'created_at',
          votedOnly: likesOnly,
          submissionFilter: 'accepted',
        }),
      ]);
      critRes.sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));
      setCriteria(critRes);
      setParticipants(partRes.items);

      if (critRes.length === 0) {
        setScores({});
        setSyncByParticipant({});
        return;
      }

      const nextScores: Record<string, Record<string, number>> = {};
      const nextSync: Record<string, SyncStatus> = {};
      await mapWithConcurrency(partRes.items, 8, async (p) => {
        let rows: Awaited<ReturnType<typeof getMyJuryScores>> = [];
        try {
          rows = await getMyJuryScores(contestId, p.id);
        } catch {
          rows = [];
        }
        const byCrit: Record<string, number> = {};
        for (const s of rows) {
          byCrit[s.criterion_id] = s.score;
        }
        const row: Record<string, number> = {};
        for (const c of critRes) {
          const v = byCrit[c.id];
          if (v !== undefined && v >= c.scale_min && v <= c.scale_max) {
            row[c.id] = v;
          }
        }
        nextScores[p.id] = row;
        nextSync[p.id] = 'synced';
      });
      setScores(nextScores);
      scoresRef.current = nextScores;
      setSyncByParticipant(nextSync);
    } catch (e: unknown) {
      showError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [contestId, isJuror, showError, nominationFilter, likesOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const debMap = debounceTimersRef.current;
    const retryMap = retryTimersRef.current;
    debMap.forEach((t) => clearTimeout(t));
    debMap.clear();
    retryMap.forEach((t) => clearTimeout(t));
    retryMap.clear();
  }, [nominationFilter, likesOnly]);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      const pendingIds = participantsRef.current
        .map((p) => p.id)
        .filter((id) => {
          const s = syncRef.current[id];
          return s === 'pending' || s === 'error';
        });
      if (pendingIds.length === 0) return;
      void runPool(pendingIds, ONLINE_FLUSH_CONCURRENCY, async (pid) => {
        clearTimersRef.current(pid);
        retryCountRef.current.delete(pid);
        await flushParticipantRef.current(pid);
      });
    };
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    const debMap = debounceTimersRef.current;
    const retryMap = retryTimersRef.current;
    return () => {
      debMap.forEach((t) => clearTimeout(t));
      debMap.clear();
      retryMap.forEach((t) => clearTimeout(t));
      retryMap.clear();
    };
  }, []);

  const sortedParticipants = useMemo(() => {
    const list = [...participants];
    const { column, desc } = sort;
    const scoreForSort = (participantId: string): number => {
      if (column === 'total') {
        return weightedTotal(participantId);
      }
      const critCol = criterionById.get(column);
      if (!critCol) return 0;
      const v = scores[participantId]?.[column];
      if (v === undefined) {
        return desc ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
      }
      return v;
    };
    list.sort((a, b) => {
      const va = scoreForSort(a.id);
      const vb = scoreForSort(b.id);
      const primary = desc ? vb - va : va - vb;
      if (primary !== 0) return primary;
      return a.id.localeCompare(b.id);
    });
    return list;
  }, [participants, sort, weightedTotal, scores, criterionById]);

  const setCell = (participantId: ParticipantID, criterionId: string, value: number | undefined) => {
    setScores((prev) => {
      const base = { ...(prev[participantId] || {}) };
      if (value === undefined) {
        delete base[criterionId];
      } else {
        base[criterionId] = value;
      }
      const next = { ...prev, [participantId]: base };
      scoresRef.current = next;
      return next;
    });
    scheduleDebounce(participantId);
  };

  const resetAllToMid = () => {
    if (!canEdit) return;
    setScores((prev) => {
      const next: Record<string, Record<string, number>> = {};
      for (const p of participants) {
        const row: Record<string, number> = {};
        for (const c of criteria) {
          row[c.id] = defaultScore(c);
        }
        next[p.id] = row;
      }
      scoresRef.current = next;
      return next;
    });
    for (const p of participants) {
      clearParticipantTimers(p.id);
      retryCountRef.current.delete(p.id);
      scheduleDebounce(p.id);
    }
  };

  const handleRetryAllErrors = useCallback(() => {
    for (const p of participants) {
      if ((syncByParticipant[p.id] ?? 'synced') === 'error') {
        retryCountRef.current.delete(p.id);
        clearParticipantTimers(p.id);
        void flushParticipant(p.id);
      }
    }
  }, [participants, syncByParticipant, clearParticipantTimers, flushParticipant]);

  const aggregateSync = useMemo((): SyncStatus => {
    let hasError = false;
    let hasSaving = false;
    let hasPending = false;
    for (const p of participants) {
      const s = syncByParticipant[p.id] ?? 'synced';
      if (s === 'error') hasError = true;
      else if (s === 'saving') hasSaving = true;
      else if (s === 'pending') hasPending = true;
    }
    if (hasError) return 'error';
    if (hasSaving) return 'saving';
    if (hasPending) return 'pending';
    return 'synced';
  }, [participants, syncByParticipant]);

  const toolbarSyncLabel = useMemo((): { text: string; title: string } => {
    switch (aggregateSync) {
      case 'synced':
        return { text: 'Сохранено', title: 'Все оценки на сервере' };
      case 'pending':
        return {
          text: isOnline ? 'Ожидает…' : 'Офлайн',
          title: isOnline
            ? 'Изменения будут отправлены через мгновение'
            : 'Нет сети — отправка после восстановления',
        };
      case 'saving':
        return { text: '…', title: 'Сохранение…' };
      case 'error':
        return {
          text: 'Ошибка',
          title: 'Не удалось сохранить одну или несколько работ. Нажмите «Повторить».',
        };
      default:
        return { text: '—', title: '' };
    }
  }, [aggregateSync, isOnline]);

  if (!isJuror) {
    return (
      <div className="contest-jury-voting">
        <div className="contest-jury-voting-card">
          <p className="contest-jury-voting-empty">
            Таблица голосования доступна только членам жюри этого конкурса. Организатор может добавить вас в состав
            жюри в настройках конкурса.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="contest-jury-voting-loading">
        <LoadingSpinner size="medium" />
        <span> Загрузка работ и критериев…</span>
      </div>
    );
  }

  if (criteria.length === 0) {
    return (
      <div className="contest-jury-voting">
        <div className="contest-jury-voting-card">
          <p className="contest-jury-voting-empty">
            Критерии жюри ещё не заданы организатором. После публикации критериев здесь появится таблица оценок.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="contest-jury-voting">
      <div className="contest-jury-voting-card">
        {!isOnline ? (
          <div className="contest-jury-voting-offline-banner" role="status">
            Нет соединения с интернетом. Изменения остаются у вас на странице и будут отправлены после восстановления
            связи.
          </div>
        ) : null}
        <div className="contest-jury-voting-toolbar">
          <div className="contest-jury-voting-btn-group">
            <button
              type="button"
              className="contest-jury-voting-btn"
              onClick={resetAllToMid}
              disabled={!canEdit || participants.length === 0}
            >
              Установить пустые в середину шкалы
            </button>
          </div>
          <div className="contest-jury-voting-toolbar-right">
            <span
              className={`contest-jury-voting-sync contest-jury-voting-sync--${aggregateSync}`}
              title={toolbarSyncLabel.title}
            >
              {aggregateSync === 'saving' ? <LoadingSpinner size="small" /> : null}
              {aggregateSync === 'saving' ? ' ' : ''}
              {toolbarSyncLabel.text}
            </span>
            {aggregateSync === 'error' && canEdit ? (
              <Button type="button" size="small" variant="secondary" onClick={handleRetryAllErrors}>
                Повторить
              </Button>
            ) : null}
            <div className="contest-jury-voting-badge">
              Максимум на вашу оценку одной работы:{' '}
              <strong>{formatJuryTotalScore(weightedMaxOneJuror)}</strong> (по шкале × вес)
            </div>
          </div>
        </div>

        <div
          className="contest-jury-voting-nomination-bar contest-page-nomination-tabs-bar"
          role="toolbar"
          aria-label="Фильтры списка работ"
        >
          <div className="contest-page-nomination-tab-row">
            {nominations.length > 1 ? (
              <>
                <button
                  type="button"
                  role="tab"
                  aria-selected={nominationFilter === 'all'}
                  className={
                    nominationFilter === 'all'
                      ? 'contest-page-nomination-tab contest-page-nomination-tab--active'
                      : 'contest-page-nomination-tab'
                  }
                  onClick={() => setNominationFilter('all')}
                >
                  Все номинации
                </button>
                {nominations.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    role="tab"
                    aria-selected={nominationFilter === n.id}
                    className={
                      nominationFilter === n.id
                        ? 'contest-page-nomination-tab contest-page-nomination-tab--active'
                        : 'contest-page-nomination-tab'
                    }
                    onClick={() => setNominationFilter(n.id)}
                  >
                    {n.title}
                  </button>
                ))}
              </>
            ) : null}
            <button
              type="button"
              className={[
                likesOnly
                  ? 'contest-page-nomination-tab contest-page-nomination-tab--active'
                  : 'contest-page-nomination-tab',
                nominations.length > 1 ? 'contest-jury-voting-likes-tab' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-pressed={likesOnly}
              title={
                likesOnly
                  ? 'Показать все работы (с учётом номинации)'
                  : 'Только работы с отметкой «Мне нравится»'
              }
              onClick={() => setLikesOnly((v) => !v)}
            >
              Мне нравится
            </button>
          </div>
        </div>

        {participants.length === 0 ? (
          <p className="contest-jury-voting-empty">
            {likesOnly
              ? 'Нет заявок с отметкой «Мне нравится» при текущем фильтре номинации.'
              : nominations.length > 0 && nominationFilter !== 'all'
                ? 'В выбранной номинации пока нет заявок.'
                : 'Пока нет заявок для отображения.'}
          </p>
        ) : (
          <>
            <div className="contest-jury-voting-table-wrap">
              <table className="contest-jury-voting-table">
                <thead>
                  <tr>
                    <th className="contest-jury-voting-th-work" scope="col">
                      Работа (название / автор)
                    </th>
                    {criteria.map((c) => (
                      <th key={c.id} scope="col">
                        <button
                          type="button"
                          className="contest-jury-voting-th-sort contest-jury-voting-th-criterion"
                          onClick={() => onSortColumn(c.id)}
                          title={`Сортировать по баллу: ${c.title}`}
                        >
                          {c.title}
                          {sort.column === c.id ? (sort.desc ? ' ▼' : ' ▲') : ''}
                        </button>
                        <br />
                        <span className="contest-jury-voting-weight-badge">вес × {c.weight ?? 1}</span>
                      </th>
                    ))}
                    <th scope="col">
                      <button
                        type="button"
                        className="contest-jury-voting-th-sort"
                        onClick={() => onSortColumn('total')}
                        title="Сортировать по взвешенному итогу (ваши баллы)"
                      >
                        Итог (ваши баллы)
                        {sort.column === 'total' ? (sort.desc ? ' ▼' : ' ▲') : ''}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedParticipants.map((p) => {
                    return (
                      <tr key={p.id}>
                        <td className="contest-jury-voting-td-work">
                          <JuryParticipantWorkCell
                            contestId={contestId}
                            participantId={p.id}
                            title={getParticipantDisplayTitle(p)}
                            coverUrlRaw={p.photos?.[0]?.thumb_url || p.photos?.[0]?.url || undefined}
                            lightboxUrlRaw={p.photos?.[0]?.url || p.photos?.[0]?.thumb_url || undefined}
                            subLine={
                              <>
                                {p.user_name?.trim() || 'Участник'}
                                {p.nomination_id && nominationTitleById[p.nomination_id]
                                  ? ` · ${nominationTitleById[p.nomination_id]}`
                                  : ''}
                              </>
                            }
                          />
                        </td>
                        {criteria.map((c) => {
                          const v = scores[p.id]?.[c.id];
                          return (
                            <td key={c.id} className="contest-jury-voting-td-criterion">
                              <input
                                type="number"
                                className="contest-jury-voting-score-input"
                                min={c.scale_min}
                                max={c.scale_max}
                                step={c.scale_step}
                                value={v === undefined ? '' : v}
                                disabled={!canEdit}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  if (raw === '') {
                                    setCell(p.id, c.id, undefined);
                                    return;
                                  }
                                  let n = Number(raw);
                                  if (Number.isNaN(n)) return;
                                  n = Math.min(c.scale_max, Math.max(c.scale_min, n));
                                  setCell(p.id, c.id, n);
                                }}
                                onBlur={(e) => {
                                  const raw = e.target.value;
                                  if (raw === '') {
                                    setCell(p.id, c.id, undefined);
                                    return;
                                  }
                                  let n = Number(raw);
                                  if (Number.isNaN(n)) {
                                    setCell(p.id, c.id, undefined);
                                    return;
                                  }
                                  n = Math.min(c.scale_max, Math.max(c.scale_min, n));
                                  setCell(p.id, c.id, n);
                                }}
                                aria-label={`${c.title} для ${getParticipantDisplayTitle(p)}`}
                              />
                            </td>
                          );
                        })}
                        <td className="contest-jury-voting-total">
                          {formatJuryTotalScore(weightedTotal(p.id))} /{' '}
                          {formatJuryTotalScore(weightedMaxOneJuror)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="contest-jury-voting-footer">
              <span>
                Оценки сохраняются автоматически после паузы в редактировании. Ваш итог по строке = Σ(оценка × вес).
                Общая сумма по работе на конкурсе учитывает всех членов жюри.
              </span>
              <span>Сортировка — по клику на заголовок критерия или «Итог (ваши баллы)»; повторный клик меняет направление.</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
