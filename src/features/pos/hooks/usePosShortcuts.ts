import { useEffect } from 'react';
import type { SaleInvoice } from '@/shared/types/domain.types';
import type { PosDocStatus } from '../types/pos.types';

export interface UsePosShortcutsProps {
  docStatus: PosDocStatus;
  confirmedSaleRecord: SaleInvoice | null;
  onF2: () => void;
  onF3: () => void;
  onF5: () => void;
  onF9: () => void;
  onEscape: () => void;
}

export function registerPosShortcutsListener({
  docStatus,
  confirmedSaleRecord,
  onF2,
  onF3,
  onF5,
  onF9,
  onEscape,
}: UsePosShortcutsProps): () => void {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'F2') {
      e.preventDefault();
      onF2();
    } else if (e.key === 'F3') {
      e.preventDefault();
      onF3();
    } else if (e.key === 'F5') {
      e.preventDefault();
      onF5();
    } else if (e.key === 'F9') {
      e.preventDefault();
      onF9();
    } else if (e.key === 'Escape') {
      if (docStatus === 'CONFIRMING') {
        e.preventDefault();
        onEscape();
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}

export function usePosShortcuts(props: UsePosShortcutsProps) {
  useEffect(() => {
    return registerPosShortcutsListener(props);
  }, [
    props.docStatus,
    props.confirmedSaleRecord,
    props.onF2,
    props.onF3,
    props.onF5,
    props.onF9,
    props.onEscape,
  ]);
}
