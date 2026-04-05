import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getContestJury } from '../../api/juryApi';
import { listJuryCriteria } from '../../api/juryCriteriaApi';
import { getMyJuryScores, putMyJuryScores } from '../../api/juryScoresApi';
import { ContestID, ContestStatus, JuryCriterion, ParticipantID, UserID } from '../../types/models';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useToast } from '../../contexts/ToastContext';
import { getApiErrorMessage } from '../../types/api';
import './ParticipantJuryScoresPanel.css';

type Props = {
  contestId: ContestID;
  participantId: ParticipantID;
  contestStatus: ContestStatus;
  currentUserId: UserID;
  /** После сохранения оценок — обновить участника (например сумму жюри в карточке). */
  onScoresSaved?: () => void;
};

export const ParticipantJuryScoresPanel: React.FC<Props> = ({
  contestId,
  participantId,
  contestStatus,
  currentUserId,
  onScoresSaved,
}) => {
  const { showError, showSuccess } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [visible, setVisible] = useState(false);
  const [criteria, setCriteria] = useState<JuryCriterion[]>([]);
  const [values, setValues] = useState<Record<string, number>>({});

  const readOnly =
    contestStatus === 'finished' || contestStatus === 'draft' || contestStatus === 'publication';

  const load = useCallback(async () => {
    if (contestStatus === 'draft' || contestStatus === 'publication') {
      setVisible(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const jury = await getContestJury(contestId);
      const isJuror = jury.some((j) => j.user_id === currentUserId);
      if (!isJuror) {
        setVisible(false);
        return;
      }
      const crit = await listJuryCriteria(contestId);
      if (crit.length === 0) {
        setVisible(false);
        return;
      }
      crit.sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));
      let scores: Awaited<ReturnType<typeof getMyJuryScores>> = [];
      try {
        scores = await getMyJuryScores(contestId, participantId);
      } catch {
        scores = [];
      }
      const byCrit: Record<string, number> = {};
      for (const s of scores) {
        byCrit[s.criterion_id] = s.score;
      }
      const nextVals: Record<string, number> = {};
      for (const c of crit) {
        const v = byCrit[c.id];
        if (v !== undefined && v >= c.scale_min && v <= c.scale_max) {
          nextVals[c.id] = v;
        }
      }
      setCriteria(crit);
      setValues(nextVals);
      setVisible(true);
    } catch (e: unknown) {
      setVisible(false);
      showError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [contestId, participantId, currentUserId, contestStatus, showError]);

  useEffect(() => {
    void load();
  }, [load]);

  const canEdit = useMemo(
    () => !readOnly && (contestStatus === 'registration' || contestStatus === 'voting'),
    [readOnly, contestStatus]
  );

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const items = criteria.map((c) => ({
        criterion_id: c.id,
        score: values[c.id] ?? c.scale_min,
      }));
      await putMyJuryScores(contestId, participantId, items);
      showSuccess('Оценки сохранены');
      await load();
      onScoresSaved?.();
    } catch (e: unknown) {
      showError(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="participant-jury-scores participant-jury-scores--loading" aria-busy="true">
        <LoadingSpinner size="small" />
        <span>Загрузка критериев жюри…</span>
      </div>
    );
  }

  if (!visible) {
    return null;
  }

  return (
    <section className="participant-jury-scores" aria-labelledby="participant-jury-scores-heading">
      <h2 id="participant-jury-scores-heading">Оценки жюри</h2>
      <p className="participant-jury-scores-hint">
        Ваши баллы по критериям. Оценки других членов жюри не видны. Сводную сумму по работе видят только организаторы конкурса и администраторы платформы.
      </p>
      <ul className="participant-jury-scores-list">
        {criteria.map((c) => (
          <li key={c.id} className="participant-jury-scores-item">
            <div className="participant-jury-scores-item-head">
              <span className="participant-jury-scores-title">{c.title}</span>
              <span className="participant-jury-scores-scale">
                {c.scale_min}…{c.scale_max}, шаг {c.scale_step}
              </span>
            </div>
            {c.description?.trim() ? (
              <p className="participant-jury-scores-desc">{c.description}</p>
            ) : null}
            {canEdit ? (
              <input
                type="number"
                className="participant-jury-scores-input"
                min={c.scale_min}
                max={c.scale_max}
                step={c.scale_step}
                value={values[c.id] ?? c.scale_min}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isNaN(n)) return;
                  setValues((prev) => ({ ...prev, [c.id]: n }));
                }}
                aria-label={`Баллы: ${c.title}`}
              />
            ) : (
              <p className="participant-jury-scores-readonly">
                {values[c.id] !== undefined ? (
                  <>
                    <strong>{values[c.id]}</strong>
                    {readOnly ? ' (редактирование закрыто)' : null}
                  </>
                ) : (
                  <span className="participant-jury-scores-missing">Не выставлено</span>
                )}
              </p>
            )}
          </li>
        ))}
      </ul>
      {canEdit ? (
        <div className="participant-jury-scores-actions">
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Сохранение…' : 'Сохранить оценки'}
          </Button>
        </div>
      ) : null}
    </section>
  );
};
