import React from 'react';
import type { DocumentRecord } from '@/shared/types/domain.types';

export interface CancelGuideModalProps {
  cancellingGuide: DocumentRecord | null;
  cancelReason: string;
  onCancelReasonChange: (reason: string) => void;
  isCancelling: boolean;
  onClose: () => void;
  onConfirmCancel: () => void;
}

export const CancelGuideModal: React.FC<CancelGuideModalProps> = ({
  cancellingGuide,
  cancelReason,
  onCancelReasonChange,
  isCancelling,
  onClose,
  onConfirmCancel,
}) => {
  if (!cancellingGuide) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 print:hidden">
      <div className="w-full max-w-md rounded-lg border bg-white p-6 shadow-2xl dark:bg-[#1f2325] dark:border-[#43474f] space-y-4">
        <div className="flex items-center space-x-2 text-rose-600 dark:text-rose-400">
          <span className="material-symbols-outlined text-2xl">warning</span>
          <h3 className="font-black text-sm uppercase tracking-wide">
            Anular {cancellingGuide.externalReference || cancellingGuide.displayNumber}
          </h3>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Esta operação irá anular formalmente a guia de stock e reverter todos os movimentos de inventário correspondentes.
        </p>
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
            Motivo da anulação *
          </label>
          <textarea
            rows={3}
            value={cancelReason}
            onChange={(e) => onCancelReasonChange(e.target.value)}
            placeholder="Indique detalhadamente o motivo da anulação..."
            className="w-full rounded border border-gray-300 p-2 text-xs dark:bg-[#282c2e] dark:border-gray-600 dark:text-white"
          />
        </div>
        <div className="flex justify-end space-x-2 border-t pt-3">
          <button
            type="button"
            disabled={isCancelling}
            onClick={onClose}
            className="rounded border border-gray-300 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 cursor-pointer"
          >
            Voltar
          </button>
          <button
            type="button"
            disabled={isCancelling || !cancelReason.trim()}
            onClick={onConfirmCancel}
            className="rounded bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
          >
            {isCancelling ? 'A anular...' : 'Confirmar Anulação'}
          </button>
        </div>
      </div>
    </div>
  );
};
