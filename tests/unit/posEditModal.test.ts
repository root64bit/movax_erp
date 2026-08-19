import { describe, it, expect } from 'vitest';
import { recalculateSaleItem, recalculateSaleItems, calculateDocumentTotals, calculateDocumentLine } from '../../src/lib/documentCalculations';
import type { SaleItem, SaleInvoice } from '../../src/shared/types/domain.types';

describe('POS Document Edit & VAT Preservation Contract', () => {
  it('preserves 0% VAT on existing line without converting to 16%', () => {
    const originalLine: SaleItem = {
      articleId: 'art-exempt',
      code: 'ISENTO01',
      description: 'Artigo Isento de IVA',
      quantity: 5,
      unitPrice: 200,
      discountPercent: 0,
      discountAmount: 0,
      ivaPercent: 0,
      total: 1000,
      lineType: 'STOCK',
    };

    // Simulate edit modal initialization:
    const loadedItems: SaleItem[] = [JSON.parse(JSON.stringify(originalLine))];
    const editItems = recalculateSaleItems(loadedItems);

    expect(editItems[0].ivaPercent).toBe(0);
    expect(editItems[0].total).toBe(1000);

    const totals = calculateDocumentTotals(editItems, 0);
    expect(totals.taxTotal).toBe(0);
    expect(totals.grandTotal).toBe(1000);
  });

  it('preserves 16% VAT on standard line', () => {
    const originalLine: SaleItem = {
      articleId: 'art-std',
      code: 'STD01',
      description: 'Artigo Normal 16%',
      quantity: 2,
      unitPrice: 116,
      discountPercent: 0,
      discountAmount: 0,
      ivaPercent: 16,
      total: 232,
      lineType: 'STOCK',
    };

    const loadedItems: SaleItem[] = [JSON.parse(JSON.stringify(originalLine))];
    const editItems = recalculateSaleItems(loadedItems);

    expect(editItems[0].ivaPercent).toBe(16);
    expect(editItems[0].total).toBe(232);

    const totals = calculateDocumentTotals(editItems, 0);
    expect(totals.grandTotal).toBe(232);
  });

  it('preserves 5% alternative VAT on reduced rate line', () => {
    const originalLine: SaleItem = {
      articleId: 'art-5',
      code: 'RED01',
      description: 'Artigo Reduzido 5%',
      quantity: 1,
      unitPrice: 105,
      discountPercent: 0,
      discountAmount: 0,
      ivaPercent: 5,
      total: 105,
      lineType: 'STOCK',
    };

    const loadedItems: SaleItem[] = [JSON.parse(JSON.stringify(originalLine))];
    const editItems = recalculateSaleItems(loadedItems);

    expect(editItems[0].ivaPercent).toBe(5);
    expect(editItems[0].total).toBe(105);

    const totals = calculateDocumentTotals(editItems, 0);
    expect(totals.grandTotal).toBe(105);
  });

  it('opening and saving document without line edits yields exact same totals', () => {
    const documentItems: SaleItem[] = [
      {
        articleId: 'art-1',
        code: 'A1',
        description: 'Item A',
        quantity: 2,
        unitPrice: 100,
        discountPercent: 0,
        discountAmount: 10,
        ivaPercent: 16,
        total: 190,
        lineType: 'STOCK',
      },
      {
        articleId: 'art-2',
        code: 'A2',
        description: 'Item B Isento',
        quantity: 3,
        unitPrice: 50,
        discountPercent: 0,
        discountAmount: 0,
        ivaPercent: 0,
        total: 150,
        lineType: 'STOCK',
      },
    ];

    const initialTotals = calculateDocumentTotals(documentItems, 0);
    const reloaded = recalculateSaleItems(JSON.parse(JSON.stringify(documentItems)));
    const finalTotals = calculateDocumentTotals(reloaded, 0);

    expect(finalTotals.grossTotal).toBe(initialTotals.grossTotal);
    expect(finalTotals.lineDiscountTotal).toBe(initialTotals.lineDiscountTotal);
    expect(finalTotals.netTotal).toBe(initialTotals.netTotal);
    expect(finalTotals.taxTotal).toBe(initialTotals.taxTotal);
    expect(finalTotals.grandTotal).toBe(initialTotals.grandTotal);
  });
});
