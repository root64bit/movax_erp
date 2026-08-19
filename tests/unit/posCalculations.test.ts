import { describe, it, expect } from 'vitest';
import { calculatePosTotals, calculateChange, isWalkInClient, normalizeClientSearch } from '../../src/features/pos/utils/posCalculations';
import type { SaleItem, Client } from '../../src/shared/types/domain.types';

describe('POS Monetary & Tax Calculations (Mozambique MZN Standard)', () => {
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

  it('calculates line item with line discount and 16% IVA', () => {
    const items: SaleItem[] = [
      {
        articleId: 'art-2',
        code: 'FILT01',
        description: 'Filtro de Óleo',
        quantity: 1,
        unitPrice: 1000,
        discountPercent: 10,
        ivaPercent: 16,
        total: 1044,
      },
    ];

    const result = calculatePosTotals(items, 0);
    expect(result.subtotal).toBe(900);
    expect(result.totalDiscount).toBe(100);
    expect(result.totalVat).toBe(144);
    expect(result.grandTotal).toBe(1044);
  });

  it('calculates combined line discount and global ticket discount', () => {
    const items: SaleItem[] = [
      {
        articleId: 'art-3',
        code: 'PAST01',
        description: 'Pastilhas de Travão',
        quantity: 1,
        unitPrice: 1000,
        discountPercent: 10,
        ivaPercent: 16,
        total: 0,
      },
    ];

    const result = calculatePosTotals(items, 5);
    expect(result.subtotal).toBe(855);
    expect(result.totalDiscount).toBe(145);
    expect(result.totalVat).toBe(136.8);
    expect(result.grandTotal).toBe(991.8);
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
