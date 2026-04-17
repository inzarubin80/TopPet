import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { buildLoginUrl, saveProfileLoginReferrer, saveProfileReferrer } from '../../utils/navigation';
import { canCreateContests } from '../../utils/contestPermissions';
import { BRAND_NAME, BRAND_TAGLINE } from '../../config/brand';
import {
  fetchStaffCommentNotifications,
  clearStaffNotifications,
} from '../../store/slices/notificationsSlice';
import './AppHeader.css';

export const AppHeader: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch<AppDispatch>();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const { items: staffNotifications, totalUnread: staffUnreadTotal } = useSelector(
    (state: RootState) => state.notifications
  );

  const [staffNotifOpen, setStaffNotifOpen] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const adminMenuRef = useRef<HTMLDivElement | null>(null);

  const isSystemAdmin = user?.role === 'system_admin';
  const mayCreateContest = isAuthenticated && canCreateContests(user);
  const showAdminMenu = mayCreateContest || isSystemAdmin;

  useEffect(() => {
    if (!isAuthenticated) {
      dispatch(clearStaffNotifications());
      setStaffNotifOpen(false);
      return;
    }
    void dispatch(fetchStaffCommentNotifications());
    const intervalId = window.setInterval(() => {
      void dispatch(fetchStaffCommentNotifications());
    }, 45000);
    return () => clearInterval(intervalId);
  }, [dispatch, isAuthenticated]);

  useEffect(() => {
    setStaffNotifOpen(false);
    setAdminMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!adminMenuOpen) {
      return;
    }
    const handleOutsideClick = (event: MouseEvent) => {
      if (!adminMenuRef.current?.contains(event.target as Node)) {
        setAdminMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAdminMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [adminMenuOpen]);

  const handleProfileClick = () => {
    if (!isAuthenticated) {
      saveProfileLoginReferrer(location.pathname + location.search);
      navigate(buildLoginUrl('/profile'));
      return;
    }
    // Сохраняем текущий URL перед переходом на профиль
    // НО: не сохраняем, если мы уже на странице профиля
    if (location.pathname !== '/profile') {
      saveProfileReferrer(location.pathname + location.search);
    }
    navigate('/profile');
  };

  const avatarUrl = user?.avatar_url;

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <button type="button" className="app-header-brand" onClick={() => navigate('/')}>
          <span className="app-header-logo">{BRAND_NAME}</span>
          <span className="app-header-tagline">{BRAND_TAGLINE}</span>
        </button>
        <div className="app-header-actions">
          {showAdminMenu ? (
            <div className="app-header-admin-wrap" ref={adminMenuRef}>
              <button
                type="button"
                className="app-header-admin-trigger"
                onClick={() => setAdminMenuOpen((prev) => !prev)}
                aria-expanded={adminMenuOpen}
                aria-haspopup="menu"
                aria-label="Меню управления"
              >
                Управление
                <svg className="app-header-admin-trigger-icon" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
              {adminMenuOpen ? (
                <div className="app-header-admin-dropdown" role="menu" aria-label="Меню управления">
                  {mayCreateContest ? (
                    <button
                      type="button"
                      className="app-header-admin-item"
                      role="menuitem"
                      onClick={() => {
                        setAdminMenuOpen(false);
                        navigate('/contests/new/edit');
                      }}
                    >
                      Создать конкурс
                    </button>
                  ) : null}
                  {isSystemAdmin ? (
                    <button
                      type="button"
                      className="app-header-admin-item"
                      role="menuitem"
                      onClick={() => {
                        setAdminMenuOpen(false);
                        navigate('/admin/users');
                      }}
                    >
                      Список пользователей
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {isAuthenticated && (
            <div className="app-header-notifications-wrap">
              <button
                type="button"
                className="app-header-notifications-btn"
                onClick={() => {
                  setStaffNotifOpen((o) => !o);
                  void dispatch(fetchStaffCommentNotifications());
                }}
                aria-label="Комментарии организатора"
                aria-expanded={staffNotifOpen}
              >
                <svg className="app-header-notifications-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {staffUnreadTotal > 0 ? (
                  <span className="app-header-notifications-badge">
                    {staffUnreadTotal > 99 ? '99+' : staffUnreadTotal}
                  </span>
                ) : null}
              </button>
              {staffNotifOpen ? (
                <div className="app-header-notifications-dropdown" role="menu">
                  <div className="app-header-notifications-dropdown-title">Комментарии организатора</div>
                  {staffNotifications.length === 0 ? (
                    <p className="app-header-notifications-empty">Нет непрочитанных комментариев</p>
                  ) : (
                    <ul className="app-header-notifications-list">
                      {staffNotifications.map((n) => (
                        <li key={n.participant_id}>
                          <button
                            type="button"
                            className="app-header-notifications-item"
                            role="menuitem"
                            onClick={() => {
                              setStaffNotifOpen(false);
                              navigate(
                                `/contests/${n.contest_id}/participants/${n.participant_id}#participant-comments`
                              );
                            }}
                          >
                            <span className="app-header-notifications-item-title">{n.contest_title}</span>
                            <span className="app-header-notifications-item-pet">{n.pet_name}</span>
                            {n.unread_count > 1 ? (
                              <span className="app-header-notifications-item-count">{n.unread_count} новых</span>
                            ) : null}
                            {n.latest_comment_preview ? (
                              <span className="app-header-notifications-item-preview">{n.latest_comment_preview}</span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
          )}
          <button type="button" className="app-header-profile" onClick={handleProfileClick}>
          <span className="app-header-avatar">
            {avatarUrl ? (
              <img className="app-header-avatar-img" src={avatarUrl} alt="Профиль" />
            ) : (
              <svg className="app-header-avatar-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0 2c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5z"
                  fill="currentColor"
                />
              </svg>
            )}
          </span>
          <span className="app-header-profile-text">{user?.name || 'Профиль'}</span>
        </button>
        </div>
      </div>
    </header>
  );
};
