import React, { useCallback, useEffect, useImperativeHandle, useState, forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { Contest } from '../../types/models';
import { listNominations, createNomination, updateNomination, deleteNomination } from '../../api/nominationsApi';
import {
  listJuryCriteria,
  replaceJuryCriteria,
  type JuryCriterionInput,
} from '../../api/juryCriteriaApi';
import { Button } from '../common/Button';
import { useToast } from '../../contexts/ToastContext';
import { errorHandler } from '../../utils/errorHandler';
import './ContestOrganizerCriteriaPanel.css';

export type ContestOrganizerCriteriaPanelHandle = {
  /** Сохранить критерии жюри. Если не черновик / нет прав — no-op, `true`. */
  saveJuryCriteria: (opts?: { quietSuccess?: boolean }) => Promise<boolean>;
};

interface Props {
  contest: Contest;
  isAdmin: boolean;
  /** Только просмотр (редактирование на странице /contests/:id/edit). */
  readOnly?: boolean;
  /** Скрыть кнопку «Сохранить критерии» (общее сохранение на странице редактирования). */
  hideJuryCriteriaSaveButton?: boolean;
  /** Блокировка полей при сохранении всей страницы. */
  formDisabled?: boolean;
}

const emptyCriterion = (): JuryCriterionInput => ({
  title: '',
  description: '',
  scale_min: 1,
  scale_max: 10,
  scale_step: 1,
});

export const ContestOrganizerCriteriaPanel = forwardRef<ContestOrganizerCriteriaPanelHandle, Props>(
  function ContestOrganizerCriteriaPanel(
    { contest, isAdmin, readOnly = false, hideJuryCriteriaSaveButton = false, formDisabled = false },
    ref
  ) {
  const { showError, showSuccess } = useToast();
  const [nominations, setNominations] = useState<Awaited<ReturnType<typeof listNominations>>>([]);
  const [criteriaDraft, setCriteriaDraft] = useState<JuryCriterionInput[]>([emptyCriterion()]);
  const [loading, setLoading] = useState(true);
  const [savingCriteria, setSavingCriteria] = useState(false);
  const [nomTitle, setNomTitle] = useState('');
  const [nomDesc, setNomDesc] = useState('');
  const [editingNomId, setEditingNomId] = useState<string | null>(null);
  const [editNomTitle, setEditNomTitle] = useState('');
  const [editNomDesc, setEditNomDesc] = useState('');

  const canEdit = !readOnly && isAdmin && contest.status === 'draft';
  const fieldsLocked = formDisabled || !canEdit;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [noms, crit] = await Promise.all([
        listNominations(contest.id),
        listJuryCriteria(contest.id),
      ]);
      setNominations(noms);
      if (crit.length > 0) {
        setCriteriaDraft(
          crit.map((c) => ({
            title: c.title,
            description: c.description || '',
            scale_min: c.scale_min,
            scale_max: c.scale_max,
            scale_step: c.scale_step,
          }))
        );
      } else {
        setCriteriaDraft([emptyCriterion()]);
      }
    } catch (e) {
      errorHandler.handleError(e, showError, false);
      showError('Не удалось загрузить номинации и критерии');
    } finally {
      setLoading(false);
    }
  }, [contest.id, showError]);

  useEffect(() => {
    load();
  }, [load]);

  const persistJuryCriteria = useCallback(
    async (opts?: { quietSuccess?: boolean }): Promise<boolean> => {
      if (!canEdit) {
        return true;
      }
      const items = criteriaDraft.filter((c) => c.title.trim() !== '');
      if (items.length === 0) {
        showError('Добавьте хотя бы один критерий с названием');
        return false;
      }
      setSavingCriteria(true);
      try {
        const saved = await replaceJuryCriteria(contest.id, items);
        setCriteriaDraft(
          saved.length > 0
            ? saved.map((c) => ({
                title: c.title,
                description: c.description || '',
                scale_min: c.scale_min,
                scale_max: c.scale_max,
                scale_step: c.scale_step,
              }))
            : [emptyCriterion()]
        );
        if (!opts?.quietSuccess) {
          showSuccess('Критерии сохранены');
        }
        return true;
      } catch (e) {
        errorHandler.handleError(e, showError, false);
        showError('Не удалось сохранить критерии');
        return false;
      } finally {
        setSavingCriteria(false);
      }
    },
    [canEdit, criteriaDraft, contest.id, showError, showSuccess]
  );

  useImperativeHandle(
    ref,
    () => ({
      saveJuryCriteria: (opts) => persistJuryCriteria(opts),
    }),
    [persistJuryCriteria]
  );

  const handleAddNomination = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomTitle.trim()) {
      showError('Название номинации обязательно');
      return;
    }
    try {
      const n = await createNomination(contest.id, { title: nomTitle.trim(), description: nomDesc.trim() });
      setNominations((prev) => [...prev, n].sort((a, b) => a.sort_order - b.sort_order));
      setNomTitle('');
      setNomDesc('');
      showSuccess('Номинация добавлена');
    } catch (err) {
      errorHandler.handleError(err, showError, false);
      showError('Не удалось добавить номинацию');
    }
  };

  const startEditNom = (id: string, title: string, description: string) => {
    setEditingNomId(id);
    setEditNomTitle(title);
    setEditNomDesc(description || '');
  };

  const saveEditNom = async () => {
    if (!editingNomId || !editNomTitle.trim()) return;
    try {
      const updated = await updateNomination(contest.id, editingNomId, {
        title: editNomTitle.trim(),
        description: editNomDesc.trim(),
      });
      setNominations((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setEditingNomId(null);
      showSuccess('Сохранено');
    } catch (e) {
      errorHandler.handleError(e, showError, false);
      showError('Не удалось сохранить');
    }
  };

  const handleDeleteNom = async (nominationId: string) => {
    if (!window.confirm('Удалить номинацию?')) return;
    try {
      await deleteNomination(contest.id, nominationId);
      setNominations((prev) => prev.filter((x) => x.id !== nominationId));
      if (editingNomId === nominationId) setEditingNomId(null);
      showSuccess('Удалено');
    } catch (e) {
      errorHandler.handleError(e, showError, false);
      showError('Не удалось удалить');
    }
  };

  if (loading) {
    return <p className="contest-organizer-criteria-muted">Загрузка номинаций и критериев…</p>;
  }

  return (
    <section className="contest-organizer-criteria">
      <h2 className="contest-organizer-criteria-title">Номинации и критерии оценки</h2>
      <p className="contest-organizer-criteria-hint">
        Номинации — категории участия. Критерии жюри задаются на весь конкурс и одинаковы для всех номинаций.
        {readOnly ? (
          isAdmin && contest.status === 'draft' ? (
            <>
              {' '}
              Изменить название, описание, номинации и критерии можно на{' '}
              <Link to={`/contests/${contest.id}/edit`}>странице редактирования конкурса</Link>.
            </>
          ) : null
        ) : (
          <> Редактирование — в статусе «Черновик».</>
        )}
      </p>

      <div className="contest-organizer-criteria-block">
        <h3>Номинации</h3>
        {nominations.length === 0 && !canEdit ? (
          <p className="contest-organizer-criteria-muted">Номинации не заданы.</p>
        ) : (
          <ul className="contest-organizer-criteria-list">
            {nominations.map((n) => (
              <li key={n.id}>
                {canEdit && editingNomId === n.id ? (
                  <div className="contest-organizer-criteria-edit">
                    <input
                      value={editNomTitle}
                      onChange={(e) => setEditNomTitle(e.target.value)}
                      className="contest-organizer-criteria-input"
                      disabled={fieldsLocked}
                    />
                    <textarea
                      value={editNomDesc}
                      onChange={(e) => setEditNomDesc(e.target.value)}
                      rows={2}
                      className="contest-organizer-criteria-textarea"
                      disabled={fieldsLocked}
                    />
                    <div className="contest-organizer-criteria-actions">
                      <Button type="button" size="small" onClick={saveEditNom} disabled={fieldsLocked}>
                        Сохранить
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="small"
                        onClick={() => setEditingNomId(null)}
                        disabled={fieldsLocked}
                      >
                        Отмена
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <strong>{n.title}</strong>
                    {n.description ? <span className="contest-organizer-criteria-desc">{n.description}</span> : null}
                    {canEdit && (
                      <div className="contest-organizer-criteria-actions">
                        <Button
                          type="button"
                          variant="secondary"
                          size="small"
                          onClick={() => startEditNom(n.id, n.title, n.description)}
                          disabled={fieldsLocked}
                        >
                          Изменить
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          size="small"
                          onClick={() => handleDeleteNom(n.id)}
                          disabled={fieldsLocked}
                        >
                          Удалить
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <form onSubmit={handleAddNomination} className="contest-organizer-criteria-form">
            <input
              placeholder="Название номинации"
              value={nomTitle}
              onChange={(e) => setNomTitle(e.target.value)}
              className="contest-organizer-criteria-input"
              disabled={fieldsLocked}
            />
            <textarea
              placeholder="Описание (необязательно)"
              value={nomDesc}
              onChange={(e) => setNomDesc(e.target.value)}
              rows={2}
              className="contest-organizer-criteria-textarea"
              disabled={fieldsLocked}
            />
            <Button type="submit" disabled={fieldsLocked}>
              Добавить номинацию
            </Button>
          </form>
        )}
      </div>

      <div className="contest-organizer-criteria-block">
        <h3>Критерии оценки жюри (на конкурс)</h3>
        {!canEdit && (
          <ul className="contest-organizer-criteria-readonly">
            {criteriaDraft.filter((c) => c.title.trim()).map((c, idx) => (
              <li key={idx}>
                <strong>{c.title}</strong>
                {c.description ? ` — ${c.description}` : ''}
                <span className="contest-organizer-criteria-scale">
                  {' '}
                  (шкала {c.scale_min}–{c.scale_max}
                  {c.scale_step !== 1 ? `, шаг ${c.scale_step}` : ''})
                </span>
              </li>
            ))}
          </ul>
        )}
        {canEdit && criteriaDraft.map((c, idx) => (
          <div key={idx} className="contest-organizer-criteria-criterion">
            <input
              placeholder="Название (например «Композиция»)"
              value={c.title}
              onChange={(e) => {
                const next = [...criteriaDraft];
                next[idx] = { ...next[idx], title: e.target.value };
                setCriteriaDraft(next);
              }}
              disabled={fieldsLocked}
              className="contest-organizer-criteria-input"
            />
            <textarea
              placeholder="Описание критерия"
              value={c.description}
              onChange={(e) => {
                const next = [...criteriaDraft];
                next[idx] = { ...next[idx], description: e.target.value };
                setCriteriaDraft(next);
              }}
              disabled={fieldsLocked}
              rows={2}
              className="contest-organizer-criteria-textarea"
            />
            <div className="contest-organizer-criteria-scale-row">
              <label>
                Мин
                <input
                  type="number"
                  value={c.scale_min}
                  onChange={(e) => {
                    const next = [...criteriaDraft];
                    next[idx] = { ...next[idx], scale_min: Number(e.target.value) || 0 };
                    setCriteriaDraft(next);
                  }}
                  disabled={fieldsLocked}
                />
              </label>
              <label>
                Макс
                <input
                  type="number"
                  value={c.scale_max}
                  onChange={(e) => {
                    const next = [...criteriaDraft];
                    next[idx] = { ...next[idx], scale_max: Number(e.target.value) || 0 };
                    setCriteriaDraft(next);
                  }}
                  disabled={fieldsLocked}
                />
              </label>
              <label>
                Шаг
                <input
                  type="number"
                  min={1}
                  value={c.scale_step}
                  onChange={(e) => {
                    const next = [...criteriaDraft];
                    next[idx] = { ...next[idx], scale_step: Number(e.target.value) || 1 };
                    setCriteriaDraft(next);
                  }}
                  disabled={fieldsLocked}
                />
              </label>
            </div>
            {canEdit && criteriaDraft.length > 1 && (
              <Button
                type="button"
                variant="secondary"
                size="small"
                onClick={() => setCriteriaDraft((prev) => prev.filter((_, i) => i !== idx))}
                disabled={fieldsLocked}
              >
                Удалить критерий
              </Button>
            )}
          </div>
        ))}
        {canEdit && (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCriteriaDraft((prev) => [...prev, emptyCriterion()])}
              disabled={fieldsLocked}
            >
              Добавить критерий
            </Button>
            {!hideJuryCriteriaSaveButton && (
              <div className="contest-organizer-criteria-save">
                <Button
                  type="button"
                  onClick={() => void persistJuryCriteria()}
                  disabled={savingCriteria || fieldsLocked}
                >
                  {savingCriteria ? 'Сохранение…' : 'Сохранить критерии'}
                </Button>
              </div>
            )}
          </>
        )}
        {!canEdit && criteriaDraft.every((c) => !c.title.trim()) && (
          <p className="contest-organizer-criteria-muted">Критерии жюри не заданы.</p>
        )}
      </div>
    </section>
  );
  }
);
