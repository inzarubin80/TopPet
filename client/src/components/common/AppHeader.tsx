import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { buildLoginUrl, saveProfileLoginReferrer, saveProfileReferrer } from '../../utils/navigation';
import { canCreateContests } from '../../utils/contestPermissions';
import { BRAND_NAME, BRAND_TAGLINE } from '../../config/brand';
import { MessengerUserPresentation } from './MessengerUserPresentation';
import './AppHeader.css';

export const AppHeader: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const adminMenuRef = useRef<HTMLDivElement | null>(null);

  const isSystemAdmin = user?.role === 'system_admin';
  const mayCreateContest = isAuthenticated && canCreateContests(user);
  const showAdminMenu = mayCreateContest || isSystemAdmin;

  useEffect(() => {
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
          <button type="button" className="app-header-profile" onClick={handleProfileClick}>
            <MessengerUserPresentation
              userId={user?.id ?? 0}
              name={user?.name || 'Профиль'}
              avatarUrl={user?.avatar_url}
              size="sm"
            />
          </button>
        </div>
      </div>
    </header>
  );
};
