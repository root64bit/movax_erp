import React from 'react';
import type { AccessScope } from '@/shared/types/domain.types';
import type { StockWorkspaceMode, StockMovementType } from '../types/stock-transfer.types';

export interface StockModeSelectorProps {
  workspaceMode: StockWorkspaceMode;
  type: StockMovementType;
  warehouses: AccessScope[];
  canPostEntry: boolean;
  canPostExit: boolean;
  canTransfer: boolean;
  onSelectMode: (mode: StockWorkspaceMode, type?: StockMovementType) => void;
}

export const StockModeSelector: React.FC<StockModeSelectorProps> = ({
  workspaceMode,
  type,
  warehouses,
  canPostEntry,
  canPostExit,
  canTransfer,
  onSelectMode,
}) => {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-[#1f2325] print:hidden">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-lg font-black text-slate-900 dark:text-white">Movimentar stock</h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Escolha o que pretende fazer. O Movax apresenta apenas os campos necessários para essa operação.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:min-w-[560px]">
          {canPostEntry && (
            <button
              type="button"
              onClick={() => onSelectMode('direct', 'entrada')}
              className={`rounded-lg border px-4 py-3 text-left transition ${
                workspaceMode === 'direct' && type === 'entrada'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-200'
                  : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/50 dark:border-slate-700 dark:bg-[#282c2e]'
              }`}
            >
              <span className="block text-xs font-black uppercase">Entrada</span>
              <span className="mt-1 block text-[11px] opacity-70">Receber mercadoria ou corrigir stock</span>
            </button>
          )}
          {canPostExit && (
            <button
              type="button"
              onClick={() => onSelectMode('direct', 'saida')}
              className={`rounded-lg border px-4 py-3 text-left transition ${
                workspaceMode === 'direct' && type === 'saida'
                  ? 'border-rose-600 bg-rose-50 text-rose-900 ring-2 ring-rose-100 dark:bg-rose-950/30 dark:text-rose-200'
                  : 'border-slate-200 bg-white hover:border-rose-300 hover:bg-rose-50/50 dark:border-slate-700 dark:bg-[#282c2e]'
              }`}
            >
              <span className="block text-xs font-black uppercase">Saída</span>
              <span className="mt-1 block text-[11px] opacity-70">Consumo, quebra ou saída autorizada</span>
            </button>
          )}
          {canTransfer && (
            <button
              type="button"
              onClick={() => onSelectMode('transfer')}
              disabled={warehouses.length < 2}
              className={`rounded-lg border px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                workspaceMode === 'transfer'
                  ? 'border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-100 dark:bg-blue-950/30 dark:text-blue-200'
                  : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50 dark:border-slate-700 dark:bg-[#282c2e]'
              }`}
            >
              <span className="block text-xs font-black uppercase">Transferência</span>
              <span className="mt-1 block text-[11px] opacity-70">Mover stock entre armazéns</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
