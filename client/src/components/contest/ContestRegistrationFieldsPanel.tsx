import React, { useCallback, useEffect, useImperativeHandle, useState, forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { Contest, RegistrationField, RegistrationFieldInput, RegistrationFieldType } from '../../types/models';
import { listRegistrationFields, replaceRegistrationFields } from '../../api/registrationFieldsApi';
import { Button } from '../common/Button';
import { useToast } from '../../contexts/ToastContext';
import { errorHandler } from '../../utils/errorHandler';
import './ContestRegistrationFieldsPanel.css';

export type ContestRegistrationFieldsPanelHandle = {
  saveRegistrationFields: (opts?: { quietSuccess?: boolean }) => Promise<boolean>;
};

interface Props {
  contest: Contest;
  isAdmin: boolean;
  readOnly?: boolean;
  /** Скрыть кнопку сохранения (общее сохранение страницы). */
  hideSaveButton?: boolean;
  formDisabled?: boolean;
}

const emptyField = (): RegistrationFieldInput => ({
  label: '',
  field_type: 'string',
  required: false,
});

function serverToDraft(rows: RegistrationField[]): RegistrationFieldInput[] {
  if (rows.length === 0) {
    return [emptyField()];
  }
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    field_type: r.field_type,
    required: r.required,
    enum_options: r.enum_options ? [...r.enum_options] : undefined,
  }));
}

export const ContestRegistrationFieldsPanel = forwardRef<ContestRegistrationFieldsPanelHandle, Props>(
  function ContestRegistrationFieldsPanel(
    { contest, isAdmin, readOnly = false, hideSaveButton = false, formDisabled = false },
    ref
  ) {
    const { showError, showSuccess } = useToast();
    const [draft, setDraft] = useState<RegistrationFieldInput[]>([emptyField()]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const canEdit = !readOnly && isAdmin && contest.status === 'draft';
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
          .map((x, idx) => ({
            ...x,
            label: x.label.trim(),
            field_type: x.field_type,
            enum_options:
              x.field_type === 'enum' ? (x.enum_options || []).map((s) => s.trim()).filter(Boolean) : undefined,
          }));
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

    if (loading) {
      return <p className="contest-registration-fields-muted">Загрузка полей заявки…</p>;
    }

    return (
      <section className="contest-registration-fields">
        <h2 className="contest-registration-fields-title">Поля заявки участника</h2>
        <p className="contest-registration-fields-hint">
          Дополнительные вопросы при подаче заявки (кличка и описание питомца задаются отдельно). Типы: текст, число,
          да/нет, список вариантов.
          {readOnly ? (
            isAdmin && contest.status === 'draft' ? (
              <>
                {' '}
                Редактировать можно на{' '}
                <Link to={`/contests/${contest.id}/edit`}>странице редактирования конкурса</Link>.
              </>
            ) : null
          ) : (
            <> Настройка — в статусе «Черновик».</>
          )}
        </p>

        <div className="contest-registration-fields-list">
          {draft.map((row, idx) => (
            <div key={idx} className="contest-registration-fields-row">
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
                <option value="number">Число</option>
                <option value="boolean">Да / нет</option>
                <option value="enum">Перечисление</option>
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
              {canEdit && draft.length > 1 && (
                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  disabled={fieldsLocked}
                  onClick={() => setDraft((prev) => prev.filter((_, i) => i !== idx))}
                >
                  Удалить
                </Button>
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
