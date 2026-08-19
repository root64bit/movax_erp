import { describe, it, expect, vi } from 'vitest';
import { calculateOffset, calculateTotalPages, clampPage, sanitizePostgrestSearch } from '@/shared/utils/pagination';
import { PurchasesService } from '@/features/purchases/services/purchases.service';
import { ValidationError } from '@/shared/utils/errorUtils';

describe('Phase 2 Services & Server Pagination Contracts', () => {
  describe('Pagination Core Calculations', () => {
    it('calculates offsets accurately across pages and sizes', () => {
      expect(calculateOffset(1, 25)).toBe(0);
      expect(calculateOffset(2, 25)).toBe(25);
      expect(calculateOffset(5, 50)).toBe(200);
      expect(calculateOffset(0, 25)).toBe(0);
      expect(calculateOffset(-1, 25)).toBe(0);
    });

    it('calculates total pages and clamps page correctly', () => {
      expect(calculateTotalPages(0, 25)).toBe(1);
      expect(calculateTotalPages(10, 25)).toBe(1);
      expect(calculateTotalPages(26, 25)).toBe(2);
      expect(calculateTotalPages(100, 25)).toBe(4);

      expect(clampPage(0, 100, 25)).toBe(1);
      expect(clampPage(3, 100, 25)).toBe(3);
      expect(clampPage(5, 100, 25)).toBe(4);
    });

    it('sanitizes PostgREST search characters to prevent syntax injection', () => {
      expect(sanitizePostgrestSearch('Mário & Filhos, Lda.')).toBe('Mário & Filhos Lda.');
      expect(sanitizePostgrestSearch('Test (Auto) % _ \\')).toBe('Test Auto');
      expect(sanitizePostgrestSearch('   Trimmed   Name   ')).toBe('Trimmed Name');
    });
  });

  describe('PurchasesService Validation', () => {
    it('rejects supplier invoice creation without supplierId', async () => {
      await expect(
        PurchasesService.createSupplierInvoice({
          supplierId: '',
          supplierInvoiceNumber: 'INV-001',
          date: '2026-08-19',
          items: [{ articleId: 'art-1', quantity: 5, unitCost: 100 }],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('rejects supplier invoice creation with empty items array', async () => {
      await expect(
        PurchasesService.createSupplierInvoice({
          supplierId: 'sup-1',
          supplierInvoiceNumber: 'INV-001',
          date: '2026-08-19',
          items: [],
        })
      ).rejects.toThrow(ValidationError);
    });
  });
});
