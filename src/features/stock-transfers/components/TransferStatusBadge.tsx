import React from 'react';
import type { StockTransfer } from '@/shared/types/domain.types';

export interface TransferStatusBadgeProps {
  status: StockTransfer['status'] | string;
}

export const TransferStatusBadge: React.FC<TransferStatusBadgeProps> = ({ status }) => {
  const norm = String(status || 'PENDING').toUpperCase();

  if (norm === 'RECEIVED') {
    return (
      <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/40 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
        Recebida
      </span>
    );
  }

  if (norm === 'IN_TRANSIT' || norm === 'DISPATCHED') {
    return (
      <span className="rounded-full bg-blue-100 dark:bg-blue-950/40 px-2 py-0.5 text-[11px] font-bold text-blue-800 dark:text-blue-300">
        Em trânsito
      </span>
    );
  }

  if (norm === 'CANCELLED') {
    return (
      <span className="rounded-full bg-rose-100 dark:bg-rose-950/40 px-2 py-0.5 text-[11px] font-bold text-rose-800 dark:text-rose-300">
        Anulada
      </span>
    );
  }

  return (
    <span className="rounded-full bg-amber-100 dark:bg-amber-950/40 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-300">
      Rascunho
    </span>
  );
};
