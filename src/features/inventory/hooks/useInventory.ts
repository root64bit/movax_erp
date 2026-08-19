import { useState, useEffect, useCallback } from 'react';
import type { Article } from '@/shared/types/domain.types';
import { InventoryService, type ProductCatalogPageResult } from '../services/inventory.service';
import { logger } from '@/shared/lib/logger';

export function useInventory(initialLimit = 25) {
  const [data, setData] = useState<ProductCatalogPageResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'WITH_STOCK' | 'NO_STOCK' | 'LOW_STOCK'>('ALL');
  const [sort, setSort] = useState<'CODE' | 'MOST_SOLD' | 'STOCK_ASC' | 'STOCK_DESC'>('CODE');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(initialLimit);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const offset = (page - 1) * limit;
      const result = await InventoryService.fetchProductsPage({
        search: search || undefined,
        category: category || undefined,
        stockFilter,
        sort,
        limit,
        offset,
      });
      setData(result);
    } catch (err: any) {
      logger.error('Failed to load inventory catalog', err, { module: 'useInventory' });
      setError(err.message || 'Falha ao carregar catálogo.');
    } finally {
      setLoading(false);
    }
  }, [search, category, stockFilter, sort, page, limit]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  return {
    articles: data?.rows || [],
    totalCount: data?.totalCount || 0,
    totals: data?.totals || {
      stockQty: 0,
      stockCostValue: 0,
      stockSaleValue: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
    },
    canViewCost: data?.canViewCost ?? false,
    loading,
    error,
    page,
    limit,
    search,
    category,
    stockFilter,
    sort,
    setPage,
    setLimit,
    setSearch,
    setCategory,
    setStockFilter,
    setSort,
    refresh: loadCatalog,
  };
}
