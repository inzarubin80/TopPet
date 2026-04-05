import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { getJuryVotingProgress } from '../../api/juryScoresApi';
import type { JuryVotingProgressRow } from '../../types/models';
import './ContestJuryVotingProgressReport.css';

function submissionShortLabel(status: string): string {
  switch (status) {
    case 'accepted':
      return 'Принята';
    case 'pending':
      return 'Модерация';
    case 'rejected':
      return 'Отклонена';
    default:
      return status;
  }
}

export interface ContestJuryVotingProgressReportProps {
  contestId: string;
  /** Если жюри пусто — доп. текст (например число работ со страницы конкурса). */
  worksOnPageHint?: number;
}

type JurorCol = { userId: number; name: string };
type ParticipantRow = { id: string; petName: string; submissionStatus: string };

export const ContestJuryVotingProgressReport: React.FC<ContestJuryVotingProgressReportProps> = ({
  contestId,
  worksOnPageHint,
}) => {
  const [rows, setRows] = useState<JuryVotingProgressRow[]>([]);
  const [criteriaTotal, setCriteriaTotal] = useState(0);
  const [juryMemberCount, setJuryMemberCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contestId) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getJuryVotingProgress(contestId)
      .then((data) => {
        if (!cancelled) {
          setRows(data.rows);
          setCriteriaTotal(data.criteria_total);
          setJuryMemberCount(data.jury_member_count);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.message || 'Не удалось загрузить сводку');
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
  }, [contestId]);

  const { jurors, participants, cellMap, worksFullyDone, workCount } = useMemo(() => {
    const jurorById = new Map<number, string>();
    const participantOrder: ParticipantRow[] = [];
    const seenP = new Set<string>();
    const cells = new Map<string, number>();

    for (const r of rows) {
      if (!jurorById.has(r.juror_user_id)) {
        jurorById.set(r.juror_user_id, r.juror_name);
      }
      if (!seenP.has(r.participant_id)) {
        seenP.add(r.participant_id);
        participantOrder.push({
          id: r.participant_id,
          petName: r.pet_name,
          submissionStatus: r.submission_status,
        });
      }
      cells.set(`${r.participant_id}:${r.juror_user_id}`, r.criteria_scored);
    }

    const jurorsList: JurorCol[] = Array.from(jurorById.entries(), ([userId, name]) => ({
      userId,
      name,
    })).sort((a, b) => a.userId - b.userId);

    let fully = 0;
    if (criteriaTotal > 0 && jurorsList.length > 0) {
      for (const p of participantOrder) {
        const all = jurorsList.every((j) => (cells.get(`${p.id}:${j.userId}`) ?? 0) >= criteriaTotal);
        if (all) {
          fully += 1;
        }
      }
    }

    return {
      jurors: jurorsList,
      participants: participantOrder,
      cellMap: cells,
      worksFullyDone: fully,
      workCount: participantOrder.length,
    };
  }, [rows, criteriaTotal]);

  return (
    <div className="contest-jury-progress-report">
      {loading && (
        <div className="contest-jury-progress-report-loading">
          <LoadingSpinner size="medium" />
        </div>
      )}
      {!loading && error && <div className="contest-jury-progress-report-error">{error}</div>}
      {!loading && !error && (
        <>
          <div className="contest-jury-progress-report-meta" role="status">
            <span>
              Критериев оценки: <strong>{criteriaTotal}</strong>
            </span>
            <span className="contest-jury-progress-meta-sep" aria-hidden>
              ·
            </span>
            <span>
              Членов жюри: <strong>{juryMemberCount}</strong>
            </span>
            {workCount > 0 ? (
              <>
                <span className="contest-jury-progress-meta-sep" aria-hidden>
                  ·
                </span>
                <span>
                  Работ в таблице: <strong>{workCount}</strong>
                </span>
              </>
            ) : null}
            {criteriaTotal > 0 && workCount > 0 && juryMemberCount > 0 ? (
              <>
                <span className="contest-jury-progress-meta-sep" aria-hidden>
                  ·
                </span>
                <span>
                  Полностью оценены всем жюри: <strong>{worksFullyDone}</strong> из {workCount}
                </span>
              </>
            ) : null}
          </div>
          {criteriaTotal === 0 ? (
            <p className="contest-jury-progress-report-warn">
              Критерии оценки не заданы — добавьте их в настройках конкурса.
            </p>
          ) : null}
          {juryMemberCount === 0 ? (
            <p className="contest-jury-progress-report-warn">
              Состав жюри пуст. Назначьте членов жюри в настройках конкурса.
              {worksOnPageHint != null && worksOnPageHint > 0
                ? ` На странице конкурса сейчас ${worksOnPageHint} ${worksOnPageHint === 1 ? 'работа' : 'работ'}.`
                : ''}
            </p>
          ) : null}
          {juryMemberCount > 0 && workCount === 0 ? (
            <p className="contest-jury-progress-report-empty">Пока нет заявок в этом конкурсе.</p>
          ) : null}
          {juryMemberCount > 0 && workCount > 0 ? (
            <div className="contest-jury-progress-table-wrap contest-jury-progress-table-wrap--page">
              <table className="contest-jury-progress-table">
                <thead>
                  <tr>
                    <th scope="col" className="contest-jury-progress-col-work">
                      Работа
                    </th>
                    {jurors.map((j) => (
                      <th
                        key={j.userId}
                        scope="col"
                        className="contest-jury-progress-col-juror"
                        title={j.name}
                      >
                        <span className="contest-jury-progress-juror-name">{j.name}</span>
                        <span className="contest-jury-progress-juror-id">id {j.userId}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {participants.map((p) => (
                    <tr key={p.id}>
                      <th scope="row" className="contest-jury-progress-col-work">
                        <Link
                          className="contest-jury-progress-work-link"
                          to={`/contests/${contestId}/participants/${p.id}`}
                        >
                          {p.petName}
                        </Link>
                        <span
                          className={`contest-jury-progress-status contest-jury-progress-status--${p.submissionStatus}`}
                        >
                          {submissionShortLabel(p.submissionStatus)}
                        </span>
                      </th>
                      {jurors.map((j) => {
                        const scored = cellMap.get(`${p.id}:${j.userId}`) ?? 0;
                        let cls = 'contest-jury-progress-cell';
                        if (criteriaTotal <= 0) {
                          cls += ' contest-jury-progress-cell--na';
                        } else if (scored >= criteriaTotal) {
                          cls += ' contest-jury-progress-cell--done';
                        } else if (scored > 0) {
                          cls += ' contest-jury-progress-cell--partial';
                        } else {
                          cls += ' contest-jury-progress-cell--empty';
                        }
                        const label = criteriaTotal <= 0 ? '—' : `${scored}/${criteriaTotal}`;
                        return (
                          <td key={j.userId} className={cls} title={`${j.name}: ${label}`}>
                            {label}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <p className="contest-jury-progress-report-footnote">
            В ячейке — сколько критериев выставил член жюри по этой работе. Полная оценка: все критерии
            заполнены.
          </p>
        </>
      )}
    </div>
  );
};
