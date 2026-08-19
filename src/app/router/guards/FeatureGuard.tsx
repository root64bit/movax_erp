import React, { type ReactNode } from 'react';

interface FeatureGuardProps {
  addonCode?: string;
  isAddonActive?: boolean;
  children: ReactNode;
  fallback?: ReactNode;
}

export const FeatureGuard: React.FC<FeatureGuardProps> = ({
  addonCode,
  isAddonActive = true,
  children,
  fallback = null,
}) => {
  if (!isAddonActive && addonCode) {
    if (fallback) return <>{fallback}</>;
    return (
      <div className="p-8 text-center bg-surface dark:bg-slate-900 border border-outline-variant rounded-2xl m-6">
        <span className="material-symbols-outlined text-4xl text-primary mb-2">stars</span>
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Módulo Opcional</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          O módulo <strong className="text-primary">{addonCode}</strong> não está incluído ou ativado na sua subscrição atual.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
