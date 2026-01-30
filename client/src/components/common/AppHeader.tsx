import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { buildLoginUrl, saveProfileReferrer } from '../../utils/navigation';
import './AppHeader.css';

export const AppHeader: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  const handleProfileClick = () => {
    if (!isAuthenticated) {
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
        <button type="button" className="app-header-title" onClick={() => navigate('/')}>
          TOP-PET
        </button>
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
    </header>
  );
};
