import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../common/Button';
import { JuryParticipantWorkCell } from './JuryParticipantWorkCell';
import { ParticipantJuryReportModal } from './ParticipantJuryReportModal';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { getJuryChairboard, putJuryChairAssignments } from '../../api/juryChairApi';
import type { ParticipantsListNominationFilter } from '../../api/participantsApi';
import type {
  ContestID,
  ContestPrizePlace,
  ContestStatus,
  JuryChairboardData,
  JuryChairboardRow,
  Nomination,
  Participant,
  ParticipantID,
} from '../../types/models';
import { getParticipantDisplayTitle } from '../../utils/seo';
import { formatJuryTotalScore } from '../../utils/juryLabels';
import { useToast } from '../../contexts/ToastContext';
import { getApiErrorMessage, isApiError } from '../../types/api';
import { juryChairboardForbiddenHintMessage } from '../../utils/juryChairboardAccess';
import './ContestJuryVotingTab.css';
import './ContestJuryChairTab.css';

const DEBOUNCE_MS = 500;

/** Колонка сортировки: итог или id члена жюри. */
type SortColumn = 'total' | number;

type SyncStatus = 'synced' | 'pending' | 'saving' | 'error';

/** Черновик: только строка места по `participant_id`. */
type PlaceDraft = Record<string, string>;

type JuryReportOpen = {
  participantId: ParticipantID;
  participantName: string;
  jurorUserId: number;
  jurorName: string;
  weighted: number;
};

type Props = {
  contestId: ContestID;
  contestStatus: ContestStatus;
  nominationTitleById: Record<string, string>;
  nominations: Nomination[];
  /** Призовые места жюри из настроек конкурса (номер места + подпись). */
  juryPrizePlaces: ContestPrizePlace[];
};

/** Плотный ранг по сумме баллов, как на сервере в computeTopPlaceWinners. */
function computeAutoPlaceDraft(
  rows: JuryChairboardRow[],
  prizePlaces: ContestPrizePlace[]
): PlaceDraft {
  const byRank = new Map<number, ContestPrizePlace>();
  for (const p of prizePlaces) {
    if (p.place >= 1) {
      byRank.set(p.place, p);
    }
  }
  const sorted = [...rows].sort((a, b) => {
    if (b.total_score !== a.total_score) return b.total_score - a.total_score;
    return a.participant_id.localeCompare(b.participant_id);
  });
  const out: PlaceDraft = {};
  for (const r of rows) {
    out[r.participant_id] = '';
  }
  let rank = 0;
  let lastScore = Number.NEGATIVE_INFINITY;
  for (const row of sorted) {
    const score = row.total_score;
    if (score <= 0) {
      break;
    }
    if (score !== lastScore) {
      rank++;
      lastScore = score;
    }
    const cfg = byRank.get(rank);
    if (!cfg) {
      continue;
    }
    out[row.participant_id] = String(cfg.place);
  }
  return out;
}

function getJurorScore(row: JuryChairboardRow, jurorUserId: number): number {
  return row.juror_totals[String(jurorUserId)] ?? 0;
}

export const ContestJuryChairTab: React.FC<Props> = ({
  contestId,
  contestStatus,
  nominationTitleById,
  nominations,
  juryPrizePlaces,
}) => {
  const { showError } = useToast();
  const [nominationFilter, setNominationFilter] =
    useState<ParticipantsListNominationFilter>(() =>
      nominations.length > 1 ? nominations[0].id : 'all'
    );

  /** Без вкладки «Все номинации»: при нескольких номинациях сразу фильтруем по первой. */
  useEffect(() => {
    if (nominations.length > 1) {
      setNominationFilter((prev) => {
        if (prev === 'all' || prev === 'none') return nominations[0].id;
        if (!nominations.some((n) => n.id === prev)) return nominations[0].id;
        return prev;
      });
    } else {
      setNominationFilter('all');
    }
  }, [nominations]);

  const [loading, setLoading] = useState(true);
  const [board, setBoard] = useState<JuryChairboardData | null>(null);
  const [draft, setDraft] = useState<PlaceDraft>({});
  const [sort, setSort] = useState<{ column: SortColumn; desc: boolean }>({
    column: 'total',
    desc: true,
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [juryReportOpen, setJuryReportOpen] = useState<JuryReportOpen | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const boardRef = useRef<JuryChairboardData | null>(null);
  const draftRef = useRef<PlaceDraft>({});
  boardRef.current = board;
  draftRef.current = draft;

  const sortedJuryPrizePlaces = useMemo(
    () => [...juryPrizePlaces].sort((a, b) => a.place - b.place),
    [juryPrizePlaces]
  );

  const readOnly =
    contestStatus === 'draft' || contestStatus === 'publication';
  const canEdit =
    !readOnly &&
    (contestStatus === 'registration' ||
      contestStatus === 'voting' ||
      contestStatus === 'finished');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getJuryChairboard(contestId, nominationFilter);
      setBoard(data);
      const allowedPlaces = new Set(juryPrizePlaces.map((p) => p.place));
      const nextDraft: PlaceDraft = {};
      for (const r of data.rows) {
        const pl = r.place;
        if (pl != null && pl >= 1 && allowedPlaces.has(pl)) {
          nextDraft[r.participant_id] = String(pl);
        } else {
          nextDraft[r.participant_id] = '';
        }
      }
      setDraft(nextDraft);
      setSyncStatus('synced');
    } catch (e: unknown) {
      showError(
        isApiError(e) && e.response?.status === 403
          ? juryChairboardForbiddenHintMessage()
          : getApiErrorMessage(e)
      );
      setBoard(null);
    } finally {
      setLoading(false);
    }
  }, [contestId, nominationFilter, showError, juryPrizePlaces]);

  useEffect(() => {
    void load();
  }, [load]);

  const displayRows = useMemo(() => {
    if (!board) return [];
    const list = [...board.rows];
    const { column, desc } = sort;
    list.sort((a, b) => {
      let va: number;
      let vb: number;
      if (column === 'total') {
        va = a.total_score;
        vb = b.total_score;
      } else {
        va = getJurorScore(a, column);
        vb = getJurorScore(b, column);
      }
      const primary = desc ? vb - va : va - vb;
      if (primary !== 0) return primary;
      return a.participant_id.localeCompare(b.participant_id);
    });
    return list;
  }, [board, sort]);

  const flushSave = useCallback(async () => {
    const b = boardRef.current;
    if (!b || !canEdit) return;
    const d = draftRef.current;
    setSyncStatus('saving');
    const assignments = b.rows.map((r) => {
      const pl = (d[r.participant_id] ?? '').trim();
      const placeNum = pl === '' ? NaN : parseInt(pl, 10);
      const out: { participant_id: ParticipantID; place?: number; prize?: string } = {
        participant_id: r.participant_id,
        prize: '',
      };
      if (!Number.isNaN(placeNum) && placeNum >= 1) {
        out.place = placeNum;
      }
      return out;
    });
    try {
      await putJuryChairAssignments(contestId, assignments);
      setSyncStatus('synced');
    } catch (e: unknown) {
      setSyncStatus('error');
      showError(
        isApiError(e) && e.response?.status === 403
          ? juryChairboardForbiddenHintMessage()
          : getApiErrorMessage(e)
      );
    }
  }, [canEdit, contestId, showError]);

  const scheduleSave = useCallback(() => {
    if (!canEdit) return;
    setSyncStatus('pending');
    if (debounceTimerRef.current != null) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      void flushSave();
    }, DEBOUNCE_MS);
  }, [canEdit, flushSave]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current != null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const updatePlaceDraft = (participantId: string, value: string) => {
    setDraft((prev) => ({ ...prev, [participantId]: value }));
    scheduleSave();
  };

  const runAutoAssignPlaces = useCallback(() => {
    const b = boardRef.current;
    if (!b || !canEdit || sortedJuryPrizePlaces.length === 0) return;
    const next = computeAutoPlaceDraft(b.rows, sortedJuryPrizePlaces);
    setDraft(next);
    draftRef.current = next;
    void flushSave();
  }, [canEdit, flushSave, sortedJuryPrizePlaces]);

  const onSortByColumn = useCallback((col: 'total' | number) => {
    setSort((s) => {
      if (s.column === col) {
        return { column: col, desc: !s.desc };
      }
      return { column: col, desc: true };
    });
  }, []);

  const syncLabel = (): { text: string; title: string } => {
    switch (syncStatus) {
      case 'synced':
        return { text: 'Сохранено', title: 'Места на сервере' };
      case 'pending':
        return { text: 'Ожидает…', title: 'Сохранится через мгновение' };
      case 'saving':
        return { text: '…', title: 'Сохранение…' };
      case 'error':
        return { text: 'Ошибка', title: 'Не удалось сохранить' };
      default:
        return { text: '—', title: '' };
    }
  };

  if (loading) {
    return (
      <div className="contest-jury-voting-loading">
        <LoadingSpinner size="medium" />
        <span> Загрузка свода жюри…</span>
      </div>
    );
  }

  if (!board || board.criteria_count === 0) {
    return (
      <div className="contest-jury-voting">
        <div className="contest-jury-voting-card">
          <p className="contest-jury-voting-empty">
            Критерии жюри ещё не заданы организатором. После публикации критериев здесь появится таблица
            итоговых баллов по членам жюри.
          </p>
        </div>
      </div>
    );
  }

  const sl = syncLabel();

  return (
    <div className="contest-jury-voting contest-jury-chair">
      <div className="contest-jury-voting-card">
        <div className="contest-jury-voting-toolbar">
          <div className="contest-jury-voting-btn-group">
            <button
              type="button"
              className="contest-jury-voting-btn"
              onClick={() => setSort({ column: 'total', desc: true })}
              disabled={sort.column === 'total' && sort.desc}
            >
              Сбросить сортировку
            </button>
            <button
              type="button"
              className="contest-jury-voting-btn"
              disabled={
                !canEdit ||
                !board?.rows.length ||
                sortedJuryPrizePlaces.length === 0
              }
              title={
                sortedJuryPrizePlaces.length === 0
                  ? 'Сначала задайте призовые места жюри в настройках конкурса'
                  : 'Назначить места по убыванию суммы баллов (плотный ранг, как при автоподсчёте победителей)'
              }
              onClick={() => runAutoAssignPlaces()}
            >
              Расставить места автоматически
            </button>
          </div>
          <div className="contest-jury-chair-toolbar-right">
            <span
              className={`contest-jury-voting-sync contest-jury-voting-sync--${syncStatus}`}
              title={sl.title}
            >
              {syncStatus === 'saving' ? <LoadingSpinner size="small" /> : null}
              {syncStatus === 'saving' ? ' ' : ''}
              {sl.text}
            </span>
            {syncStatus === 'error' && canEdit ? (
              <Button type="button" size="small" variant="secondary" onClick={() => void flushSave()}>
                Повторить
              </Button>
            ) : null}
            <div className="contest-jury-voting-badge">
              Макс. на одного члена жюри:{' '}
              <strong>{formatJuryTotalScore(board.max_weighted_per_juror)}</strong>
              {' · '}
              макс. сумма по работе:{' '}
              <strong>{formatJuryTotalScore(board.max_total_weighted)}</strong>
            </div>
            {sortedJuryPrizePlaces.length === 0 ? (
              <p className="contest-jury-chair-settings-hint" role="status">
                В настройках конкурса не заданы призовые места жюри — укажите их в блоке редактирования
                конкурса, чтобы назначать места.
              </p>
            ) : null}
          </div>
        </div>

        {nominations.length > 1 ? (
          <div
            className="contest-jury-voting-nomination-bar contest-page-nomination-tabs-bar"
            role="tablist"
            aria-label="Фильтр по номинации"
          >
            <div className="contest-page-nomination-tab-row">
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
            </div>
          </div>
        ) : null}

        {displayRows.length === 0 ? (
          <p className="contest-jury-voting-empty">
            {nominations.length > 1
              ? 'В выбранной номинации пока нет заявок.'
              : 'Пока нет заявок для отображения.'}
          </p>
        ) : (
          <>
            <div className="contest-jury-voting-table-wrap">
              <table className="contest-jury-voting-table contest-jury-chair-table">
                <thead>
                  <tr>
                    <th className="contest-jury-voting-th-work" scope="col">
                      Работа (название / автор)
                    </th>
                    <th scope="col">Номинация</th>
                    {board.jurors.map((j) => (
                      <th key={j.user_id} scope="col">
                        <button
                          type="button"
                          className="contest-jury-voting-th-sort"
                          onClick={() => onSortByColumn(j.user_id)}
                          title={`Сортировать по баллам: ${j.user_name || j.user_id}`}
                        >
                          {j.user_name || `Жюри ${j.user_id}`}
                          {sort.column === j.user_id ? (sort.desc ? ' ▼' : ' ▲') : ''}
                        </button>
                        <br />
                        <span className="contest-jury-voting-weight-badge">
                          макс {formatJuryTotalScore(board.max_weighted_per_juror)}
                        </span>
                      </th>
                    ))}
                    <th scope="col">
                      <button
                        type="button"
                        className="contest-jury-voting-th-sort"
                        onClick={() => onSortByColumn('total')}
                        title="Сортировать по сумме баллов всех членов жюри"
                      >
                        Итог (все жюри)
                        {sort.column === 'total' ? (sort.desc ? ' ▼' : ' ▲') : ''}
                      </button>
                    </th>
                    <th scope="col">Место</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row) => {
                    const placeStr = draft[row.participant_id] ?? '';
                    const pseudo: Participant = {
                      id: row.participant_id,
                      contest_id: contestId,
                      user_id: 0,
                      submission_status: 'accepted',
                      pet_name: row.pet_name,
                      pet_description: '',
                      entry_title: row.entry_title,
                      user_name: row.user_name,
                      nomination_id: row.nomination_id ?? undefined,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    };
                    return (
                      <tr key={row.participant_id}>
                        <td className="contest-jury-voting-td-work">
                          <JuryParticipantWorkCell
                            contestId={contestId}
                            participantId={row.participant_id}
                            title={getParticipantDisplayTitle(pseudo)}
                            coverUrlRaw={row.cover_thumb_url}
                            lightboxUrlRaw={row.cover_image_url || row.cover_thumb_url}
                            subLine={
                              <>
                                {row.user_name?.trim() || 'Участник'}
                                {row.nomination_id && nominationTitleById[row.nomination_id]
                                  ? ` · ${nominationTitleById[row.nomination_id]}`
                                  : ''}
                              </>
                            }
                          />
                        </td>
                        <td>
                          {row.nomination_id && nominationTitleById[row.nomination_id] ? (
                            <span className="contest-jury-chair-nom-badge">
                              {nominationTitleById[row.nomination_id]}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        {board.jurors.map((j) => {
                          const key = String(j.user_id);
                          const v = row.juror_totals[key] ?? 0;
                          const jurorLabel = j.user_name?.trim() || `Жюри ${j.user_id}`;
                          return (
                            <td key={key} className="contest-jury-chair-score-cell">
                              <div className="contest-jury-chair-juror-score-wrap">
                                <span className="contest-jury-voting-score-input contest-jury-chair-readonly">
                                  {formatJuryTotalScore(v)}
                                </span>
                                <button
                                  type="button"
                                  className="contest-jury-chair-detail-btn"
                                  title={`Оценки по критериям: ${jurorLabel}`}
                                  aria-label={`Подробные оценки по критериям, ${jurorLabel}`}
                                  onClick={() =>
                                    setJuryReportOpen({
                                      participantId: row.participant_id,
                                      participantName: getParticipantDisplayTitle(pseudo),
                                      jurorUserId: j.user_id,
                                      jurorName: jurorLabel,
                                      weighted: v,
                                    })
                                  }
                                >
                                  <svg
                                    className="contest-jury-chair-detail-btn-icon"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden
                                  >
                                    <path d="M8 6h13" />
                                    <path d="M8 12h13" />
                                    <path d="M8 18h13" />
                                    <path d="M3 6h.01" />
                                    <path d="M3 12h.01" />
                                    <path d="M3 18h.01" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          );
                        })}
                        <td className="contest-jury-voting-total">
                          {formatJuryTotalScore(row.total_score)} /{' '}
                          {formatJuryTotalScore(board.max_total_weighted)}
                        </td>
                        <td>
                          <select
                            className="contest-jury-chair-place-select"
                            value={placeStr}
                            disabled={!canEdit || sortedJuryPrizePlaces.length === 0}
                            onChange={(e) => updatePlaceDraft(row.participant_id, e.target.value)}
                            aria-label={`Место для ${getParticipantDisplayTitle(pseudo)}`}
                          >
                            <option value="">—</option>
                            {sortedJuryPrizePlaces.map((pp) => (
                              <option key={pp.place} value={String(pp.place)}>
                                {pp.place} — {pp.prize.trim() || 'место'}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="contest-jury-voting-footer">
              <span>
                Итог по строке — сумма взвешенных баллов всех членов жюри. Места выбираются из призовых
                мест жюри в настройках конкурса; кнопка «Расставить места автоматически» заполняет их по
                сумме баллов (плотный ранг). Сохранение — после паузы в редактировании.
              </span>
            </div>
          </>
        )}
      </div>

      {juryReportOpen ? (
        <ParticipantJuryReportModal
          isOpen
          onClose={() => setJuryReportOpen(null)}
          contestId={contestId}
          participantId={juryReportOpen.participantId}
          participantName={juryReportOpen.participantName}
          focusJurorUserId={juryReportOpen.jurorUserId}
          focusJurorName={juryReportOpen.jurorName}
          focusJurorWeightedTotal={juryReportOpen.weighted}
        />
      ) : null}
    </div>
  );
};
