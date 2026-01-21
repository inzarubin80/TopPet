import React, { ReactNode } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

interface AuthProviderProps {
  children: ReactNode;
  requireAuth?: boolean;
  fallback?: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  requireAuth = false,
  fallback = null,
}) => {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  if (requireAuth && !isAuthenticated) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
