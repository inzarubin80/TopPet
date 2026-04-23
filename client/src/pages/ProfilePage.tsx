import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppDispatch, RootState } from '../store';
import { logout, setUser } from '../store/slices/authSlice';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { getProfileReferrer, clearProfileReferrer } from '../utils/navigation';
import * as authApi from '../api/authApi';
import { getApiErrorMessage } from '../types/api';
import { fetchCurrentUser } from '../store/slices/authSlice';
import { resolvePublicAssetUrl } from '../utils/seo';
import { AvatarCropModal } from '../components/profile/AvatarCropModal';
import { ConnectionStatus } from '../components/chat/ConnectionStatus';
import './ProfilePage.css';

const SYSTEM_ROLE_LABEL: Record<string, string> = {
  user: 'Пользователь',
  contest_admin: 'Администратор конкурса',
  system_admin: 'Администратор системы',
};

const ProfilePage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const notificationsSocketState = useSelector((state: RootState) => state.notifications.socketState);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [dateOfBirth, setDateOfBirth] = useState(
    user?.date_of_birth ? user.date_of_birth.slice(0, 10) : ''
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [avatarCropSrc, setAvatarCropSrc] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    dispatch(fetchCurrentUser());
  }, [dispatch]);

  useEffect(() => {
    if (!user) return;
    setName(user.name || '');
    setEmail(user.email || '');
    setPhone(user.phone || '');
    setDateOfBirth(user.date_of_birth ? user.date_of_birth.slice(0, 10) : '');
  }, [user]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setAvatarError(null);
    setSuccess(false);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Введите имя');
      return;
    }

    try {
      setSaving(true);
      const updatedUser = await authApi.updateCurrentUser({
        name: trimmedName,
        email: email.trim(),
        phone: phone.trim(),
        date_of_birth: dateOfBirth.trim(),
      });
      dispatch(setUser(updatedUser));
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'Не удалось обновить профиль');
    } finally {
      setSaving(false);
    }
  };

  const openDeleteConfirm = () => {
    setDeleteError(null);
    setShowDeleteConfirm(true);
  };

  const closeDeleteConfirm = () => {
    if (!deleting) {
      setShowDeleteConfirm(false);
      setDeleteError(null);
    }
  };

  const handleConfirmDeleteProfile = async () => {
    setDeleteError(null);
    try {
      setDeleting(true);
      await authApi.deleteCurrentUser();
      setShowDeleteConfirm(false);
      clearProfileReferrer();
      dispatch(logout());
      navigate('/', { replace: true });
    } catch (err: unknown) {
      setDeleteError(getApiErrorMessage(err) || 'Не удалось удалить профиль');
    } finally {
      setDeleting(false);
    }
  };

  const closeAvatarCrop = () => {
    setAvatarCropSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (avatarFileInputRef.current) {
      avatarFileInputRef.current.value = '';
    }
  };

  const handleAvatarFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      return;
    }
    if (file.type.includes('svg')) {
      setAvatarError('Выберите растровое изображение (не SVG)');
      event.target.value = '';
      return;
    }
    setAvatarError(null);
    const url = URL.createObjectURL(file);
    setAvatarCropSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  };

  const handleAvatarCroppedUpload = async (blob: Blob) => {
    setAvatarUploading(true);
    try {
      const updatedUser = await authApi.uploadCurrentUserAvatar(blob);
      dispatch(setUser(updatedUser));
      setSuccess(true);
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err) || 'Не удалось загрузить аватар';
      throw new Error(msg);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleLogout = () => {
    // Сначала определяем, куда редиректить (до logout, чтобы ProtectedRoute не перехватил)
    const referrer = getProfileReferrer();
    clearProfileReferrer();
    
    // Список защищенных страниц, на которые нельзя редиректить после logout
    const protectedPages = ['/profile', '/contests/new/edit', '/create-contest', '/admin'];
    
    // Редиректим на сохраненный URL, если он есть, внутренний и не защищенный
    // Также проверяем, что referrer не равен текущей странице профиля
    const isProtected = referrer && protectedPages.some(page => referrer.startsWith(page));
    const isValidReferrer = referrer && referrer.startsWith('/') && referrer !== '/profile' && !isProtected;
    const targetUrl = isValidReferrer ? referrer : '/';
    
    // Обновляем Redux state ПЕРЕД навигацией
    // Это гарантирует, что isAuthenticated будет false, но навигация произойдет до проверки ProtectedRoute
    dispatch(logout());
    
    // Используем navigate с replace для избежания мигания
    // replace: true предотвращает добавление записи в историю браузера
    navigate(targetUrl, { replace: true });
  };

  const rawAvatarForDisplay = (user?.avatar_url || '').trim();
  const displayAvatarUrl = rawAvatarForDisplay ? resolvePublicAssetUrl(rawAvatarForDisplay) : '';

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-card-header">
          <div className="profile-avatar">
            {displayAvatarUrl ? (
              <img className="profile-avatar-img" src={displayAvatarUrl} alt="Профиль" />
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
            <p>Имя, контакты и фото профиля</p>
            <p className="profile-system-role">
              Роль в системе: {SYSTEM_ROLE_LABEL[user?.role || 'user'] || user?.role || 'Пользователь'}
            </p>
            <div className="profile-ws-status">
              <ConnectionStatus state={notificationsSocketState} isAuthenticated />
            </div>
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
          <Input
            label="Электронная почта"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="email@example.com"
          />
          <Input
            label="Телефон"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+7 …"
          />
          <Input
            label="Дата рождения"
            type="date"
            value={dateOfBirth}
            onChange={(event) => setDateOfBirth(event.target.value)}
          />
          <div className="profile-avatar-upload">
            <span className="profile-avatar-upload-label">Фото профиля</span>
            <input
              ref={avatarFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="profile-avatar-upload-input"
              onChange={handleAvatarFileChange}
              disabled={saving || avatarUploading}
              tabIndex={-1}
              aria-label="Выбрать файл фото профиля"
            />
            <Button
              type="button"
              variant="secondary"
              disabled={saving || avatarUploading}
              onClick={() => avatarFileInputRef.current?.click()}
            >
              {avatarUploading ? 'Загрузка…' : 'Загрузить фото'}
            </Button>
            <p className="profile-avatar-upload-hint">
              Перед загрузкой можно обрезать фото и выбрать область лица.
            </p>
            {avatarError && <div className="profile-avatar-upload-error">{avatarError}</div>}
          </div>
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

        <div className="profile-danger-zone" role="region" aria-label="Удаление профиля">
          <h2 className="profile-danger-title">Опасная зона</h2>
          <p className="profile-danger-text">
            Удаление профиля необратимо: аккаунт, привязки OAuth, ваши заявки участника и сообщения в чатах конкурсов будут стёрты.
          </p>
          <Button
            type="button"
            variant="danger"
            disabled={deleting || saving}
            onClick={openDeleteConfirm}
          >
            Удалить профиль
          </Button>
        </div>
      </div>

      {avatarCropSrc && (
        <AvatarCropModal
          isOpen
          imageSrc={avatarCropSrc}
          onClose={closeAvatarCrop}
          onApply={handleAvatarCroppedUpload}
        />
      )}

      <Modal
        isOpen={showDeleteConfirm}
        onClose={closeDeleteConfirm}
        title="Удалить профиль?"
        footer={
          <div className="profile-delete-modal-footer">
            <Button type="button" variant="secondary" onClick={closeDeleteConfirm} disabled={deleting}>
              Отмена
            </Button>
            <Button type="button" variant="danger" onClick={handleConfirmDeleteProfile} disabled={deleting}>
              {deleting ? <LoadingSpinner size="small" /> : 'Да, удалить навсегда'}
            </Button>
          </div>
        }
      >
        <div className="profile-delete-modal-body">
          <p className="profile-delete-modal-question">
            Вы уверены, что хотите удалить профиль безвозвратно?
          </p>
          <p className="profile-delete-modal-detail">
            Будут удалены учётная запись, привязки OAuth, ваши заявки на конкурсы и сообщения в чатах конкурсов. Это
            действие нельзя отменить.
          </p>
          {deleteError && <div className="profile-delete-modal-error">{deleteError}</div>}
        </div>
      </Modal>
    </div>
  );
};

export default ProfilePage;
