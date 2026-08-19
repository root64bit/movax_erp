import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { usePosSubmission } from '../../src/features/pos/hooks/usePosSubmission';
import type { SaleInvoice } from '../../src/shared/types/domain.types';

describe('usePosSubmission Real Production Hook Contract', () => {
  it('prevents double submission when confirm is clicked rapidly', async () => {
    let callCount = 0;
    const onCompleteSaleMock = vi.fn(async (sale: SaleInvoice) => {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { ...sale, id: 'confirmed-1', docNumber: 'FT-001' };
    });

    const onSuccessMock = vi.fn();
    let hookApi!: ReturnType<typeof usePosSubmission>;

    const Harness: React.FC = () => {
      hookApi = usePosSubmission({
        onCompleteSale: onCompleteSaleMock,
        onSuccess: onSuccessMock,
      });
      return null;
    };

    // Mount real production hook via React renderer:
    renderToString(React.createElement(Harness));

    const mockSale: SaleInvoice = {
      id: 's-1',
      clientId: 'c-1',
      docNumber: 'A atribuir',
      date: '2026-08-19',
      clientName: 'Cliente Teste',
      clientNuit: '',
      clientAddress: '',
      paymentMethod: 'CASH',
      sellerName: 'Operador',
      items: [],
      subtotalBruto: 100,
      descontoTotal: 0,
      subtotalLiquido: 100,
      ivaTotal: 16,
      totalAmount: 116,
      paidAmount: 116,
      pendingAmount: 0,
      status: 'Concluída',
    };

    // Trigger 2 concurrent rapid submissions through the real production hook:
    const promise1 = hookApi.executeSaleSubmission(mockSale);
    const promise2 = hookApi.executeSaleSubmission(mockSale);

    const [res1, res2] = await Promise.all([promise1, promise2]);

    expect(onCompleteSaleMock).toHaveBeenCalledTimes(1);
    expect(callCount).toBe(1);
    expect(res1?.docNumber).toBe('FT-001');
    expect(res2).toBeNull(); // Second concurrent call was rejected by savingRef lock in production hook
    expect(hookApi.savingRef.current).toBe(false);
  });

  it('releases lock and retains error message on submission failure for retry', async () => {
    let attempt = 0;
    const onCompleteSaleMock = vi.fn(async (sale: SaleInvoice) => {
      attempt++;
      if (attempt === 1) {
        throw new Error('Falha de rede ao conectar ao servidor fiscal.');
      }
      return { ...sale, id: 'confirmed-retry-1', docNumber: 'FT-RETRY-01' };
    });

    let hookApi!: ReturnType<typeof usePosSubmission>;

    const Harness: React.FC = () => {
      hookApi = usePosSubmission({
        onCompleteSale: onCompleteSaleMock,
      });
      return null;
    };

    renderToString(React.createElement(Harness));

    const mockSale: SaleInvoice = {
      id: 's-1',
      clientId: 'c-1',
      docNumber: 'A atribuir',
      date: '2026-08-19',
      clientName: 'Cliente Teste',
      clientNuit: '',
      clientAddress: '',
      paymentMethod: 'CASH',
      sellerName: 'Operador',
      items: [],
      subtotalBruto: 100,
      descontoTotal: 0,
      subtotalLiquido: 100,
      ivaTotal: 16,
      totalAmount: 116,
      paidAmount: 116,
      pendingAmount: 0,
      status: 'Concluída',
    };

    // Attempt 1: Should fail and record error in real hook state
    await expect(hookApi.executeSaleSubmission(mockSale)).rejects.toThrow(
      'Falha de rede ao conectar ao servidor fiscal.'
    );
    expect(hookApi.savingRef.current).toBe(false); // Lock released for retry

    // Attempt 2: Should succeed immediately
    const successResult = await hookApi.executeSaleSubmission(mockSale);
    expect(successResult?.docNumber).toBe('FT-RETRY-01');
    expect(onCompleteSaleMock).toHaveBeenCalledTimes(2);
    expect(hookApi.savingRef.current).toBe(false);
  });
});
