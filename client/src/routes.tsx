import React from 'react';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from './store';
import HomePage from './pages/HomePage';
import ContestPage from './pages/ContestPage';
import ParticipantPage from './pages/ParticipantPage';
import EditContestPage from './pages/EditContestPage';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import AdminUsersPage from './pages/AdminUsersPage';
import { AppHeader } from './components/common/AppHeader';
import { ToastContainer } from './components/common/ToastContainer';
import { useToast } from './contexts/ToastContext';
import { buildLoginUrl } from './utils/navigation';

const SystemAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const role = useSelector((state: RootState) => state.auth.user?.role);
  const location = useLocation();

  if (!isAuthenticated) {
    const returnUrl = `${location.pathname}${location.search}`;
    return <Navigate to={buildLoginUrl(returnUrl)} replace />;
  }
  if (role !== 'system_admin') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    const returnUrl = `${location.pathname}${location.search}`;
    return <Navigate to={buildLoginUrl(returnUrl)} replace />;
  }

  return <>{children}</>;
};

const AppLayout: React.FC = () => {
  const { toasts, removeToast } = useToast();
  
  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main">
        <Outlet />
      </main>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/contests/:id/edit"
          element={
            <ProtectedRoute>
              <EditContestPage />
            </ProtectedRoute>
          }
        />
        <Route path="/contests/:id" element={<ContestPage />} />
        <Route path="/contests/:id/participants/:participantId" element={<ParticipantPage />} />
        <Route
          path="/create-contest"
          element={<Navigate to="/contests/new/edit" replace />}
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <SystemAdminRoute>
              <AdminUsersPage />
            </SystemAdminRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
};
