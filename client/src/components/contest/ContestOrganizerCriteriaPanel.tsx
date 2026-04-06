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
});

export const ContestOrganizerCriteriaPanel = forwardRef<ContestOrganizerCriteriaPanelHandle, Props>(
  function ContestOrganizerCriteriaPanel(
    {
      contest,
      isAdmin,
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
  const [nomTitle, setNomTitle] = useState('');
  const [nomDesc, setNomDesc] = useState('');
  const [nomMinPhotos, setNomMinPhotos] = useState(1);
  const [nomMaxPhotos, setNomMaxPhotos] = useState(30);
  const [editingNomId, setEditingNomId] = useState<string | null>(null);
  const [editNomTitle, setEditNomTitle] = useState('');
  const [editNomDesc, setEditNomDesc] = useState('');
  const [editNomMinPhotos, setEditNomMinPhotos] = useState(1);
  const [editNomMaxPhotos, setEditNomMaxPhotos] = useState(30);
  const [logoUploadingNomId, setLogoUploadingNomId] = useState<string | null>(null);
  const [nomOrderBusy, setNomOrderBusy] = useState(false);

  const canEdit = !readOnly && isAdmin;
  const fieldsLocked = formDisabled || !canEdit;
  const audienceView = audienceModeProp ?? (readOnly && !isAdmin);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [noms, crit] = await Promise.all([
        listNominations(contest.id),
        listJuryCriteria(contest.id),
      ]);
      setNominations([...noms].sort(sortNominationsByOrder));
      if (crit.length > 0) {
        setCriteriaDraft(
          crit.map((c) => ({
            id: c.id,
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
            ? saved.map((c) => ({
                id: c.id,
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
    [canEdit, criteriaDraft, contest.id, showError, showSuccess, showJuryCriteriaSection]
  );

  useImperativeHandle(
    ref,
    () => ({
      saveJuryCriteria: (opts) => persistJuryCriteria(opts),
    }),
    [persistJuryCriteria]
  );

  const clampNominationPhotoBound = (v: number) => Math.min(30, Math.max(1, Math.round(v) || 1));
  const pairNominationPhotoBounds = (minRaw: number, maxRaw: number) => {
    const min = clampNominationPhotoBound(minRaw);
    const max = Math.max(min, clampNominationPhotoBound(maxRaw));
    return { min, max };
  };

  const handleAddNomination = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomTitle.trim()) {
      showError('Название номинации обязательно');
      return;
    }
    const { min, max } = pairNominationPhotoBounds(nomMinPhotos, nomMaxPhotos);
    try {
      const n = await createNomination(contest.id, {
        title: nomTitle.trim(),
        description: nomDesc.trim(),
        min_photo_count: min,
        max_photo_count: max,
      });
      setNominations((prev) => [...prev, n].sort(sortNominationsByOrder));
      setNomTitle('');
      setNomDesc('');
      setNomMinPhotos(1);
      setNomMaxPhotos(30);
      showSuccess('Номинация добавлена');
    } catch (err) {
      errorHandler.handleError(err, showError, false);
      showError('Не удалось добавить номинацию');
    }
  };

  const startEditNom = (id: string, title: string, description: string, minPhotos: number, maxPhotos: number) => {
    setEditingNomId(id);
    setEditNomTitle(title);
    setEditNomDesc(description || '');
    const { min, max } = pairNominationPhotoBounds(minPhotos, maxPhotos);
    setEditNomMinPhotos(min);
    setEditNomMaxPhotos(max);
  };

  const saveEditNom = async () => {
    if (!editingNomId || !editNomTitle.trim()) return;
    const { min, max } = pairNominationPhotoBounds(editNomMinPhotos, editNomMaxPhotos);
    try {
      const updated = await updateNomination(contest.id, editingNomId, {
        title: editNomTitle.trim(),
        description: editNomDesc.trim(),
        min_photo_count: min,
        max_photo_count: max,
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
          {audienceView ? 'По чему жюри оценивает работы' : 'Критерии оценки (на конкурс)'}
        </h2>
        {!canEdit && (
          <ul
            className={
              audienceView
                ? 'contest-organizer-criteria-list contest-organizer-criteria-jury-readonly-list contest-organizer-criteria-jury-readonly-list--audience'
                : 'contest-organizer-criteria-list contest-organizer-criteria-jury-readonly-list'
            }
          >
            {criteriaDraft.filter((c) => c.title.trim()).map((c, idx) => {
              const { primary, secondary } = criterionPrimarySecondary(c);
              const scaleText = audienceView
                ? juryScaleAudiencePhrase(c.scale_min, c.scale_max, c.scale_step)
                : juryScaleOrganizerPhrase(c.scale_min, c.scale_max, c.scale_step);
              return (
                <li key={c.id ?? `jury-ro-${idx}`}>
                  {audienceView ? (
                    <div className="contest-organizer-criteria-jury-card contest-organizer-criteria-jury-card--audience">
                      <div className="contest-organizer-criteria-criterion-audience-title">{primary}</div>
                      {secondary ? (
                        <p className="contest-organizer-criteria-criterion-audience-desc">{secondary}</p>
                      ) : null}
                      <span className="contest-organizer-criteria-scale contest-organizer-criteria-scale--audience">
                        {scaleText}
                      </span>
                    </div>
                  ) : (
                    <div className="contest-organizer-criteria-jury-card">
                      <strong className="contest-organizer-criteria-jury-card-title">{primary}</strong>
                      {secondary ? (
                        <span className="contest-organizer-criteria-jury-card-desc">{secondary}</span>
                      ) : null}
                      <span className="contest-organizer-criteria-jury-card-meta">{scaleText}</span>
                    </div>
                  )}
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
            </div>
            {canEdit && criteriaDraft.length > 1 ? (
              <div className="contest-organizer-criteria-actions">
                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  onClick={() => moveCriterion(idx, -1)}
                  disabled={fieldsLocked || idx === 0}
                  aria-label="Переместить критерий выше"
                >
                  Вверх
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  onClick={() => moveCriterion(idx, 1)}
                  disabled={fieldsLocked || idx >= criteriaDraft.length - 1}
                  aria-label="Переместить критерий ниже"
                >
                  Вниз
                </Button>
                <Button
                  type="button"
                  variant="secondary"
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

  return (
    <section
      className={
        audienceView
          ? 'contest-organizer-criteria contest-organizer-criteria--audience'
          : 'contest-organizer-criteria'
      }
    >
      <h2 className="contest-section-heading contest-organizer-criteria-title">{sectionTitle}</h2>
      {!readOnly ? (
        <p className="contest-organizer-criteria-hint">Сохраните изменения кнопкой внизу блока.</p>
      ) : null}

      <div className="contest-organizer-criteria-block">
        {audienceView ? <h3 className="contest-section-subheading">Список категорий</h3> : null}
        {nominations.length === 0 && !canEdit ? (
          <p className="contest-organizer-criteria-muted">
            {audienceView ? 'Организатор пока не указал категории участия.' : 'Номинации не заданы.'}
          </p>
        ) : (
          <ul
            className={
              audienceView
                ? 'contest-organizer-criteria-list contest-organizer-criteria-list--audience'
                : 'contest-organizer-criteria-list'
            }
          >
            {nominations.map((n, index) => {
              const { primary, secondary } = nominationPrimarySecondary(n.title, n.description || '');
              const photoHint =
                nominationPhotoRangeAudienceHint(n.min_photo_count, n.max_photo_count) ??
                minPhotosAudienceHint(n.min_photo_count);
              return (
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
                      <label className="contest-organizer-criteria-nom-photos">
                        Минимум фото в заявке
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={editNomMinPhotos}
                          onChange={(e) => setEditNomMinPhotos(Number(e.target.value))}
                          disabled={fieldsLocked}
                          className="contest-organizer-criteria-input contest-organizer-criteria-input-narrow"
                        />
                      </label>
                      <label className="contest-organizer-criteria-nom-photos">
                        Максимум фото в заявке
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={editNomMaxPhotos}
                          onChange={(e) => setEditNomMaxPhotos(Number(e.target.value))}
                          disabled={fieldsLocked}
                          className="contest-organizer-criteria-input contest-organizer-criteria-input-narrow"
                        />
                      </label>
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
                      {audienceView ? (
                        <div className="contest-organizer-criteria-nom-card contest-organizer-criteria-nom-card--row">
                          {(n.logo_url || '').trim() ? (
                            <div className="contest-organizer-criteria-nom-card-thumb">
                              <img
                                src={resolvePublicAssetUrl((n.logo_url || '').trim())}
                                alt=""
                              />
                            </div>
                          ) : null}
                          <div className="contest-organizer-criteria-nom-card-body">
                            <div className="contest-organizer-criteria-nom-card-title">{primary}</div>
                            {secondary ? (
                              <p className="contest-organizer-criteria-nom-card-desc">{secondary}</p>
                            ) : null}
                            {photoHint ? (
                              <span className="contest-organizer-criteria-nom-meta contest-organizer-criteria-nom-meta--audience">
                                {photoHint}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <div className="contest-organizer-criteria-nom-block">
                          <div className="contest-organizer-criteria-nom-head">
                            <div className="contest-organizer-criteria-nom-head-aside">
                              {canEdit ? (
                                <ContestAssetImageField
                                  compact
                                  legend="Логотип"
                                  url={n.logo_url || ''}
                                  onPickFile={(file) => void handleNominationLogoFile(n.id, file)}
                                  onClear={() => void handleClearNominationLogo(n.id)}
                                  uploading={logoUploadingNomId === n.id}
                                  disabled={fieldsLocked}
                                />
                              ) : (n.logo_url || '').trim() ? (
                                <div className="contest-organizer-criteria-nom-logo-thumb" aria-hidden>
                                  <img
                                    src={resolvePublicAssetUrl((n.logo_url || '').trim())}
                                    alt=""
                                  />
                                </div>
                              ) : null}
                            </div>
                            <div className="contest-organizer-criteria-nom-head-text">
                              <strong className="contest-organizer-criteria-nom-title">{primary}</strong>
                              {secondary ? (
                                <span className="contest-organizer-criteria-desc">{secondary}</span>
                              ) : null}
                              <span className="contest-organizer-criteria-nom-meta">
                                Мин. фото: {n.min_photo_count ?? 1} · Макс. фото: {n.max_photo_count ?? 30}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                      {canEdit && (
                        <div className="contest-organizer-criteria-actions">
                          {nominations.length > 1 ? (
                            <>
                              <Button
                                type="button"
                                variant="secondary"
                                size="small"
                                onClick={() => void moveNomination(index, -1)}
                                disabled={fieldsLocked || nomOrderBusy || index === 0}
                                aria-label="Переместить номинацию выше"
                              >
                                Вверх
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="small"
                                onClick={() => void moveNomination(index, 1)}
                                disabled={
                                  fieldsLocked ||
                                  nomOrderBusy ||
                                  index >= nominations.length - 1
                                }
                                aria-label="Переместить номинацию ниже"
                              >
                                Вниз
                              </Button>
                            </>
                          ) : null}
                          <Button
                            type="button"
                            variant="secondary"
                            size="small"
                            onClick={() =>
                              startEditNom(
                                n.id,
                                n.title,
                                n.description,
                                n.min_photo_count ?? 1,
                                n.max_photo_count ?? 30
                              )
                            }
                            disabled={fieldsLocked || nomOrderBusy}
                          >
                            Изменить
                          </Button>
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
                      )}
                    </>
                  )}
                </li>
              );
            })}
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
            <label className="contest-organizer-criteria-nom-photos">
              Минимум фото в заявке
              <input
                type="number"
                min={1}
                max={30}
                value={nomMinPhotos}
                onChange={(e) => setNomMinPhotos(Number(e.target.value))}
                disabled={fieldsLocked}
                className="contest-organizer-criteria-input contest-organizer-criteria-input-narrow"
              />
            </label>
            <label className="contest-organizer-criteria-nom-photos">
              Максимум фото в заявке
              <input
                type="number"
                min={1}
                max={30}
                value={nomMaxPhotos}
                onChange={(e) => setNomMaxPhotos(Number(e.target.value))}
                disabled={fieldsLocked}
                className="contest-organizer-criteria-input contest-organizer-criteria-input-narrow"
              />
            </label>
            <Button type="submit" disabled={fieldsLocked}>
              Добавить номинацию
            </Button>
          </form>
        )}
      </div>

      {juryCriteriaInPanel ? juryCriteriaBlock : null}
      {juryCriteriaPortaled ? createPortal(juryCriteriaBlock, juryCriteriaPortalHost) : null}
    </section>
  );
  }
);
