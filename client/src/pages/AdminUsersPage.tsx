import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { fetchCurrentUser } from '../store/slices/authSlice';
import { listAdminUsers, updateAdminUserRole } from '../api/adminUsersApi';
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
          Назначение глобальных ролей. «Администратор конкурса» может управлять любыми конкурсами так же, как создатель.
          «Администратор системы» имеет доступ к этому списку. Нельзя снять последнего администратора системы.
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
                    <th>Роль</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((u) => (
                    <tr key={u.id}>
                      <td>{u.id}</td>
                      <td>{u.name}</td>
                      <td>{u.email || '—'}</td>
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
