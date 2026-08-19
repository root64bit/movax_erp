import React, { useState, useEffect } from 'react';
import { LandingPage, PricingPage, RegisterPage } from '@/features/landing';
import { AuthGate } from '@/features/auth';
import type { Session } from '@supabase/supabase-js';
import type { UserContext } from '@/shared/types/domain.types';

interface PublicRoutesProps {
  session: Session | null;
  checkingSession: boolean;
  userContext: UserContext | null;
  dataError: string;
  onRetry: () => Promise<void>;
  onPasswordChanged: () => Promise<void>;
  children: React.ReactNode;
}

export const PublicRoutes: React.FC<PublicRoutesProps> = ({
  session,
  checkingSession,
  userContext,
  dataError,
  onRetry,
  onPasswordChanged,
  children,
}) => {
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (route: string) => {
    let target = '/';
    if (route === 'pricing' || route === '/pricing') target = '/pricing';
    else if (route.startsWith('register') || route.startsWith('/register')) {
      target = route.startsWith('/') ? route : `/${route}`;
    } else if (route === 'login' || route === '/login') target = '/login';
    else if (route === 'home' || route === 'landing' || route === '/') target = '/';
    else target = route.startsWith('/') ? route : `/${route}`;

    window.history.pushState({}, '', target);
    setCurrentPath(window.location.pathname);
  };

  // If user is already authenticated and on landing/pricing/register, route straight to private app
  if (
    session &&
    userContext &&
    (currentPath === '/' ||
      currentPath.startsWith('/pricing') ||
      currentPath.startsWith('/register') ||
      currentPath.startsWith('/login'))
  ) {
    return <>{children}</>;
  }

  if (currentPath.startsWith('/pricing')) {
    return <PricingPage onNavigate={navigate} />;
  }

  if (currentPath.startsWith('/register')) {
    return <RegisterPage onNavigate={navigate} />;
  }

  if (currentPath === '/' && !session) {
    return <LandingPage onNavigate={navigate} />;
  }

  return (
    <AuthGate
      session={session}
      checking={checkingSession}
      userContext={userContext}
      loadError={dataError}
      onRetry={onRetry}
      onPasswordChanged={onPasswordChanged}
    >
      {children}
    </AuthGate>
  );
};
