import React from 'react';
import './NominationTabsBar.css';

export type NominationTabsBarItem = { id: string; label: string };

export type NominationTabsBarProps = {
  tabs: NominationTabsBarItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Первая кнопка «все номинации» (id по умолчанию `all`) */
  allTab?: { id?: string; label: string };
  ariaLabel?: string;
  /** В строке жюри есть не только вкладки — внешний контейнер как toolbar */
  variant?: 'tablist' | 'toolbar';
  className?: string;
  rowClassName?: string;
  /** Элементы справа в той же строке (например «Мне нравится») */
  trailing?: React.ReactNode;
};

/**
 * Общий переключатель номинаций (чипы): как в галерее участников конкурса.
 */
export const NominationTabsBar: React.FC<NominationTabsBarProps> = ({
  tabs,
  selectedId,
  onSelect,
  allTab,
  ariaLabel = 'Фильтр по номинации',
  variant = 'tablist',
  className = '',
  rowClassName = '',
  trailing = null,
}) => {
  const allId = allTab?.id ?? 'all';
  const outerRole = variant === 'toolbar' ? 'toolbar' : 'tablist';

  return (
    <div className={`nomination-tabs-bar ${className}`.trim()} role={outerRole} aria-label={ariaLabel}>
      <div className={`nomination-tabs-bar__row ${rowClassName}`.trim()}>
        {allTab ? (
          <button
            type="button"
            role="tab"
            aria-selected={selectedId === allId}
            className={
              selectedId === allId
                ? 'nomination-tabs-bar__tab nomination-tabs-bar__tab--active'
                : 'nomination-tabs-bar__tab'
            }
            onClick={() => onSelect(allId)}
          >
            {allTab.label}
          </button>
        ) : null}
        {tabs.map((t) => {
          const active = selectedId === t.id;
          return (
            <button
              key={t.id || '__empty__'}
              type="button"
              role="tab"
              aria-selected={active}
              className={
                active
                  ? 'nomination-tabs-bar__tab nomination-tabs-bar__tab--active'
                  : 'nomination-tabs-bar__tab'
              }
              onClick={() => onSelect(t.id)}
            >
              {t.label}
            </button>
          );
        })}
        {trailing}
      </div>
    </div>
  );
};
