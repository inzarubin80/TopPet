import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from './store';
import HomePage from './pages/HomePage';
import ContestPage from './pages/ContestPage';
import ParticipantPage from './pages/ParticipantPage';
import CreateContestPage from './pages/CreateContestPage';
import LoginPage from './pages/LoginPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/contests/:id" element={<ContestPage />} />
      <Route path="/contests/:id/participants/:participantId" element={<ParticipantPage />} />
      <Route
        path="/create-contest"
        element={
          <ProtectedRoute>
            <CreateContestPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
