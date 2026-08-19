import React, { useEffect } from 'react';
import { AppErrorBoundary } from './AppErrorBoundary';
import { OperationalProvider } from '@/shared/context/OperationalContext';
import { validateEnvironment } from './config/env';

export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    validateEnvironment();
  }, []);

  return (
    <AppErrorBoundary>
      <OperationalProvider>
        {children}
      </OperationalProvider>
    </AppErrorBoundary>
  );
};
