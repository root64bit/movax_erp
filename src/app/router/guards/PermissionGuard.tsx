import React, { type ReactNode } from 'react';
import { useOperationalContext } from '@/shared/context/OperationalContext';

interface PermissionGuardProps {
  requiredPermissions: string[];
  children: ReactNode;
  fallback?: ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  requiredPermissions,
  children,
  fallback = null,
}) => {
  const { hasPermission } = useOperationalContext();

  const isAllowed = requiredPermissions.length === 0 || requiredPermissions.some((perm) => hasPermission(perm));

  if (!isAllowed) {
    if (fallback) return <>{fallback}</>;
    return (
      <div className="p-8 text-center bg-surface dark:bg-slate-900 border border-outline-variant rounded-2xl m-6">
        <span className="material-symbols-outlined text-4xl text-amber-500 mb-2">lock</span>
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Acesso Restrito</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          O seu perfil não tem permissões para aceder a este módulo. Contacte o administrador da sua empresa.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
