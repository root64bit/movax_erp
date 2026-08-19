import React, { type ReactNode } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { PageLoader } from '@/shared/components/feedback';

interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children, fallback = null }) => {
  const { isAuthenticated, checking } = useAuth();

  if (checking) {
    return <PageLoader message="A verificar autenticação..." />;
  }

  if (!isAuthenticated) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
