import { useState, useRef, useCallback } from 'react';
import type { SaleInvoice } from '@/shared/types/domain.types';

export interface UsePosSubmissionOptions {
  onCompleteSale: (sale: SaleInvoice) => Promise<SaleInvoice>;
  onSuccess?: (savedSale: SaleInvoice, shouldPrint: boolean) => void;
}

export function usePosSubmission({ onCompleteSale, onSuccess }: UsePosSubmissionOptions) {
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [confirmedSaleRecord, setConfirmedSaleRecord] = useState<SaleInvoice | null>(null);

  const executeSaleSubmission = useCallback(
    async (
      salePayload: SaleInvoice,
      options?: { shouldPrint?: boolean }
    ): Promise<SaleInvoice | null> => {
      if (savingRef.current) return null;

      savingRef.current = true;
      setSaving(true);
      setSaveError('');

      try {
        const savedSale = await onCompleteSale(salePayload);
        setConfirmedSaleRecord(savedSale);
        onSuccess?.(savedSale, Boolean(options?.shouldPrint));
        return savedSale;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao confirmar o documento.';
        setSaveError(message);
        throw error;
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [onCompleteSale, onSuccess]
  );

  const resetSubmission = useCallback(() => {
    setSaveError('');
    setConfirmedSaleRecord(null);
    savingRef.current = false;
    setSaving(false);
  }, []);

  return {
    saving,
    saveError,
    setSaveError,
    confirmedSaleRecord,
    setConfirmedSaleRecord,
    executeSaleSubmission,
    resetSubmission,
    savingRef,
  };
}
