import { requireSupabase } from '@/integrations/supabase/client';
import { numberValue, stringValue } from '@/integrations/supabase/helpers';
import { logger } from '@/shared/lib/logger';
import { AppError, ValidationError } from '@/shared/utils/errorUtils';
import type { Article, StockMovement } from '@/shared/types/domain.types';

export interface ProductCatalogPageResult {
  rows: Article[];
  totalCount: number;
  totals: {
    stockQty: number;
    stockCostValue: number;
    stockSaleValue: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
  canViewCost: boolean;
}

export interface SaveArticleInput {
  id?: string;
  code: string;
  barcode?: string;
  description: string;
  unit: string;
  minStock: number;
  stock?: number;
  costPrice: number;
  profitMargin: number;
  sellPrice: number;
  sellPriceWithIva: number;
  taxRate: number;
  category?: string;
  categoryId?: string;
  brand?: string;
  brandId?: string;
  unitId?: string;
}

export interface StockMovementsPageResult {
  rows: StockMovement[];
  totalCount: number;
  totalStock: number;
}

export interface StockExtractResult {
  opening_balance: number;
  current_stock?: number;
  movement_count?: number;
  totals: {
    total_in_qty: number;
    total_out_qty: number;
    total_in_val: number;
    total_out_val: number;
  };
  movements: Array<{
    id: string;
    created_at: string;
    doc_ref: string;
    doc_type_code?: string;
    doc_type_name?: string;
    source_document_id?: string;
    movement_direction: 'ENTRADA' | 'SAIDA';
    quantity_in: number;
    quantity_out: number;
    running_balance: number;
    unit_cost?: number;
    movement_value?: number;
    operator_name?: string;
  }>;
  total_count?: number;
  can_view_cost?: boolean;
}

export const InventoryService = {
  async fetchProductsPage(params: {
    search?: string;
    category?: string;
    stockFilter?: 'ALL' | 'WITH_STOCK' | 'NO_STOCK' | 'LOW_STOCK';
    sort?: 'CODE' | 'MOST_SOLD' | 'STOCK_ASC' | 'STOCK_DESC';
    codeFrom?: string;
    codeTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<ProductCatalogPageResult> {
    const client = requireSupabase();
    const { data, error } = await client.rpc('get_products_page_v1', {
      p_search: params.search?.trim() || null,
      p_category: params.category?.trim() || null,
      p_stock_filter: params.stockFilter || 'ALL',
      p_sort: params.sort || 'CODE',
      p_code_from: params.codeFrom?.trim() || null,
      p_code_to: params.codeTo?.trim() || null,
      p_limit: params.limit ?? 25,
      p_offset: params.offset ?? 0,
    });

    if (error) {
      logger.error('Failed to fetch product catalog page', error, { module: 'InventoryService' });
      throw new AppError(error.message || 'Falha ao carregar catálogo de artigos.');
    }

    const result = (data || {}) as Record<string, any>;
    const totals = (result.totals ?? {}) as Record<string, any>;

    return {
      rows: ((result.rows ?? []) as Record<string, any>[]).map((row) => ({
        id: String(row.id),
        code: String(row.code ?? ''),
        barcode: row.barcode ? String(row.barcode) : undefined,
        description: String(row.description ?? ''),
        unit: String(row.unit ?? 'UN'),
        minStock: numberValue(row.min_stock),
        stock: numberValue(row.stock),
        costPrice: numberValue(row.avg_cost),
        profitMargin: numberValue(row.profit_pct),
        sellPrice: numberValue(row.sale_price_excl),
        sellPriceWithIva: numberValue(row.sale_price_incl),
        taxCodeId: row.tax_code_id ?? undefined,
        taxRate: numberValue(row.tax_rate),
        category: stringValue(row.category_name).toLowerCase() || 'geral',
        categoryId: row.category_id ?? undefined,
        categoryName: row.category_name ?? undefined,
        brand: row.brand_name ?? undefined,
        brandId: row.brand_id ?? undefined,
        brandName: row.brand_name ?? undefined,
        unitId: row.unit_id ?? undefined,
        soldQuantity: numberValue(row.sold_qty),
      })),
      totalCount: numberValue(result.total_count),
      totals: {
        stockQty: numberValue(totals.stock_qty),
        stockCostValue: numberValue(totals.stock_cost_value),
        stockSaleValue: numberValue(totals.stock_sale_value),
        lowStockCount: numberValue(totals.low_stock_count),
        outOfStockCount: numberValue(totals.out_of_stock_count),
      },
      canViewCost: Boolean(result.can_view_cost),
    };
  },

  async searchProducts(search: string, warehouseId?: string, limit = 40): Promise<Article[]> {
    const client = requireSupabase();
    const { data, error } = await client.rpc('search_stock_products_v1', {
      p_search: search.trim(),
      p_warehouse_id: warehouseId || null,
      p_limit: Math.min(Math.max(limit, 1), 100),
    });

    if (error) {
      logger.error('Failed to search stock products', error, { module: 'InventoryService', search });
      throw new AppError(error.message || 'Falha ao pesquisar artigos.');
    }

    return ((data ?? []) as Record<string, any>[]).map((row) => ({
      id: String(row.id),
      code: String(row.code ?? ''),
      barcode: row.barcode ? String(row.barcode) : undefined,
      description: String(row.description ?? ''),
      unit: String(row.unit ?? 'UN'),
      minStock: numberValue(row.min_stock),
      stock: numberValue(row.stock),
      costPrice: numberValue(row.avg_cost),
      profitMargin: numberValue(row.profit_pct),
      sellPrice: numberValue(row.sale_price_excl),
      sellPriceWithIva: numberValue(row.sale_price_incl),
      taxCodeId: row.tax_code_id ?? undefined,
      taxRate: numberValue(row.tax_rate),
      category: stringValue(row.category_name).toLowerCase() || 'geral',
      categoryId: row.category_id ?? undefined,
      categoryName: row.category_name ?? undefined,
      brand: row.brand_name ?? undefined,
      brandId: row.brand_id ?? undefined,
      brandName: row.brand_name ?? undefined,
      unitId: row.unit_id ?? undefined,
    }));
  },

  async saveArticle(input: SaveArticleInput): Promise<void> {
    if (!input.code.trim()) throw new ValidationError('O código do artigo é obrigatório.');
    if (!input.description.trim()) throw new ValidationError('A descrição do artigo é obrigatória.');

    const client = requireSupabase();
    const { error } = await client.rpc('upsert_operational_article_v1', {
      p_article_id: input.id || null,
      p_code: input.code.trim().toUpperCase(),
      p_barcode: input.barcode?.trim() || null,
      p_description: input.description.trim(),
      p_unit: input.unit.trim().toUpperCase() || 'UN',
      p_min_stock: Number(input.minStock) || 0,
      p_cost_price: Number(input.costPrice) || 0,
      p_profit_margin: Number(input.profitMargin) || 0,
      p_sell_price: Number(input.sellPrice) || 0,
      p_sell_price_with_iva: Number(input.sellPriceWithIva) || 0,
      p_tax_rate: Number(input.taxRate) || 16,
      p_category_name: input.category?.trim() || 'Geral',
      p_brand_name: input.brand?.trim() || null,
    });

    if (error) {
      if (error.message.includes('duplicate key') || error.message.includes('uq_product_code')) {
        throw new ValidationError(`O código de artigo "${input.code}" já existe.`);
      }
      logger.error('Failed to save article', error, { module: 'InventoryService', code: input.code });
      throw new AppError(error.message || 'Falha ao guardar artigo.');
    }
  },

  async fetchArticleLedger(productId: string, warehouseId?: string): Promise<StockMovement[]> {
    const client = requireSupabase();
    const { data, error } = await client.rpc('get_product_movements_extract_v1', {
      p_product_id: productId,
      p_warehouse_id: warehouseId || null,
    });

    if (error) {
      logger.error('Failed to fetch article ledger extract', error, { module: 'InventoryService', productId });
      throw new AppError(error.message || 'Falha ao carregar extrato de movimentos.');
    }

    return ((data ?? []) as Record<string, any>[]).map((row) => ({
      id: String(row.id),
      productId: String(row.product_id),
      type: row.movement_type === 'ENTRY' || row.movement_type === 'ENTRADA' ? 'entrada' : 'saida',
      docRef: String(row.doc_number || row.document_number || 'N/A'),
      date: String(row.movement_date || row.created_at),
      articleCode: String(row.product_code || ''),
      articleDescription: String(row.product_name || ''),
      quantity: Math.abs(numberValue(row.quantity)),
      entityName: String(row.party_name || 'Operação Interna'),
      operator: String(row.operator_name || 'Sistema'),
      warehouseName: row.warehouse_name ? String(row.warehouse_name) : undefined,
      quantityIn: numberValue(row.quantity_in),
      quantityOut: numberValue(row.quantity_out),
      balanceAfter: numberValue(row.running_balance),
      unitCost: numberValue(row.unit_cost),
    }));
  },

  async fetchStockMovementsPage(
    from: string,
    to: string,
    movementType: 'ALL' | 'entrada' | 'saida',
    search: string,
    limit: number,
    offset: number
  ): Promise<StockMovementsPageResult> {
    const client = requireSupabase();
    const { data, error } = await client.rpc('get_stock_movements_page_v2', {
      p_from: from || null,
      p_to: to || null,
      p_movement_type: movementType === 'entrada' ? 'ENTRADA' : movementType === 'saida' ? 'SAIDA' : 'ALL',
      p_search: search.trim() || null,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      logger.error('Failed to fetch stock movements page', error, { module: 'InventoryService' });
      throw new AppError(error.message || 'Falha ao carregar histórico de movimentos.');
    }

    const result = data as Record<string, any>;
    return {
      totalCount: numberValue(result.total_count),
      totalStock: numberValue(result.total_stock),
      rows: ((result.rows ?? []) as Record<string, any>[]).map((row) => ({
        id: String(row.id),
        productId: String(row.product_id),
        type: row.movement_direction === 'ENTRADA' ? 'entrada' : 'saida',
        docRef: String(row.doc_ref ?? ''),
        sourceDocumentId: row.source_document_id ? String(row.source_document_id) : undefined,
        docTypeCode: row.doc_type_code ? String(row.doc_type_code) : undefined,
        docTypeName: row.doc_type_name ? String(row.doc_type_name) : undefined,
        date: String(row.created_at),
        articleCode: String(row.product_code ?? ''),
        articleDescription: String(row.product_description ?? ''),
        quantity: Math.max(numberValue(row.quantity_in), numberValue(row.quantity_out)),
        quantityIn: numberValue(row.quantity_in),
        quantityOut: numberValue(row.quantity_out),
        balanceAfter: numberValue(row.balance_after),
        entityName: '',
        operator: String(row.operator_name ?? 'Sistema'),
        warehouseId: row.warehouse_id ? String(row.warehouse_id) : undefined,
        warehouseName: row.warehouse_name ? String(row.warehouse_name) : undefined,
        reason: String(row.reason ?? ''),
        unitCost: numberValue(row.unit_cost),
      })),
    };
  },

  async fetchStockMovementExtract(
    productId: string,
    from?: string,
    to?: string,
    movementType = 'ALL',
    limit = 100,
    offset = 0
  ): Promise<StockExtractResult> {
    const client = requireSupabase();
    const { data, error } = await client.rpc('get_stock_movement_extract_v2', {
      p_product_id: productId,
      p_from: from || null,
      p_to: to || null,
      p_movement_type: movementType,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      logger.error('Failed to fetch stock movement extract', error, { module: 'InventoryService', productId });
      throw new AppError(error.message || 'Falha ao carregar extracto de stock.');
    }

    return data as StockExtractResult;
  },
};
