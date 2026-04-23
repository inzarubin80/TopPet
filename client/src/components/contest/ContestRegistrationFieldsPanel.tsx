import React, { useCallback, useEffect, useImperativeHandle, useState, forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { Contest, RegistrationField, RegistrationFieldInput, RegistrationFieldType } from '../../types/models';
import { listRegistrationFields, replaceRegistrationFields } from '../../api/registrationFieldsApi';
import { Button } from '../common/Button';
import '../common/ReorderIconButtons.css';
import { useToast } from '../../contexts/ToastContext';
import { errorHandler } from '../../utils/errorHandler';
import './ContestRegistrationFieldsPanel.css';

export type ContestRegistrationFieldsPanelHandle = {
  saveRegistrationFields: (opts?: { quietSuccess?: boolean }) => Promise<boolean>;
};

interface Props {
  contest: Contest;
  isAdmin: boolean;
  /** Скрыть заголовок блока (когда заголовок уже задан контейнером страницы). */
  hideTitle?: boolean;
  readOnly?: boolean;
  /** Скрыть кнопку сохранения (общее сохранение страницы). */
  hideSaveButton?: boolean;
  formDisabled?: boolean;
}

type DraftRegistrationFieldRow = RegistrationFieldInput & { rowKey: string };

const emptyField = (): DraftRegistrationFieldRow => ({
  label: '',
  field_type: 'string',
  required: false,
  help_text: '',
  rowKey: crypto.randomUUID(),
});

function serverToDraft(rows: RegistrationField[]): DraftRegistrationFieldRow[] {
  if (rows.length === 0) {
    return [emptyField()];
  }
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    field_type: r.field_type,
    required: r.required,
    enum_options: r.enum_options ? [...r.enum_options] : undefined,
    help_text: r.help_text ?? '',
    rowKey: r.id,
  }));
}

function rowToPayload(row: DraftRegistrationFieldRow): RegistrationFieldInput {
  const { rowKey: _rowKey, ...rest } = row;
  return rest;
}

export const ContestRegistrationFieldsPanel = forwardRef<ContestRegistrationFieldsPanelHandle, Props>(
  function ContestRegistrationFieldsPanel(
    { contest, isAdmin, hideTitle = false, readOnly = false, hideSaveButton = false, formDisabled = false },
    ref
  ) {
    const { showError, showSuccess } = useToast();
    const [draft, setDraft] = useState<DraftRegistrationFieldRow[]>([emptyField()]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const canEdit = !readOnly && isAdmin;
    const fieldsLocked = formDisabled || !canEdit;

    const load = useCallback(async () => {
      setLoading(true);
      try {
        const rows = await listRegistrationFields(contest.id);
        setDraft(serverToDraft(rows));
      } catch (e) {
        errorHandler.handleError(e, showError, false);
        showError('Не удалось загрузить поля заявки');
      } finally {
        setLoading(false);
      }
    }, [contest.id, showError]);

    useEffect(() => {
      load();
    }, [load]);

    const persist = useCallback(
      async (opts?: { quietSuccess?: boolean }): Promise<boolean> => {
        if (!canEdit) {
          return true;
        }
        const items = draft
          .filter((x) => x.label.trim() !== '')
          .map((row) => {
            const base = rowToPayload(row);
            return {
              ...base,
              label: base.label.trim(),
              field_type: base.field_type,
              help_text: (base.help_text ?? '').trim(),
              enum_options:
                base.field_type === 'enum'
                  ? (base.enum_options || []).map((s) => s.trim()).filter(Boolean)
                  : undefined,
            };
          });
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          if (it.field_type === 'enum' && (!it.enum_options || it.enum_options.length < 1)) {
            showError(`Поле «${it.label}»: укажите варианты перечисления`);
            return false;
          }
        }
        setSaving(true);
        try {
          const saved = await replaceRegistrationFields(contest.id, items);
          setDraft(serverToDraft(saved));
          if (!opts?.quietSuccess) {
            showSuccess('Поля заявки сохранены');
          }
          return true;
        } catch (e) {
          errorHandler.handleError(e, showError, false);
          showError('Не удалось сохранить поля заявки');
          return false;
        } finally {
          setSaving(false);
        }
      },
      [canEdit, contest.id, draft, showError, showSuccess]
    );

    useImperativeHandle(
      ref,
      () => ({
        saveRegistrationFields: (opts) => persist(opts),
      }),
      [persist]
    );

    const moveRow = (from: number, to: number) => {
      if (to < 0 || to >= draft.length) {
        return;
      }
      setDraft((prev) => {
        const next = [...prev];
        const [removed] = next.splice(from, 1);
        next.splice(to, 0, removed);
        return next;
      });
    };

    if (loading) {
      return <p className="contest-registration-fields-muted">Загрузка полей заявки…</p>;
    }

    return (
      <section className="contest-registration-fields">
        {!hideTitle ? <h2 className="contest-registration-fields-title">Поля заявки участника</h2> : null}
        <p className="contest-registration-fields-hint">
          Дополнительные вопросы при подаче заявки (фото, видео и номинация — в форме участия). Типы: строка, многострочный
          текст, число, да/нет, список вариантов, картинка (файл в заявке). Пояснение к полю видно участнику под подписью при
          заполнении заявки.
          {readOnly ? (
            isAdmin ? (
              <>
                {' '}
                Редактировать можно на{' '}
                <Link to={`/contests/${contest.id}/edit`}>странице редактирования конкурса</Link>.
              </>
            ) : null
          ) : hideSaveButton ? (
            <> Сохраните изменения кнопкой «Сохранить изменения» вверху или внизу страницы редактирования конкурса.</>
          ) : (
            <> Сохраните изменения кнопкой ниже.</>
          )}
        </p>

        <div className="contest-registration-fields-list">
          {draft.map((row, idx) => (
            <div key={row.rowKey} className="contest-registration-fields-row">
              <input
                type="text"
                placeholder="Подпись поля"
                value={row.label}
                disabled={fieldsLocked}
                className="contest-registration-fields-input"
                onChange={(e) => {
                  const next = [...draft];
                  next[idx] = { ...next[idx], label: e.target.value };
                  setDraft(next);
                }}
              />
              <select
                value={row.field_type}
                disabled={fieldsLocked}
                className="contest-registration-fields-select"
                onChange={(e) => {
                  const next = [...draft];
                  const t = e.target.value as RegistrationFieldType;
                  next[idx] = {
                    ...next[idx],
                    field_type: t,
                    enum_options: t === 'enum' ? next[idx].enum_options || [''] : undefined,
                  };
                  setDraft(next);
                }}
              >
                <option value="string">Строка</option>
                <option value="textarea">Многострочный текст</option>
                <option value="number">Число</option>
                <option value="boolean">Да / нет</option>
                <option value="enum">Перечисление</option>
                <option value="image">Картинка</option>
              </select>
              <label className="contest-registration-fields-check">
                <input
                  type="checkbox"
                  checked={row.required}
                  disabled={fieldsLocked}
                  onChange={(e) => {
                    const next = [...draft];
                    next[idx] = { ...next[idx], required: e.target.checked };
                    setDraft(next);
                  }}
                />
                Обязательное
              </label>
              {row.field_type === 'enum' && (
                <textarea
                  placeholder="Варианты, по одному в строке"
                  value={(row.enum_options || []).join('\n')}
                  disabled={fieldsLocked}
                  rows={3}
                  className="contest-registration-fields-textarea"
                  onChange={(e) => {
                    const next = [...draft];
                    const lines = e.target.value.split('\n').map((s) => s.trim());
                    next[idx] = { ...next[idx], enum_options: lines };
                    setDraft(next);
                  }}
                />
              )}
              <textarea
                placeholder="Пояснение для участника (необязательно)"
                value={row.help_text ?? ''}
                disabled={fieldsLocked}
                rows={2}
                className="contest-registration-fields-help"
                onChange={(e) => {
                  const next = [...draft];
                  next[idx] = { ...next[idx], help_text: e.target.value };
                  setDraft(next);
                }}
              />
              {canEdit && (
                <div className="contest-registration-fields-row-actions">
                  <span className="reorder-icon-actions">
                    <button
                      type="button"
                      className="reorder-icon-btn"
                      disabled={fieldsLocked || idx === 0}
                      aria-label="Переместить поле выше"
                      onClick={() => moveRow(idx, idx - 1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="reorder-icon-btn"
                      disabled={fieldsLocked || idx === draft.length - 1}
                      aria-label="Переместить поле ниже"
                      onClick={() => moveRow(idx, idx + 1)}
                    >
                      ↓
                    </button>
                  </span>
                  <Button
                    type="button"
                    variant="danger"
                    size="small"
                    disabled={fieldsLocked}
                    onClick={() => setDraft((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    Удалить
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

        {canEdit && (
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={fieldsLocked}
              onClick={() => setDraft((prev) => [...prev, emptyField()])}
            >
              Добавить поле
            </Button>
            {!hideSaveButton && (
              <div className="contest-registration-fields-save">
                <Button type="button" onClick={() => void persist()} disabled={saving || fieldsLocked}>
                  {saving ? 'Сохранение…' : 'Сохранить поля заявки'}
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    );
  }
);
