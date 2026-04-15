import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { fetchCurrentUser } from '../store/slices/authSlice';
import { listAdminUsers, patchAdminUser, updateAdminUserRole } from '../api/adminUsersApi';
import { User, UserRole } from '../types/models';
import { useToast } from '../contexts/ToastContext';
import { getErrorMessage } from '../utils/errorHandler';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorMessage } from '../components/common/ErrorMessage';
import './AdminUsersPage.css';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'user', label: 'Пользователь' },
  { value: 'contest_admin', label: 'Администратор конкурса' },
  { value: 'system_admin', label: 'Администратор системы' },
];

function formatDateOfBirth(iso?: string): string {
  if (!iso) return '—';
  const d = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '—';
}

const AdminUsersPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const { showSuccess, showError } = useToast();
  const [items, setItems] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listAdminUsers(200, 0);
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser?.role === 'system_admin') {
      void load();
    }
  }, [currentUser?.role, load]);

  const handleRoleChange = async (userId: number, role: UserRole) => {
    setUpdatingId(userId);
    try {
      const updated = await updateAdminUserRole(userId, role);
      setItems((prev) => prev.map((u) => (u.id === userId ? { ...u, ...updated } : u)));
      if (userId === currentUser?.id) {
        void dispatch(fetchCurrentUser());
      }
      showSuccess('Роль обновлена');
    } catch (e) {
      showError(getErrorMessage(e));
      void load();
    } finally {
      setUpdatingId(null);
    }
  };

  const handleBlockedToggle = async (userId: number, blocked: boolean) => {
    setUpdatingId(userId);
    try {
      const updated = await patchAdminUser(userId, { blocked });
      setItems((prev) => prev.map((u) => (u.id === userId ? { ...u, ...updated } : u)));
      if (userId === currentUser?.id) {
        void dispatch(fetchCurrentUser());
      }
      showSuccess(blocked ? 'Пользователь заблокирован' : 'Блокировка снята');
    } catch (e) {
      showError(getErrorMessage(e));
      void load();
    } finally {
      setUpdatingId(null);
    }
  };

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  if (currentUser.role !== 'system_admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="admin-users-page">
      <div className="admin-users-inner">
        <Link to="/" className="admin-users-back">
          ← На главную
        </Link>
        <h1 className="admin-users-title">Пользователи</h1>
        <p className="admin-users-lead">
          Назначение глобальных ролей и блокировка аккаунтов. «Администратор конкурса» может управлять любыми
          конкурсами так же, как создатель. «Администратор системы» имеет доступ к этому списку. Нельзя снять
          последнего администратора системы. Заблокированный пользователь не может выполнять действия, меняющие
          данные (POST, PUT, PATCH, DELETE).
        </p>
        <p className="admin-users-hint">
          Почта в профиле берётся из OAuth при входе: при повторной авторизации пустое поле заполняется, если провайдер
          отдаёт адрес. Если e-mail пустой при наличии провайдера — провайдер его не передал, либо такой адрес уже
          закреплён за другим пользователем (уникальность в базе).
        </p>
        {error && <ErrorMessage message={error} />}
        {loading ? (
          <div className="admin-users-loading">
            <LoadingSpinner size="large" />
          </div>
        ) : (
          <>
            <p className="admin-users-count">
              Всего: {total}
            </p>
            <div className="admin-users-table-wrap">
              <table className="admin-users-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Имя</th>
                    <th>Email</th>
                    <th>Телефон</th>
                    <th>Дата рождения</th>
                    <th>Аватар</th>
                    <th>Вход (OAuth)</th>
                    <th>Роль</th>
                    <th>Блокировка</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((u) => (
                    <tr key={u.id}>
                      <td>{u.id}</td>
                      <td>{u.name}</td>
                      <td>{u.email || '—'}</td>
                      <td className="admin-users-phone">{u.phone?.trim() || '—'}</td>
                      <td>{formatDateOfBirth(u.date_of_birth)}</td>
                      <td className="admin-users-avatar-cell">
                        {u.avatar_url?.trim() ? (
                          <a
                            href={u.avatar_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="admin-users-avatar-link"
                            title={u.avatar_url}
                          >
                            <img src={u.avatar_url} alt="" className="admin-users-avatar-thumb" />
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="admin-users-providers">
                        {u.auth_providers && u.auth_providers.length > 0
                          ? u.auth_providers.join(', ')
                          : '—'}
                      </td>
                      <td>
                        <select
                          className="admin-users-role-select"
                          value={u.role || 'user'}
                          disabled={updatingId === u.id}
                          onChange={(e) => {
                            const role = e.target.value as UserRole;
                            void handleRoleChange(u.id, role);
                          }}
                          aria-label={`Роль пользователя ${u.id}`}
                        >
                          {ROLE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <label className="admin-users-block-toggle">
                          <input
                            type="checkbox"
                            checked={!!u.is_blocked}
                            disabled={updatingId === u.id}
                            onChange={(e) => {
                              void handleBlockedToggle(u.id, e.target.checked);
                            }}
                            aria-label={
                              u.is_blocked
                                ? `Снять блокировку с пользователя ${u.id}`
                                : `Заблокировать пользователя ${u.id}`
                            }
                          />
                          <span>{u.is_blocked ? 'Заблокирован' : 'Активен'}</span>
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminUsersPage;
