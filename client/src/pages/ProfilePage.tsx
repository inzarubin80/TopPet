import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppDispatch, RootState } from '../store';
import { logout, setUser } from '../store/slices/authSlice';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import * as authApi from '../api/authApi';
import './ProfilePage.css';

const ProfilePage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (user?.name) {
      setName(user.name);
    }
  }, [user?.name]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Введите имя');
      return;
    }

    try {
      setSaving(true);
      const updatedUser = await authApi.updateCurrentUser({ name: trimmedName });
      dispatch(setUser(updatedUser));
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'Не удалось обновить профиль');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/');
  };

  const avatarUrl = user?.avatar_url;

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-card-header">
          <div className="profile-avatar">
            {avatarUrl ? (
              <img className="profile-avatar-img" src={avatarUrl} alt="Профиль" />
            ) : (
              <svg className="profile-avatar-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0 2c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5z"
                  fill="currentColor"
                />
              </svg>
            )}
          </div>
          <div className="profile-title">
            <h1>Профиль</h1>
            <p>Управляйте своим отображаемым именем</p>
          </div>
        </div>

        <form className="profile-form" onSubmit={handleSave}>
          <Input
            label="Имя"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ваше имя"
            error={error || undefined}
          />
          {success && <div className="profile-success">Изменения сохранены</div>}
          <div className="profile-actions">
            <Button type="submit" disabled={saving}>
              {saving ? 'Сохраняем...' : 'Сохранить'}
            </Button>
            <Button type="button" variant="secondary" onClick={handleLogout}>
              Выйти
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;
