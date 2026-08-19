import { describe, it, expect } from 'vitest';
import { calculateDocumentTotals, recalculateSaleItem, recalculateSaleItems } from '../../src/lib/documentCalculations';
import type { SaleItem } from '../../src/shared/types/domain.types';

describe('POS Cart Mutations & Calculations Contract', () => {
  it('correctly recalculates single item with discount and VAT', () => {
    const item: SaleItem = {
      articleId: 'art-1',
      code: 'ITEM01',
      description: 'Produto Teste',
      quantity: 2,
      unitPrice: 100,
      discountPercent: 0,
      discountAmount: 10,
      ivaPercent: 16,
      total: 0,
      lineType: 'STOCK',
    };

    const calculated = recalculateSaleItem(item);
    expect(calculated.total).toBe(190);
  });

  it('correctly calculates document totals across multiple items', () => {
    const items: SaleItem[] = [
      recalculateSaleItem({
        articleId: 'art-1',
        code: 'ITEM01',
        description: 'Produto 1',
        quantity: 2,
        unitPrice: 100,
        discountPercent: 0,
        discountAmount: 0,
        ivaPercent: 16,
        total: 0,
        lineType: 'STOCK',
      }),
      recalculateSaleItem({
        articleId: 'art-2',
        code: 'ITEM02',
        description: 'Produto 2 Isento',
        quantity: 1,
        unitPrice: 50,
        discountPercent: 0,
        discountAmount: 0,
        ivaPercent: 0,
        total: 0,
        lineType: 'STOCK',
      }),
    ];

    const totals = calculateDocumentTotals(items, 0);
    expect(totals.grandTotal).toBe(250);
  });
});
