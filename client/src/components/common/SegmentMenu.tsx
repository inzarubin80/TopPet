import React from 'react';
import './SegmentMenu.css';

type SegmentMenuItem<T extends string> = {
  key: T;
  label: string;
  icon?: React.ReactNode;
};

type SegmentMenuProps<T extends string> = {
  items: SegmentMenuItem<T>[];
  activeKey: T;
  onChange: (nextKey: T) => void;
  /** Если обёртка (например nav) уже даёт имя — можно не передавать */
  ariaLabel?: string;
  className?: string;
  variant?: 'default' | 'contest';
};

function SegmentMenu<T extends string>({
  items,
  activeKey,
  onChange,
  ariaLabel,
  className,
  variant = 'default',
}: SegmentMenuProps<T>): React.ReactElement {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onChange(items[index].key);
      return;
    }

    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }

    event.preventDefault();
    const nextIndex =
      event.key === 'ArrowLeft'
        ? (index - 1 + items.length) % items.length
        : (index + 1) % items.length;
    onChange(items[nextIndex].key);
  };

  return (
    <div
      className={
        className
          ? `segment-menu segment-menu--${variant} ${className}`
          : `segment-menu segment-menu--${variant}`
      }
      role="tablist"
      aria-label={ariaLabel || undefined}
    >
      {items.map((item, index) => {
        const isActive = item.key === activeKey;
        return (
          <button
            key={item.key}
            type="button"
            className={isActive ? 'segment-menu-item segment-menu-item--active' : 'segment-menu-item'}
            onClick={() => onChange(item.key)}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {item.icon ? <span className="segment-menu-item-icon">{item.icon}</span> : null}
            <span className="segment-menu-item-label">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export type { SegmentMenuItem, SegmentMenuProps };
export { SegmentMenu };
