import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { logger } from '@/shared/lib/logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class AppErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error('Unhandled React Rendering Error', error, {
      module: 'AppErrorBoundary',
      componentStack: errorInfo.componentStack,
    });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl space-y-5">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-300 grid place-items-center mx-auto">
              <span className="material-symbols-outlined text-3xl">warning</span>
            </div>
            
            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">
              Ocorreu um erro inesperado
            </h1>
            
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {this.state.error?.message || 'A aplicação encontrou uma falha temporária de interface.'}
            </p>

            <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReload}
                className="w-full py-3 bg-primary hover:bg-primary-container text-white font-bold text-xs rounded-xl shadow-sm transition-all"
              >
                Recarregar Página
              </button>
              <button
                onClick={this.handleGoHome}
                className="w-full py-3 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-50 transition-all"
              >
                Voltar ao Início
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
