import { describe, it, expect, vi } from 'vitest';
import { InventoryService } from '../../src/features/inventory/services/inventory.service';
import { isWalkInClient, normalizeClientSearch, getArticlePriceWithIva, createPosArticleSearchLoader } from '../../src/features/pos/utils/posCalculations';
import type { Article, Client } from '../../src/shared/types/domain.types';

describe('POS Domain Hooks & Context Isolation Contract', () => {
  const dummyArticles: Article[] = [
    {
      id: 'art-1',
      code: 'PROD-A',
      description: 'Produto Armazém A',
      unit: 'UN',
      stock: 100,
      minStock: 10,
      costPrice: 50,
      sellPrice: 100,
      taxRate: 16,
      category: 'Geral',
    },
    {
      id: 'art-2',
      code: 'PROD-EXEMPT',
      description: 'Produto Isento 0%',
      unit: 'UN',
      stock: 50,
      minStock: 5,
      costPrice: 200,
      sellPrice: 250,
      taxRate: 0,
      category: 'Alimentar',
    },
  ];

  const dummyClients: Client[] = [
    { id: 'c-1', number: 1, name: 'Cliente Pontual', email: '', phone: '', address: '', taxNumber: '', balance: 0, pendingBalance: 0 },
    { id: 'c-2', code: 'CUST-002', name: 'Transportes Machava, Lda.', email: 'machava@test.com', phone: '841234567', address: 'Av. das FPLM, 123', taxNumber: '400123456', balance: 0, pendingBalance: 15000 },
    { id: 'c-3', code: 'CUST-003', name: 'Supermercado Central', email: 'central@test.com', phone: '829876543', address: 'Rua da Resistência', taxNumber: '400987654', balance: 0, pendingBalance: 0 },
  ];

  it('preserves warehouseId operational context in remote product lookup via createPosArticleSearchLoader', async () => {
    const searchSpy = vi.spyOn(InventoryService, 'searchProducts').mockResolvedValueOnce([dummyArticles[0]]);

    const activeWarehouseId = 'WH-MAPUTO-01';
    // Use the real production loader factory:
    const productionLoader = createPosArticleSearchLoader(activeWarehouseId);

    const results = await productionLoader('PROD-A');

    expect(searchSpy).toHaveBeenCalledWith('PROD-A', 'WH-MAPUTO-01', 50);
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe('PROD-A');

    searchSpy.mockRestore();
  });

  it('calculates article price with IVA correctly for 0% and standard rates', () => {
    // 0% VAT
    const priceExempt = getArticlePriceWithIva(dummyArticles[1]);
    expect(priceExempt).toBe(250); // 250 * (1 + 0/100) = 250

    // 16% VAT
    const priceStandard = getArticlePriceWithIva(dummyArticles[0]);
    expect(priceStandard).toBe(116); // 100 * (1 + 16/100) = 116
  });

  it('performs normalized customer search without accent or case sensitivity', () => {
    const query1 = normalizeClientSearch('macháva');
    expect(query1).toBe('machava');

    const matches = dummyClients
      .filter((c) => !isWalkInClient(c))
      .filter((c) => normalizeClientSearch(c.name).includes(query1));

    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe('c-2');
  });

  it('accurately distinguishes registered account customers from walk-in consumers', () => {
    expect(isWalkInClient(dummyClients[0])).toBe(true);
    expect(isWalkInClient(dummyClients[1])).toBe(false);
    expect(isWalkInClient(dummyClients[2])).toBe(false);
  });
});
