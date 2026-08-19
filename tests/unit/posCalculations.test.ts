import { describe, it, expect } from 'vitest';
import { calculatePosTotals, calculateChange, isWalkInClient, normalizeClientSearch } from '../../src/features/pos/utils/posCalculations';
import { calculateQuotationTotals } from '../../src/features/quotations/utils/quotationCalculations';
import type { SaleItem, Client } from '../../src/shared/types/domain.types';

describe('Fiscal & VAT Calculations (Mozambique MZN Standard & Multi-Tax)', () => {
  it('calculates standard sale line with 16% IVA and zero discount', () => {
    const items: SaleItem[] = [
      {
        articleId: 'art-1',
        code: 'PNEU01',
        description: 'Pneu Bridgestone 205/55R16',
        quantity: 2,
        unitPrice: 5000,
        discountPercent: 0,
        ivaPercent: 16,
        total: 11600,
      },
    ];

    const result = calculatePosTotals(items, 0);
    expect(result.subtotal).toBe(10000);
    expect(result.totalVat).toBe(1600);
    expect(result.totalDiscount).toBe(0);
    expect(result.grandTotal).toBe(11600);
  });

  it('CRITICAL: respects 0% IVA (isento / exempt) without converting to 16% fallback', () => {
    const items: SaleItem[] = [
      {
        articleId: 'art-exempt',
        code: 'MED01',
        description: 'Medicamento Isento de IVA',
        quantity: 10,
        unitPrice: 100,
        discountPercent: 0,
        ivaPercent: 0,
        total: 1000,
      },
    ];

    const result = calculatePosTotals(items, 0);
    expect(result.subtotal).toBe(1000);
    expect(result.totalVat).toBe(0); // MUST BE 0, NOT 160!
    expect(result.totalDiscount).toBe(0);
    expect(result.grandTotal).toBe(1000);
  });

  it('calculates alternative tax rates (e.g. 5% reduced rate)', () => {
    const items: SaleItem[] = [
      {
        articleId: 'art-reduced',
        code: 'AGRI01',
        description: 'Produto Agrícola Taxa Reduzida',
        quantity: 1,
        unitPrice: 1000,
        discountPercent: 0,
        ivaPercent: 5,
        total: 1050,
      },
    ];

    const result = calculatePosTotals(items, 0);
    expect(result.subtotal).toBe(1000);
    expect(result.totalVat).toBe(50);
    expect(result.grandTotal).toBe(1050);
  });

  it('falls back to default 16% only when ivaPercent is null or undefined', () => {
    const items: SaleItem[] = [
      {
        articleId: 'art-default',
        code: 'PROD01',
        description: 'Produto sem taxa especificada',
        quantity: 1,
        unitPrice: 1000,
        discountPercent: 0,
        ivaPercent: undefined as any,
        total: 1160,
      },
    ];

    const result = calculatePosTotals(items, 0, 16);
    expect(result.subtotal).toBe(1000);
    expect(result.totalVat).toBe(160);
    expect(result.grandTotal).toBe(1160);
  });

  it('calculates discounts on 0% IVA items without introducing accidental tax', () => {
    const items: SaleItem[] = [
      {
        articleId: 'art-exempt-disc',
        code: 'LIVRO01',
        description: 'Livro Escolar Isento',
        quantity: 2,
        unitPrice: 500,
        discountPercent: 10,
        ivaPercent: 0,
        total: 900,
      },
    ];

    const result = calculatePosTotals(items, 5); // 10% line disc + 5% global disc
    // base = 1000. lineDisc = 100 -> 900. globalDisc = 45 -> 855.
    expect(result.subtotal).toBe(855);
    expect(result.totalDiscount).toBe(145);
    expect(result.totalVat).toBe(0);
    expect(result.grandTotal).toBe(855);
  });

  it('calculates quotations totals with 0% IVA accurately', () => {
    const items: SaleItem[] = [
      {
        articleId: 'art-quo-exempt',
        code: 'EXP01',
        description: 'Serviço de Exportação Isento',
        quantity: 1,
        unitPrice: 20000,
        discountPercent: 0,
        ivaPercent: 0,
        total: 20000,
      },
    ];

    const result = calculateQuotationTotals(items, 0);
    expect(result.subtotal).toBe(20000);
    expect(result.totalVat).toBe(0);
    expect(result.grandTotal).toBe(20000);
  });

  it('calculates change (troco) correctly without floating point errors', () => {
    expect(calculateChange(1000, 850)).toBe(150);
    expect(calculateChange(500, 499.99)).toBe(0.01);
    expect(calculateChange(500, 500)).toBe(0);
    expect(calculateChange(400, 500)).toBe(0);
  });

  it('identifies walk-in clients accurately', () => {
    const walkInClient1: Client = { id: 'c-1', number: 1, name: 'Cliente Pontual', email: '', phone: '', address: '', taxNumber: '', balance: 0, pendingBalance: 0 };
    const walkInClient2: Client = { id: 'c-2', code: '1', name: 'Consumidor Final', email: '', phone: '', address: '', taxNumber: '', balance: 0, pendingBalance: 0 };
    const accountClient: Client = { id: 'c-3', code: 'CUST-002', name: 'Transportes Machava, Lda.', email: '', phone: '', address: '', taxNumber: '400123456', balance: 0, pendingBalance: 5000 };

    expect(isWalkInClient(walkInClient1)).toBe(true);
    expect(isWalkInClient(walkInClient2)).toBe(true);
    expect(isWalkInClient(accountClient)).toBe(false);
  });
});
