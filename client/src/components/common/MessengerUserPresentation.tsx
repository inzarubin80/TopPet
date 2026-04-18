import React, { useState } from 'react';
import { getMessengerAvatarColor, getMessengerInitials } from '../../utils/messengerAvatar';
import { resolvePublicAssetUrl } from '../../utils/seo';
import './MessengerUserPresentation.css';

export type MessengerUserAvatarProps = {
  userId: number;
  userName: string;
  userAvatarUrl?: string;
  /** sm — 36px (шапка), md — 42px (чат), lg — 56px */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

/** Круглый аватар как в мессенджере: фото или цвет + инициалы */
export const MessengerUserAvatar: React.FC<MessengerUserAvatarProps> = ({
  userId,
  userName,
  userAvatarUrl,
  size = 'md',
  className = '',
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const raw = userAvatarUrl?.trim();
  const resolved = raw ? resolvePublicAssetUrl(raw) : '';
  const avatarColor = getMessengerAvatarColor(userId);
  const initials = getMessengerInitials(userName || '?');
  const sizeClass = `messenger-user-avatar--${size}`;
  const rootClass = ['messenger-user-avatar', sizeClass, className].filter(Boolean).join(' ');

  if (resolved && !imgFailed) {
    return (
      <div className={`${rootClass} messenger-user-avatar--photo`.trim()} title={userName}>
        <img
          className="messenger-user-avatar-img"
          src={resolved}
          alt=""
          decoding="async"
          onError={() => setImgFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className={rootClass} style={{ backgroundColor: avatarColor }} title={userName}>
      {initials}
    </div>
  );
};

export type MessengerUserPresentationProps = {
  userId: number;
  name: string;
  avatarUrl?: string;
  /** Вторая строка (фрагмент email, подпись и т.д.) */
  subtitle?: React.ReactNode;
  size?: 'sm' | 'md';
  className?: string;
};

/**
 * Строка «аватар + имя + подпись» в стиле списка чата — переиспользуемая обёртка.
 */
export const MessengerUserPresentation: React.FC<MessengerUserPresentationProps> = ({
  userId,
  name,
  avatarUrl,
  subtitle,
  size = 'sm',
  className = '',
}) => {
  const root = ['messenger-user-presentation', `messenger-user-presentation--${size}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={root}>
      <MessengerUserAvatar userId={userId} userName={name} userAvatarUrl={avatarUrl} size={size} />
      <div className="messenger-user-presentation-text">
        <span className="messenger-user-presentation-name">{name}</span>
        {subtitle != null && subtitle !== '' ? (
          <span className="messenger-user-presentation-subtitle">{subtitle}</span>
        ) : null}
      </div>
    </div>
  );
};
