import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../common/Modal';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { getJuryScoresReport } from '../../api/juryScoresApi';
import type { JuryScoreReportItem } from '../../types/models';
import './ParticipantJuryReportModal.css';

type SortKey =
  | 'juror_name'
  | 'juror_user_id'
  | 'criterion_title'
  | 'criterion_sort_order'
  | 'scale_max'
  | 'score'
  | 'score_updated_at';

interface ParticipantJuryReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  contestId: string;
  participantId: string;
  participantName: string;
}

const formatUpdatedAt = (iso: string): string => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

function compareItems(a: JuryScoreReportItem, b: JuryScoreReportItem, key: SortKey, dir: 1 | -1): number {
  let cmp = 0;
  switch (key) {
    case 'juror_name':
      cmp = a.juror_name.localeCompare(b.juror_name, 'ru');
      break;
    case 'juror_user_id':
      cmp = a.juror_user_id - b.juror_user_id;
      break;
    case 'criterion_title':
      cmp = a.criterion_title.localeCompare(b.criterion_title, 'ru');
      break;
    case 'criterion_sort_order':
      cmp = a.criterion_sort_order - b.criterion_sort_order;
      break;
    case 'scale_max':
      cmp = a.scale_max - b.scale_max;
      if (cmp === 0) {
        cmp = a.scale_min - b.scale_min;
      }
      break;
    case 'score':
      cmp = a.score - b.score;
      break;
    case 'score_updated_at':
      cmp = new Date(a.score_updated_at).getTime() - new Date(b.score_updated_at).getTime();
      break;
    default:
      break;
  }
  if (cmp !== 0) {
    return cmp * dir;
  }
  cmp = a.juror_user_id - b.juror_user_id;
  if (cmp !== 0) {
    return cmp;
  }
  cmp = a.criterion_sort_order - b.criterion_sort_order;
  if (cmp !== 0) {
    return cmp;
  }
  return a.criterion_title.localeCompare(b.criterion_title, 'ru');
}

export const ParticipantJuryReportModal: React.FC<ParticipantJuryReportModalProps> = ({
  isOpen,
  onClose,
  contestId,
  participantId,
  participantName,
}) => {
  const [items, setItems] = useState<JuryScoreReportItem[]>([]);
  const [totalJuryScore, setTotalJuryScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('juror_name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    if (!isOpen || !contestId || !participantId) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getJuryScoresReport(contestId, participantId)
      .then((data) => {
        if (!cancelled) {
          setItems(data.items);
          setTotalJuryScore(data.total_jury_score);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.message || 'Не удалось загрузить отчёт');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, contestId, participantId]);

  const sortedItems = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...items].sort((a, b) => compareItems(a, b, sortKey, dir));
  }, [items, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortMark = (key: SortKey) => {
    if (sortKey !== key) {
      return '';
    }
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Оценки жюри: ${participantName}`}>
      <div className="participant-jury-report-modal-body">
        <p className="participant-jury-report-modal-hint">
          Сводка по выставленным баллам. Итог совпадает с суммой всех оценок по всем членам жюри и критериям.
        </p>
        <div className="participant-jury-report-modal-total" role="status">
          Итоговая сумма баллов жюри: <strong>{totalJuryScore}</strong>
        </div>
        {loading && (
          <div className="participant-jury-report-modal-loading">
            <LoadingSpinner size="medium" />
          </div>
        )}
        {!loading && error && <div className="participant-jury-report-modal-error">{error}</div>}
        {!loading && !error && items.length === 0 && (
          <div className="participant-jury-report-modal-empty">Пока нет ни одной сохранённой оценки.</div>
        )}
        {!loading && !error && items.length > 0 && (
          <div className="participant-jury-report-modal-table-wrap">
            <table className="participant-jury-report-modal-table">
              <thead>
                <tr>
                  <th scope="col">
                    <button type="button" className="participant-jury-report-sort" onClick={() => toggleSort('juror_name')}>
                      Член жюри{sortMark('juror_name')}
                    </button>
                  </th>
                  <th scope="col">
                    <button type="button" className="participant-jury-report-sort" onClick={() => toggleSort('juror_user_id')}>
                      ID{sortMark('juror_user_id')}
                    </button>
                  </th>
                  <th scope="col">
                    <button type="button" className="participant-jury-report-sort" onClick={() => toggleSort('criterion_title')}>
                      Критерий{sortMark('criterion_title')}
                    </button>
                  </th>
                  <th scope="col">
                    <button type="button" className="participant-jury-report-sort" onClick={() => toggleSort('criterion_sort_order')}>
                      № крит.{sortMark('criterion_sort_order')}
                    </button>
                  </th>
                  <th scope="col">
                    <button type="button" className="participant-jury-report-sort" onClick={() => toggleSort('scale_max')}>
                      Шкала{sortMark('scale_max')}
                    </button>
                  </th>
                  <th scope="col">
                    <button type="button" className="participant-jury-report-sort" onClick={() => toggleSort('score')}>
                      Балл{sortMark('score')}
                    </button>
                  </th>
                  <th scope="col">
                    <button type="button" className="participant-jury-report-sort" onClick={() => toggleSort('score_updated_at')}>
                      Обновлено{sortMark('score_updated_at')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((row) => (
                  <tr key={`${row.juror_user_id}-${row.criterion_id}`}>
                    <td>{row.juror_name}</td>
                    <td>{row.juror_user_id}</td>
                    <td>{row.criterion_title}</td>
                    <td>{row.criterion_sort_order}</td>
                    <td>
                      {row.scale_min}–{row.scale_max}
                    </td>
                    <td className="participant-jury-report-modal-score">{row.score}</td>
                    <td>{formatUpdatedAt(row.score_updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
};
