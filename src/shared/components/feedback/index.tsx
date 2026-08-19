import React, { type ReactNode } from 'react';

// ==========================================
// PAGE LOADER
// ==========================================
export interface PageLoaderProps {
  message?: string;
}

export const PageLoader: React.FC<PageLoaderProps> = ({ message = 'A carregar dados...' }) => {
  return (
    <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center space-y-4">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping" />
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
      <p className="text-xs font-bold text-slate-600 dark:text-slate-400 animate-pulse">{message}</p>
    </div>
  );
};

// ==========================================
// TABLE SKELETON
// ==========================================
export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({ rows = 5, columns = 5 }) => {
  return (
    <div className="w-full overflow-hidden border border-outline-variant dark:border-slate-800 rounded-2xl animate-pulse">
      <div className="bg-slate-100 dark:bg-slate-800/80 h-10 border-b border-outline-variant dark:border-slate-800" />
      <div className="divide-y divide-slate-100 dark:divide-slate-800/50 bg-white dark:bg-slate-900">
        {Array.from({ length: rows }).map((_, rIndex) => (
          <div key={rIndex} className="flex items-center px-4 py-3.5 space-x-4">
            {Array.from({ length: columns }).map((_, cIndex) => (
              <div
                key={cIndex}
                className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md flex-1"
                style={{ width: `${(cIndex + 1) * 15}%` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

// ==========================================
// ERROR STATE
// ==========================================
export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Erro ao carregar',
  message,
  onRetry,
}) => {
  return (
    <div className="min-h-[300px] flex flex-col items-center justify-center p-8 text-center bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-2xl space-y-3">
      <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 grid place-items-center">
        <span className="material-symbols-outlined text-2xl">error</span>
      </div>
      <h3 className="text-sm font-black text-rose-900 dark:text-rose-200">{title}</h3>
      <p className="text-xs text-rose-700 dark:text-rose-400 max-w-md">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
        >
          <span className="material-symbols-outlined text-sm">refresh</span>
          Tentar novamente
        </button>
      )}
    </div>
  );
};

// ==========================================
// EMPTY STATE
// ==========================================
export interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'inbox',
  title,
  description,
  action,
}) => {
  return (
    <div className="min-h-[280px] flex flex-col items-center justify-center p-8 text-center bg-surface dark:bg-slate-900 border border-dashed border-outline-variant dark:border-slate-800 rounded-2xl space-y-3">
      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 grid place-items-center">
        <span className="material-symbols-outlined text-2xl">{icon}</span>
      </div>
      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{title}</h3>
      {description && <p className="text-xs text-slate-500 max-w-sm">{description}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
};

// ==========================================
// NO RESULTS STATE
// ==========================================
export interface NoResultsStateProps {
  searchQuery: string;
  onClear?: () => void;
}

export const NoResultsState: React.FC<NoResultsStateProps> = ({ searchQuery, onClear }) => {
  return (
    <div className="min-h-[220px] flex flex-col items-center justify-center p-6 text-center space-y-2">
      <span className="material-symbols-outlined text-3xl text-slate-400">search_off</span>
      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
        Nenhum resultado para &quot;{searchQuery}&quot;
      </p>
      <p className="text-xs text-slate-500">Tente ajustar a sua pesquisa ou filtros.</p>
      {onClear && (
        <button
          onClick={onClear}
          className="text-xs font-bold text-primary hover:underline pt-1 cursor-pointer"
        >
          Limpar pesquisa
        </button>
      )}
    </div>
  );
};
