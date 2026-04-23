import React, { useCallback, useEffect, useImperativeHandle, useState, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { Contest } from '../../types/models';
import {
  listNominations,
  createNomination,
  updateNomination,
  deleteNomination,
  reorderNominations,
  uploadNominationLogo,
  clearNominationLogo,
} from '../../api/nominationsApi';
import {
  listJuryCriteria,
  replaceJuryCriteria,
  type JuryCriterionInput,
} from '../../api/juryCriteriaApi';
import { Button } from '../common/Button';
import '../common/ReorderIconButtons.css';
import { useToast } from '../../contexts/ToastContext';
import { errorHandler } from '../../utils/errorHandler';
import {
  criterionPrimarySecondary,
  juryScaleAudiencePhrase,
  juryScaleOrganizerPhrase,
  minPhotosAudienceHint,
  nominationPhotoRangeAudienceHint,
  nominationPrimarySecondary,
  sortNominationsByOrder,
} from './contestNominationsDisplay';
import { ContestAssetImageField } from './ContestAssetImageField';
import { resolvePublicAssetUrl } from '../../utils/seo';
import './ContestOrganizerCriteriaPanel.css';

export type ContestOrganizerCriteriaPanelHandle = {
  /** Сохранить критерии жюри. Если не черновик / нет прав — no-op, `true`. */
  saveJuryCriteria: (opts?: { quietSuccess?: boolean }) => Promise<boolean>;
};

interface Props {
  contest: Contest;
  isAdmin: boolean;
  /** Скрыть заголовок блока (когда заголовок уже задан контейнером страницы). */
  hideTitle?: boolean;
  /** Скрыть секцию номинаций, оставить только критерии жюри. */
  hideNominationsSection?: boolean;
  /** Только просмотр (редактирование на странице /contests/:id/edit). */
  readOnly?: boolean;
  /** Скрыть кнопку «Сохранить критерии» (общее сохранение на странице редактирования). */
  hideJuryCriteriaSaveButton?: boolean;
  /** Блокировка полей при сохранении всей страницы. */
  formDisabled?: boolean;
  /** Критерии жюри — только при включённом «голосовании жюри» у конкурса. */
  showJuryCriteriaSection?: boolean;
  /** Критерии жюри не под номинациями, а в узле `juryCriteriaPortalHost` (страница редактирования). */
  juryCriteriaPortalMode?: boolean;
  juryCriteriaPortalHost?: HTMLElement | null;
  /**
   * Режим для гостя/участника: другой копирайт и оформление read-only.
   * По умолчанию: readOnly && !isAdmin.
   */
  audienceMode?: boolean;
}

const emptyCriterion = (): JuryCriterionInput => ({
  title: '',
  description: '',
  scale_min: 1,
  scale_max: 10,
  scale_step: 1,
  weight: 1,
});

/** Иконка категории, если у номинации нет своего логотипа */
function NominationCategoryGlyph() {
  return (
    <svg
      className="contest-organizer-criteria-nom-inline-default-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  );
}

/** Иконка строки критерия жюри (read-only) */
function JuryCriterionGlyph() {
  return (
    <svg
      className="contest-organizer-criteria-jury-inline-glyph"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="16" y2="12" />
      <line x1="4" y1="17" x2="12" y2="17" />
    </svg>
  );
}

export const ContestOrganizerCriteriaPanel = forwardRef<ContestOrganizerCriteriaPanelHandle, Props>(
  function ContestOrganizerCriteriaPanel(
    {
      contest,
      isAdmin,
      hideTitle = false,
      hideNominationsSection = false,
      readOnly = false,
      hideJuryCriteriaSaveButton = false,
      formDisabled = false,
      showJuryCriteriaSection = true,
      juryCriteriaPortalMode = false,
      juryCriteriaPortalHost = null,
      audienceMode: audienceModeProp,
    },
    ref
  ) {
  const { showError, showSuccess } = useToast();
  const [nominations, setNominations] = useState<Awaited<ReturnType<typeof listNominations>>>([]);
  const [criteriaDraft, setCriteriaDraft] = useState<JuryCriterionInput[]>([emptyCriterion()]);
  const [loading, setLoading] = useState(true);
  const [savingCriteria, setSavingCriteria] = useState(false);
  /** Правки названия/описания номинации применены локально; на сервер — при общем сохранении (saveJuryCriteria). */
  const [dirtyNominationIds, setDirtyNominationIds] = useState<Record<string, true>>({});
  const [logoUploadingNomId, setLogoUploadingNomId] = useState<string | null>(null);
  const [nomOrderBusy, setNomOrderBusy] = useState(false);
  const [nomAddBusy, setNomAddBusy] = useState(false);

  const canEdit = !readOnly && isAdmin;
  const fieldsLocked = formDisabled || !canEdit;
  const audienceView = audienceModeProp ?? (readOnly && !isAdmin);
  /** Публичная страница конкурса: номинации списком без карточек (и для гостя, и для админа) */
  const nominationsPublicCompact = audienceView || readOnly;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [noms, crit] = await Promise.all([
        listNominations(contest.id),
        listJuryCriteria(contest.id),
      ]);
      setNominations([...noms].sort(sortNominationsByOrder));
      setDirtyNominationIds({});
      if (crit.length > 0) {
        setCriteriaDraft(
          crit.map((c) => ({
            id: c.id,
            title: c.title,
            description: c.description || '',
            scale_min: c.scale_min,
            scale_max: c.scale_max,
            scale_step: c.scale_step,
            weight: c.weight ?? 1,
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

  const flushPendingNominationEdits = useCallback(
    async (_opts?: { quietSuccess?: boolean }): Promise<boolean> => {
      if (!canEdit) {
        return true;
      }
      const ids = Object.keys(dirtyNominationIds);
      if (ids.length === 0) {
        return true;
      }
      for (const id of ids) {
        const n = nominations.find((x) => x.id === id);
        if (n && !n.title.trim()) {
          showError('Название номинации обязательно');
          return false;
        }
      }
      try {
        for (const id of ids) {
          const n = nominations.find((x) => x.id === id);
          if (!n) {
            continue;
          }
          const updated = await updateNomination(contest.id, id, {
            title: n.title.trim(),
            description: (n.description || '').trim(),
          });
          setNominations((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
        }
        setDirtyNominationIds({});
        return true;
      } catch (e) {
        errorHandler.handleError(e, showError, false);
        showError('Не удалось сохранить изменения номинаций');
        return false;
      }
    },
    [canEdit, contest.id, dirtyNominationIds, nominations, showError]
  );

  const persistJuryCriteria = useCallback(
    async (opts?: { quietSuccess?: boolean }): Promise<boolean> => {
      if (!canEdit) {
        return true;
      }
      const nomOk = await flushPendingNominationEdits(opts);
      if (!nomOk) {
        return false;
      }
      if (!showJuryCriteriaSection) {
        return true;
      }
      const items = criteriaDraft
        .filter((c) => c.title.trim() !== '')
        .map((c) => {
          const base = {
            title: c.title.trim(),
            description: (c.description || '').trim(),
            scale_min: c.scale_min,
            scale_max: c.scale_max,
            scale_step: c.scale_step,
            weight: c.weight ?? 1,
          };
          const tid = c.id?.trim();
          return tid ? { ...base, id: tid } : base;
        });
      if (items.length === 0) {
        showError('Добавьте хотя бы один критерий с названием');
        return false;
      }
      setSavingCriteria(true);
      try {
        const saved = await replaceJuryCriteria(contest.id, items);
        setCriteriaDraft(
          saved.length > 0
            ?             saved.map((c) => ({
                id: c.id,
                title: c.title,
                description: c.description || '',
                scale_min: c.scale_min,
                scale_max: c.scale_max,
                scale_step: c.scale_step,
                weight: c.weight ?? 1,
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
    [
      canEdit,
      criteriaDraft,
      contest.id,
      showError,
      showSuccess,
      showJuryCriteriaSection,
      flushPendingNominationEdits,
    ]
  );

  useImperativeHandle(
    ref,
    () => ({
      saveJuryCriteria: (opts) => persistJuryCriteria(opts),
    }),
    [persistJuryCriteria]
  );

  const handleAddNomination = async () => {
    if (fieldsLocked || nomAddBusy) return;
    /** API не принимает пустой title — даём имя по умолчанию, дальше правка в списке. */
    const title = `Номинация ${nominations.length + 1}`;
    setNomAddBusy(true);
    try {
      const n = await createNomination(contest.id, {
        title,
        description: '',
      });
      setNominations((prev) => [...prev, n].sort(sortNominationsByOrder));
      showSuccess('Номинация добавлена');
    } catch (err) {
      errorHandler.handleError(err, showError, false);
      showError('Не удалось добавить номинацию');
    } finally {
      setNomAddBusy(false);
    }
  };

  const patchNominationDraft = useCallback(
    (id: string, patch: { title?: string; description?: string }) => {
      if (fieldsLocked) return;
      setNominations((prev) => {
        const cur = prev.find((x) => x.id === id);
        if (!cur) return prev;
        const title = patch.title !== undefined ? patch.title : cur.title;
        const description = patch.description !== undefined ? patch.description : cur.description ?? '';
        return prev.map((x) => (x.id === id ? { ...x, title, description } : x));
      });
      setDirtyNominationIds((d) => ({ ...d, [id]: true }));
    },
    [fieldsLocked]
  );

  const handleDeleteNom = async (nominationId: string) => {
    if (!window.confirm('Удалить номинацию?')) return;
    try {
      await deleteNomination(contest.id, nominationId);
      setNominations((prev) => prev.filter((x) => x.id !== nominationId));
      setDirtyNominationIds((d) => {
        if (!d[nominationId]) return d;
        const next = { ...d };
        delete next[nominationId];
        return next;
      });
      showSuccess('Удалено');
    } catch (e) {
      errorHandler.handleError(e, showError, false);
      showError('Не удалось удалить');
    }
  };

  const moveNomination = async (fromIndex: number, dir: -1 | 1) => {
    const toIndex = fromIndex + dir;
    if (toIndex < 0 || toIndex >= nominations.length) return;
    setNomOrderBusy(true);
    try {
      const next = [...nominations];
      [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
      const items = await reorderNominations(
        contest.id,
        next.map((x) => x.id)
      );
      setNominations([...items].sort(sortNominationsByOrder));
      showSuccess('Порядок обновлён');
    } catch (err) {
      errorHandler.handleError(err, showError, false);
      showError('Не удалось изменить порядок');
    } finally {
      setNomOrderBusy(false);
    }
  };

  const moveCriterion = (fromIndex: number, dir: -1 | 1) => {
    if (fieldsLocked) return;
    const toIndex = fromIndex + dir;
    if (toIndex < 0 || toIndex >= criteriaDraft.length) return;
    setCriteriaDraft((prev) => {
      const next = [...prev];
      [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
      return next;
    });
  };

  const handleNominationLogoFile = async (nominationId: string, file: File) => {
    if (!canEdit || fieldsLocked) return;
    setLogoUploadingNomId(nominationId);
    try {
      const updated = await uploadNominationLogo(contest.id, nominationId, file);
      setNominations((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      showSuccess('Логотип обновлён');
    } catch (err) {
      errorHandler.handleError(err, showError, false);
      showError('Не удалось загрузить логотип');
    } finally {
      setLogoUploadingNomId(null);
    }
  };

  const handleClearNominationLogo = async (nominationId: string) => {
    if (!canEdit || fieldsLocked) return;
    setLogoUploadingNomId(nominationId);
    try {
      const updated = await clearNominationLogo(contest.id, nominationId);
      setNominations((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      showSuccess('Логотип убран');
    } catch (err) {
      errorHandler.handleError(err, showError, false);
      showError('Не удалось убрать логотип');
    } finally {
      setLogoUploadingNomId(null);
    }
  };

  if (loading) {
    return (
      <p className="contest-organizer-criteria-muted">
        {audienceView ? 'Загрузка категорий и критериев…' : 'Загрузка номинаций и критериев…'}
      </p>
    );
  }

  const juryCriteriaInPanel = showJuryCriteriaSection && !juryCriteriaPortalMode;
  const juryCriteriaPortaled =
    showJuryCriteriaSection && juryCriteriaPortalMode && juryCriteriaPortalHost !== null;

  const juryCriteriaBlock =
    showJuryCriteriaSection ? (
      <div className="contest-organizer-criteria-block contest-organizer-criteria-block--jury">
        <h2 className="contest-section-heading contest-organizer-criteria-jury-subtitle">
          {audienceView ? 'По чему жюри оценивает работы' : 'Критерии оценки'}
        </h2>
        {!canEdit && (
          <ul className="contest-organizer-criteria-list contest-organizer-criteria-jury-readonly-list contest-organizer-criteria-jury-readonly-list--inline">
            {criteriaDraft.filter((c) => c.title.trim()).map((c, idx) => {
              const { primary, secondary } = criterionPrimarySecondary(c);
              const scaleText = audienceView
                ? juryScaleAudiencePhrase(c.scale_min, c.scale_max, c.scale_step)
                : juryScaleOrganizerPhrase(c.scale_min, c.scale_max, c.scale_step);
              const w = c.weight ?? 1;
              return (
                <li key={c.id ?? `jury-ro-${idx}`}>
                  <div className="contest-organizer-criteria-jury-inline">
                    <span className="contest-organizer-criteria-jury-inline-lead" aria-hidden>
                      <JuryCriterionGlyph />
                    </span>
                    <div className="contest-organizer-criteria-jury-inline-text">
                      <span className="contest-organizer-criteria-jury-inline-title">{primary}</span>
                      {secondary ? (
                        <span className="contest-organizer-criteria-jury-inline-desc">{secondary}</span>
                      ) : null}
                      <span className="contest-organizer-criteria-jury-inline-meta">
                        {scaleText}
                        {w !== 1 ? ` · вес × ${w}` : ''}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {canEdit && criteriaDraft.map((c, idx) => (
          <div key={c.id ?? idx} className="contest-organizer-criteria-criterion">
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
              <label>
                Вес
                <input
                  type="number"
                  min={0.01}
                  step={0.1}
                  value={c.weight ?? 1}
                  onChange={(e) => {
                    const next = [...criteriaDraft];
                    const raw = Number(e.target.value);
                    next[idx] = { ...next[idx], weight: Number.isFinite(raw) && raw > 0 ? raw : 1 };
                    setCriteriaDraft(next);
                  }}
                  disabled={fieldsLocked}
                  title="Множитель в формуле суммы: балл × вес"
                />
              </label>
            </div>
            {canEdit && criteriaDraft.length > 1 ? (
              <div className="contest-organizer-criteria-actions">
                <span className="reorder-icon-actions">
                  <button
                    type="button"
                    className="reorder-icon-btn"
                    onClick={() => moveCriterion(idx, -1)}
                    disabled={fieldsLocked || idx === 0}
                    aria-label="Переместить критерий выше"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="reorder-icon-btn"
                    onClick={() => moveCriterion(idx, 1)}
                    disabled={fieldsLocked || idx >= criteriaDraft.length - 1}
                    aria-label="Переместить критерий ниже"
                  >
                    ↓
                  </button>
                </span>
                <Button
                  type="button"
                  variant="danger"
                  size="small"
                  onClick={() => setCriteriaDraft((prev) => prev.filter((_, i) => i !== idx))}
                  disabled={fieldsLocked}
                >
                  Удалить критерий
                </Button>
              </div>
            ) : null}
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
          <p className="contest-organizer-criteria-muted">
            {audienceView ? 'Критерии оценки пока не опубликованы.' : 'Критерии жюри не заданы.'}
          </p>
        )}
      </div>
    ) : null;

  const sectionTitle = audienceView ? 'Категории участия' : 'Номинации';
  const contestPhotoHint =
    nominationPhotoRangeAudienceHint(
      contest.min_photo_count ?? 1,
      contest.max_photo_count ?? 30
    ) ?? minPhotosAudienceHint(contest.min_photo_count ?? 1);

  return (
    <section
      className={
        audienceView
          ? 'contest-organizer-criteria contest-organizer-criteria--audience'
          : 'contest-organizer-criteria'
      }
    >
      {!hideTitle ? <h2 className="contest-section-heading contest-organizer-criteria-title">{sectionTitle}</h2> : null}
      {!readOnly && !hideJuryCriteriaSaveButton ? (
        <p className="contest-organizer-criteria-hint">
          Сохраните изменения кнопкой внизу блока.
        </p>
      ) : null}
      {!audienceView && canEdit && !readOnly && !hideJuryCriteriaSaveButton ? (
        <p className="contest-organizer-criteria-hint contest-organizer-criteria-hint--secondary">
          Лимит фотографий в заявке: {contest.min_photo_count ?? 1}–{contest.max_photo_count ?? 30} (настраивается в
          разделе «Фотографии в заявке» на странице редактирования конкурса).
        </p>
      ) : null}

      {!hideNominationsSection ? (
      <div className="contest-organizer-criteria-block">
        {audienceView ? <h3 className="contest-section-subheading">Список категорий</h3> : null}
        {nominations.length === 0 && !canEdit ? (
          <p className="contest-organizer-criteria-muted">
            {audienceView ? 'Организатор пока не указал категории участия.' : 'Номинации не заданы.'}
          </p>
        ) : (
          <>
          <ul
            className={
              nominationsPublicCompact
                ? 'contest-organizer-criteria-list contest-organizer-criteria-list--audience contest-organizer-criteria-list--compact'
                : 'contest-organizer-criteria-list'
            }
          >
            {nominations.map((n, index) => {
              if (canEdit) {
                return (
                  <li key={n.id}>
                    <div className="contest-organizer-criteria-edit">
                      <input
                        value={n.title}
                        onChange={(e) => patchNominationDraft(n.id, { title: e.target.value })}
                        className="contest-organizer-criteria-input"
                        disabled={fieldsLocked}
                        aria-label={`Название номинации ${index + 1}`}
                      />
                      <textarea
                        value={n.description || ''}
                        onChange={(e) => patchNominationDraft(n.id, { description: e.target.value })}
                        rows={2}
                        className="contest-organizer-criteria-textarea"
                        disabled={fieldsLocked}
                        aria-label={`Описание номинации ${index + 1}`}
                      />
                      <ContestAssetImageField
                        compact
                        legend="Логотип"
                        url={n.logo_url || ''}
                        onPickFile={(file) => void handleNominationLogoFile(n.id, file)}
                        onClear={() => void handleClearNominationLogo(n.id)}
                        uploading={logoUploadingNomId === n.id}
                        disabled={fieldsLocked}
                      />
                      <div className="contest-organizer-criteria-actions">
                        {nominations.length > 1 ? (
                          <span className="reorder-icon-actions">
                            <button
                              type="button"
                              className="reorder-icon-btn"
                              onClick={() => void moveNomination(index, -1)}
                              disabled={fieldsLocked || nomOrderBusy || index === 0}
                              aria-label="Переместить номинацию выше"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="reorder-icon-btn"
                              onClick={() => void moveNomination(index, 1)}
                              disabled={fieldsLocked || nomOrderBusy || index >= nominations.length - 1}
                              aria-label="Переместить номинацию ниже"
                            >
                              ↓
                            </button>
                          </span>
                        ) : null}
                        <Button
                          type="button"
                          variant="danger"
                          size="small"
                          onClick={() => handleDeleteNom(n.id)}
                          disabled={fieldsLocked || nomOrderBusy}
                        >
                          Удалить
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              }

              const { primary, secondary } = nominationPrimarySecondary(n.title, n.description || '');
              return (
                <li key={n.id}>
                  <>
                    {nominationsPublicCompact ? (
                      <div className="contest-organizer-criteria-nom-inline">
                        <span className="contest-organizer-criteria-nom-inline-lead" aria-hidden>
                          {(n.logo_url || '').trim() ? (
                            <img
                              className="contest-organizer-criteria-nom-inline-logo"
                              src={resolvePublicAssetUrl((n.logo_url || '').trim())}
                              alt=""
                            />
                          ) : (
                            <NominationCategoryGlyph />
                          )}
                        </span>
                        <div className="contest-organizer-criteria-nom-inline-text">
                          <span className="contest-organizer-criteria-nom-inline-title">{primary}</span>
                          {secondary ? (
                            <span className="contest-organizer-criteria-nom-inline-desc">{secondary}</span>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div className="contest-organizer-criteria-nom-block">
                        <div className="contest-organizer-criteria-nom-head">
                          <div className="contest-organizer-criteria-nom-head-aside">
                            {(n.logo_url || '').trim() ? (
                              <div className="contest-organizer-criteria-nom-logo-thumb" aria-hidden>
                                <img src={resolvePublicAssetUrl((n.logo_url || '').trim())} alt="" />
                              </div>
                            ) : null}
                          </div>
                          <div className="contest-organizer-criteria-nom-head-text">
                            <strong className="contest-organizer-criteria-nom-title">{primary}</strong>
                            {secondary ? (
                              <span className="contest-organizer-criteria-desc">{secondary}</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                </li>
              );
            })}
          </ul>
          {nominationsPublicCompact && contestPhotoHint && nominations.length > 0 ? (
            <p className="contest-organizer-criteria-nom-list-footnote">{contestPhotoHint}</p>
          ) : null}
          </>
        )}
        {canEdit ? (
          <div className="contest-organizer-criteria-form">
            <Button type="button" disabled={fieldsLocked || nomAddBusy} onClick={() => void handleAddNomination()}>
              Добавить номинацию
            </Button>
          </div>
        ) : null}
      </div>
      ) : null}

      {juryCriteriaInPanel ? juryCriteriaBlock : null}
      {juryCriteriaPortaled ? createPortal(juryCriteriaBlock, juryCriteriaPortalHost) : null}
    </section>
  );
  }
);
