import { describe, it, expect, vi } from 'vitest';
import type { SaleInvoice } from '../../src/shared/types/domain.types';

describe('POS Sale Submission & Concurrency Lock Contract', () => {
  it('prevents double submission when confirm is clicked rapidly', async () => {
    let callCount = 0;
    const onCompleteSaleMock = vi.fn(async (sale: SaleInvoice) => {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { ...sale, id: 'confirmed-1', docNumber: 'FT-001' };
    });

    const savingRef = { current: false };

    const executeSubmit = async (sale: SaleInvoice) => {
      if (savingRef.current) return;
      savingRef.current = true;
      try {
        return await onCompleteSaleMock(sale);
      } finally {
        savingRef.current = false;
      }
    };

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

    // Simulate 2 rapid concurrent clicks
    const promise1 = executeSubmit(mockSale);
    const promise2 = executeSubmit(mockSale);

    await Promise.all([promise1, promise2]);

    expect(onCompleteSaleMock).toHaveBeenCalledTimes(1);
    expect(callCount).toBe(1);
    expect(savingRef.current).toBe(false);
  });

  it('releases lock and retains error message on submission failure for retry', async () => {
    const errorMock = vi.fn(async () => {
      throw new Error('Saldo insuficiente na conta.');
    });

    const savingRef = { current: false };
    let capturedError = '';

    const executeSubmitWithError = async () => {
      if (savingRef.current) return;
      savingRef.current = true;
      try {
        await errorMock();
      } catch (err) {
        capturedError = err instanceof Error ? err.message : 'Falha';
      } finally {
        savingRef.current = false;
      }
    };

    await executeSubmitWithError();

    expect(capturedError).toBe('Saldo insuficiente na conta.');
    expect(savingRef.current).toBe(false); // Lock released for retry
  });
});
