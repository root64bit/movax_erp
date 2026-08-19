import type {
  Article,
  Client,
  CompanyProfile,
  DocumentRecord,
  LedgerRecord,
  PaymentRecord,
  SaleInvoice,
  SaleItem,
  StockMovement,
  Supplier,
  UserSummary,
  PurchaseInvoiceInput,
  UserContext,
  DashboardMetrics,
  ReferenceOption,
  BankAccount,
  StockTransfer,
  StockTransferLine,
  CashSession,
  SubscriptionPlan,
  SubscriptionPlanCode,
  CompanySubscription,
  LicenseUsage,
  CompanyAddonItem,
  LicenseBillingInvoice,
  LicenseOverview,
  TenantOnboardingInput,
} from '../types';
import { requireSupabase } from './supabase';
import { bundleCodesFromRoleCodes } from './responsibilityBundles';
import { calculateDocumentLine, calculateDocumentTotals, isUuid, recalculateSaleItems } from './documentCalculations';

export interface AppData {
  company: CompanyProfile;
  permissions: string[];
  articles: Article[];
  clients: Client[];
  suppliers: Supplier[];
  sales: SaleInvoice[];
  movements: StockMovement[];
  documents: DocumentRecord[];
  payments: PaymentRecord[];
  ledger: LedgerRecord[];
  users: UserSummary[];
  systemMode: string;
  userContext: UserContext;
  dashboardMetrics: DashboardMetrics;
  paymentTerms: ReferenceOption[];
  paymentMethods: ReferenceOption[];
  productCategories: ReferenceOption[];
  brands: ReferenceOption[];
  units: ReferenceOption[];
  taxCodes: ReferenceOption[];
}

export async function createArticle(article: Omit<Article, 'id'>): Promise<void> {
  const client = requireSupabase();
  const cleanCode = article.code.toUpperCase().trim();
  const { error } = await client.rpc('create_operational_product_v2', {
    p_product: {
      code: cleanCode,
      description: article.description,
      unit: article.unit,
      min_stock: article.minStock,
      cost_price: article.costPrice,
      profit_margin: article.profitMargin,
      sale_price_excl: article.sellPrice,
      sale_price_incl: article.sellPriceWithIva,
      notes: article.size ? `Medida: ${article.size}` : null,
      category_id: article.categoryId || null,
      category_name: article.categoryName || null,
      brand_id: article.brandId || null,
      brand_name: article.brandName || null,
      unit_id: article.unitId || null,
      tax_code_id: article.taxCodeId || null,
    },
  });

  if (!error) return;

  if (error.message.includes('duplicate key') || error.message.includes('uq_product')) {
    throw new Error(`O código de artigo "${cleanCode}" já existe.`);
  }
  throw new Error(error.message || 'Falha ao guardar artigo.');
}

export async function updateArticle(article: Article): Promise<void> {
  const client = requireSupabase();
  const cleanCode = article.code.toUpperCase().trim();

  // Try RPC update_operational_product_v2
  const { error } = await client.rpc('update_operational_product_v2', {
    p_product: {
      id: article.id,
      code: cleanCode,
      description: article.description.trim(),
      unit: article.unit,
      min_stock: article.minStock || 0,
      cost_price: article.costPrice || 0,
      profit_margin: article.profitMargin || 0,
      sale_price_excl: article.sellPrice || 0,
      sale_price_incl: article.sellPriceWithIva || 0,
      notes: article.size ? `Medida: ${article.size}` : null,
      category_id: article.categoryId || null,
      category_name: article.categoryName || article.category || null,
      brand_id: article.brandId || null,
      brand_name: article.brandName || article.brand || null,
      brand: article.brand || null,
      unit_id: article.unitId || null,
      tax_code_id: article.taxCodeId || null,
    },
  });

  if (!error) return;

  // Fallback to direct update if RPC fails
  const fallback = await client
    .from('products')
    .update({
      code: cleanCode,
      description: article.description.trim(),
      min_stock: article.minStock || 0,
      avg_cost: article.costPrice || 0,
      profit_pct: article.profitMargin || 0,
      sale_price_excl: article.sellPrice || 0,
      sale_price_incl: article.sellPriceWithIva || 0,
      category_id: article.categoryId || null,
      brand_id: article.brandId || null,
      unit_id: article.unitId || null,
      tax_code_id: article.taxCodeId || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', article.id);

  if (fallback.error) {
    throw new Error(error.message || fallback.error.message || 'Falha ao atualizar artigo.');
  }
}

export async function deleteArticle(id: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('products')
    .update({ is_active: false })
    .eq('id', id);

  if (error) throw new Error(error.message || 'Falha ao desativar artigo.');
}

export interface DocumentUpdatePayload {
  documentDate?: string;
  clientName?: string;
  clientNuit?: string;
  clientAddress?: string;
  grandTotal?: number;
  notes?: string;
  items?: SaleItem[];
  generalDiscount?: number;
  keepAsWalkIn?: boolean;
}

export async function updateDocumentDetails(documentId: string, payload: DocumentUpdatePayload): Promise<void> {
  const client = requireSupabase();

  const lines = payload.items ? recalculateSaleItems(payload.items) : undefined;
  const { error } = await client.rpc('update_operational_document_v2', {
    p_document_id: documentId,
    p_document_date: payload.documentDate || null,
    p_client_name: payload.clientName?.trim() || null,
    p_client_nuit: payload.clientNuit !== undefined ? payload.clientNuit.trim() : null,
    p_client_address: payload.clientAddress !== undefined ? payload.clientAddress.trim() : null,
    p_grand_total: payload.grandTotal !== undefined ? Number(payload.grandTotal) : null,
    p_notes: payload.notes !== undefined ? payload.notes.trim() : null,
    p_lines: lines && lines.length > 0 ? lines : null,
    p_general_discount: Math.max(0, Number(payload.generalDiscount) || 0),
    p_keep_as_walk_in: Boolean(payload.keepAsWalkIn),
  });

  if (error) {
    console.error('❌ Error in update_operational_document RPC:', error);
    throw new Error(error.message || 'Falha ao atualizar documento.');
  }
}

export interface PartyInput {
  number: string;
  name: string;
  taxNumber: string;
  telephone: string;
  email: string;
  address: string;
  city: string;
  contactPerson?: string;
  creditLimit: number;
  paymentTermCode: string;
}

export async function createCustomer(input: PartyInput): Promise<void> {
  const client = requireSupabase();
  const cleanNumber = input.number.toUpperCase().trim();
  const cleanName = input.name.trim();

  // Try RPC first
  const { error } = await client.rpc('create_operational_customer', {
    p_customer: {
      number: cleanNumber,
      name: cleanName,
      tax_number: input.taxNumber || null,
      telephone: input.telephone || null,
      email: input.email || null,
      address: input.address || null,
      city: input.city || null,
      credit_limit: input.creditLimit || 0,
      payment_term_code: input.paymentTermCode || 'DINHEIRO',
    },
  });

  if (!error) return;

  if (error.message.includes('duplicate key') || error.message.includes('uq_customer')) {
    throw new Error(`O código de cliente "${input.number}" já existe. Por favor utilize um código diferente.`);
  }
  throw new Error(error.message || 'Falha ao guardar cliente.');
}

export async function createSupplier(input: PartyInput): Promise<void> {
  const client = requireSupabase();
  const cleanNumber = input.number.toUpperCase().trim();
  const cleanName = input.name.trim();

  // Try RPC first
  const { error } = await client.rpc('create_operational_supplier', {
    p_supplier: {
      number: cleanNumber,
      name: cleanName,
      tax_number: input.taxNumber || null,
      telephone: input.telephone || null,
      email: input.email || null,
      address: input.address || null,
      city: input.city || null,
      contact_person: input.contactPerson || null,
      credit_limit: input.creditLimit || 0,
      payment_term_code: input.paymentTermCode || 'DINHEIRO',
    },
  });

  if (!error) return;

  if (error.message.includes('duplicate key') || error.message.includes('uq_supplier')) {
    throw new Error(`O código de fornecedor "${input.number}" já existe. Por favor utilize um código diferente.`);
  }
  throw new Error(error.message || 'Falha ao guardar fornecedor.');
}

export async function postStockMovement(movement: StockMovement): Promise<void> {
  const client = requireSupabase();
  if (!movement.warehouseId) throw new Error('Selecione o armazém.');
  const articleResult = await client
    .from('products')
    .select('id,avg_cost,tax_rate')
    .eq('code', movement.articleCode)
    .maybeSingle();
  if (articleResult.error || !articleResult.data?.id) throw new Error('Artigo não encontrado.');

  const defaultReason = movement.type === 'entrada' ? 'Entrada Direta Manual' : 'Saída Direta Manual';
  const reasonToPass = (movement.reason && movement.reason.trim()) ? movement.reason.trim() : defaultReason;

  const { error } = await client.rpc('post_operational_stock_movement_v2', {
    p_warehouse_id: movement.warehouseId,
    p_product_id: articleResult.data.id,
    p_movement_type: movement.type === 'entrada' ? 'direct_entry' : 'direct_exit',
    p_quantity: movement.quantity,
    p_reason: reasonToPass,
    p_reference: movement.docRef?.trim() || null,
    p_notes: movement.notes?.trim() || null,
    p_idempotency_key: crypto.randomUUID(),
  });

  if (error) throw new Error(error.message || 'Falha ao registar movimento de stock.');

  // Auto-update product sell price if a price with IVA was provided on stock entry
  if (movement.sellPriceWithIva && movement.sellPriceWithIva > 0 && movement.type === 'entrada') {
    const taxRate = articleResult.data.tax_rate ?? 16;
    const newSellPrice = Math.round((movement.sellPriceWithIva / (1 + taxRate / 100)) * 100) / 100;

    await client
      .from('products')
      .update({
        sale_price_excl: newSellPrice,
        sale_price_incl: movement.sellPriceWithIva,
        updated_at: new Date().toISOString(),
      })
      .eq('id', articleResult.data.id);
  }
}

async function resolveOrRegisterCustomer(
  client: any,
  customerId: string,
  clientName?: string,
  clientNuit?: string,
  clientAddress?: string,
  keepAsWalkIn = false,
): Promise<string> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerId);
  const { data, error } = await client.rpc('resolve_or_create_operational_customer_v2', {
    p_customer_id: isUuid ? customerId : null,
    p_client_name: clientName?.trim() || null,
    p_client_nuit: clientNuit?.trim() || null,
    p_client_address: clientAddress?.trim() || null,
    p_keep_as_walk_in: keepAsWalkIn,
  });

  if (error) {
    throw new Error(error.message || 'Falha ao pesquisar ou registar o cliente.');
  }
  if (!data) {
    throw new Error('Cliente inválido. Registe pelo menos um cliente no sistema.');
  }

  return String(data);
}

export async function saveStockGuide(input: import('../types').StockGuideInput): Promise<string> {
  const client = requireSupabase();
  const params = {
    p_guide_number: input.guideNumber.trim(),
    p_document_date: input.date,
    p_warehouse_id: input.warehouseId,
    p_supplier_id: input.type === 'entrada' && input.supplierId ? input.supplierId : null,
    p_notes: input.notes?.trim() || null,
    p_items: input.items.map((item) => ({
      product_id: item.articleId,
      quantity: item.quantity,
      unit_cost: item.unitCost ?? null,
      sale_price_incl: input.type === 'entrada' ? (item.salePriceWithIva ?? null) : null,
    })),
  };
  const result = input.id
    ? await client.rpc('update_stock_guide_v2', { p_document_id: input.id, ...params })
    : await client.rpc('create_stock_guide_v2', {
        p_guide_type: input.type === 'entrada' ? 'STOCK_ENTRY_GUIDE' : 'STOCK_EXIT_GUIDE',
        p_idempotency_key: crypto.randomUUID(),
        ...params,
      });
  if (result.error) throw new Error(result.error.message || 'Falha ao guardar a guia de stock.');
  return String(result.data);
}

export async function cancelStockGuide(documentId: string, reason: string): Promise<void> {
  const { error } = await requireSupabase().rpc('cancel_stock_guide_v2', {
    p_document_id: documentId,
    p_reason: reason.trim(),
    p_idempotency_key: crypto.randomUUID(),
  });
  if (error) throw new Error(error.message || 'Falha ao anular a guia de stock.');
}

export async function updateOperationalParty(
  type: 'customer' | 'supplier',
  partyId: string,
  input: PartyInput,
  active = true,
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('admin_update_operational_party', {
    p_party_type: type.toUpperCase(),
    p_party_id: partyId,
    p_data: {
      number: input.number.trim(),
      name: input.name.trim(),
      tax_number: input.taxNumber.trim() || null,
      telephone: input.telephone.trim() || null,
      email: input.email.trim() || null,
      address: input.address.trim() || null,
      city: input.city.trim() || null,
      contact_person: input.contactPerson?.trim() || null,
    },
    p_active: active,
  });
  if (error) {
    if (error.message.includes('WALK_IN_CUSTOMER_CANNOT_BE_DEACTIVATED')) {
      throw new Error('O Cliente Pontual (código 1) é obrigatório e não pode ser apagado.');
    }
    if (error.message.includes('duplicate key')) {
      throw new Error(`O código "${input.number}" já está em uso.`);
    }
    throw new Error(error.message || `Falha ao actualizar ${type === 'customer' ? 'cliente' : 'fornecedor'}.`);
  }
}

export async function createCustomerSale(
  sale: SaleInvoice,
  customerId: string,
): Promise<SaleInvoice> {
  const client = requireSupabase();
  const idempotencyKey = crypto.randomUUID();

  const targetCustomerId = await resolveOrRegisterCustomer(
    client,
    customerId,
    sale.clientName,
    sale.clientNuit,
    sale.clientAddress,
    sale.keepAsWalkIn,
  );

  const encodedNotes = `[CLIENTE: ${sale.clientName} | NUIT: ${sale.clientNuit || 'N/A'} | MORADA: ${sale.clientAddress || 'N/A'}] ${sale.notes || ''}`.trim();

  const calculated = calculateDocumentTotals(sale.items, sale.descontoTotal - sale.items.reduce((sum, item) => sum + (item.discountAmount || 0), 0));
  const { data, error } = await client.rpc('create_and_confirm_customer_sale_v3', {
    p_customer_id: targetCustomerId,
    p_document_date: sale.date,
    p_payment_term_code: sale.paymentTermCode ?? 'DINHEIRO',
    p_items: calculated.lines.map((item) => ({
      article_id: item.articleId,
      code: item.code || 'DIV',
      description: item.description,
      quantity: item.quantity,
      unit_price_incl: item.unitPrice || 0,
      discount_amount: item.discountAmount || 0,
      tax_rate: item.ivaPercent ?? 16,
      line_type: item.lineType || (isUuid(item.articleId) ? 'STOCK' : 'MANUAL'),
      stock_effect_enabled: item.stockEffectEnabled ?? isUuid(item.articleId),
    })),
    p_idempotency_key: idempotencyKey,
    p_document_type_code: sale.documentTypeCode ?? 'CUSTOMER_INVOICE',
    p_notes: encodedNotes,
    p_general_discount: calculated.generalDiscount,
    p_payment_method_code: sale.paymentMethod || 'CASH',
    p_payment_reference: sale.paymentReference?.trim() || null,
  });

  if (error) throw new Error(error.message || 'Falha ao confirmar a venda.');
  if (!data) throw new Error('A venda não devolveu um documento confirmado.');

  const document = Array.isArray(data) ? data[0] : data;
  return {
    ...sale,
    clientId: targetCustomerId,
    id: document.id,
    docNumber: document.display_number,
    totalAmount: numberValue(document.grand_total),
    paidAmount: numberValue(document.amount_paid),
    pendingAmount: numberValue(document.outstanding_amount),
    status: ['CONFIRMED', 'PAID'].includes(document.status) ? 'Concluída' : 'Pendente',
  };

}

export async function createQuotation(
  sale: SaleInvoice,
  customerId: string,
): Promise<SaleInvoice> {
  const client = requireSupabase();

  const targetCustomerId = await resolveOrRegisterCustomer(
    client,
    customerId,
    sale.clientName,
    sale.clientNuit,
    sale.clientAddress,
    sale.keepAsWalkIn,
  );

  const encodedNotes = `[CLIENTE: ${sale.clientName} | NUIT: ${sale.clientNuit || 'N/A'} | MORADA: ${sale.clientAddress || 'N/A'}] ${sale.notes || ''}`.trim();
  const calculated = calculateDocumentTotals(sale.items, sale.descontoTotal - sale.items.reduce((sum, item) => sum + (item.discountAmount || 0), 0));
  const { data, error } = await client.rpc('create_and_confirm_customer_quotation_v2', {
    p_customer_id: targetCustomerId,
    p_document_date: sale.date,
    p_items: calculated.lines.map((item) => ({
      article_id: item.articleId,
      code: item.code || 'DIV',
      description: item.description,
      quantity: item.quantity,
      unit_price_incl: item.unitPrice || 0,
      discount_amount: item.discountAmount || 0,
      tax_rate: item.ivaPercent ?? 16,
      line_type: item.lineType || (isUuid(item.articleId) ? 'STOCK' : 'MANUAL'),
      stock_effect_enabled: false,
    })),
    p_notes: encodedNotes,
    p_idempotency_key: crypto.randomUUID(),
    p_general_discount: calculated.generalDiscount,
  });
  if (error) throw new Error(error.message || 'Falha ao guardar cotação na base de dados.');
  if (!data) throw new Error('A cotação não devolveu um documento confirmado.');
  const insertedDoc = Array.isArray(data) ? data[0] : data;

  return {
    ...sale,
    clientId: targetCustomerId,
    id: insertedDoc.id,
    docNumber: insertedDoc.display_number,
    documentTypeCode: 'CUSTOMER_QUOTATION',
    status: 'Concluída',
    paidAmount: 0,
    subtotalBruto: numberValue(insertedDoc.subtotal),
    descontoTotal: numberValue(insertedDoc.discount_total),
    subtotalLiquido: numberValue(insertedDoc.net_total),
    ivaTotal: numberValue(insertedDoc.tax_total),
    totalAmount: numberValue(insertedDoc.grand_total),
    pendingAmount: numberValue(insertedDoc.outstanding_amount),
  };
}

export async function createCustomerPayment(
  sale: SaleInvoice | DocumentRecord,
  methodCode: string,
  amount: number,
  reference: string,
): Promise<PaymentRecord> {
  const isDocumentRecord = 'partyId' in sale;
  const customerId = isDocumentRecord ? sale.partyId : sale.clientId;
  const pendingAmount = isDocumentRecord ? sale.outstandingAmount : sale.pendingAmount;
  if (!customerId) throw new Error('Cliente do pagamento não identificado.');
  const { data, error } = await requireSupabase().rpc('create_and_confirm_customer_payment', {
    p_customer_id: customerId,
    p_document_id: sale.id,
    p_method_code: methodCode,
    p_amount: Math.min(amount, pendingAmount),
    p_reference: methodCode === 'CASH' ? null : reference.trim(),
    p_idempotency_key: crypto.randomUUID(),
  });
  if (error) throw error;
  const payment = Array.isArray(data) ? data[0] : data;
  return {
    id: payment.id,
    displayNumber: payment.display_number,
    date: payment.payment_date,
    direction: 'CUSTOMER_RECEIPT',
    partyName: 'clientName' in sale ? sale.clientName : sale.partyName,
    totalAmount: numberValue(payment.total_amount),
    allocatedAmount: numberValue(payment.allocated_amount),
    unappliedAmount: numberValue(payment.unapplied_amount),
    status: payment.status,
    reference: payment.external_reference ?? reference,
    description: payment.description ?? undefined,
  };
}

export async function createSupplierInvoice(
  invoice: PurchaseInvoiceInput,
): Promise<DocumentRecord> {
  const client = requireSupabase();
  const idempotencyKey = crypto.randomUUID();

  // 1. Try RPC first
  const { data, error } = await client.rpc(
    'create_and_confirm_supplier_invoice',
    {
      p_supplier_id: invoice.supplierId,
      p_document_date: invoice.date,
      p_payment_term_code: invoice.paymentTermCode || 'DINHEIRO',
      p_supplier_invoice_number: invoice.supplierInvoiceNumber.trim(),
      p_items: invoice.items.map((item) => ({
        article_id: item.articleId,
        quantity: item.quantity,
        unit_cost: item.unitCost,
        discount_percent: item.discountPercent || 0,
      })),
      p_idempotency_key: idempotencyKey,
    },
  );

  if (!error && data) {
    const document = Array.isArray(data) ? data[0] : data;
    return {
      id: document.id,
      displayNumber: document.display_number,
      date: document.document_date,
      dueDate: document.due_date ?? '',
      typeCode: 'SUPPLIER_INVOICE',
      typeName: 'Factura de Fornecedor',
      partyType: 'SUPPLIER',
      partyId: invoice.supplierId,
      partyName: '',
      status: document.status,
      netTotal: numberValue(document.net_total),
      taxTotal: numberValue(document.tax_total),
      grandTotal: numberValue(document.grand_total),
      paidAmount: numberValue(document.amount_paid),
      outstandingAmount: numberValue(document.outstanding_amount),
    };
  }

  const msg = error?.message || 'Falha ao confirmar a compra.';
  throw new Error(msg);
}

export async function createSupplierPayment(
  document: DocumentRecord,
  methodCode: string,
  amount: number,
  reference: string,
): Promise<PaymentRecord> {
  const client = requireSupabase();
  const { data, error } = await client.rpc(
    'create_and_confirm_supplier_payment',
    {
      p_supplier_id: document.partyId,
      p_document_id: document.id,
      p_method_code: methodCode,
      p_amount: Math.min(amount, document.outstandingAmount),
      p_reference: methodCode === 'CASH' ? null : reference.trim(),
      p_idempotency_key: crypto.randomUUID(),
    },
  );

  if (error) throw new Error(error.message || 'Falha ao registar pagamento do fornecedor.');
  const payment = Array.isArray(data) ? data[0] : data;
  return {
    id: payment.id,
    displayNumber: payment.display_number,
    date: payment.payment_date,
    direction: 'SUPPLIER_PAYMENT',
    partyName: document.partyName,
    totalAmount: numberValue(payment.total_amount),
    allocatedAmount: numberValue(payment.allocated_amount),
    unappliedAmount: numberValue(payment.unapplied_amount),
    status: payment.status,
    reference: payment.external_reference ?? reference,
    description: payment.description ?? undefined,
  };
}

type Row = Record<string, any>;

const numberValue = (value: unknown) => Number(value ?? 0);
const relation = (value: unknown): Row | null =>
  Array.isArray(value) ? (value[0] ?? null) : ((value as Row | null) ?? null);

const categoryValue = (name: unknown): string => {
  const str = String(name ?? '').trim();
  return str ? str.toLowerCase() : 'geral';
};


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

export async function fetchProductsPage(params: {
  search?: string;
  category?: string;
  stockFilter?: 'ALL' | 'WITH_STOCK' | 'NO_STOCK' | 'LOW_STOCK';
  sort?: 'CODE' | 'MOST_SOLD' | 'STOCK_ASC' | 'STOCK_DESC';
  codeFrom?: string;
  codeTo?: string;
  limit?: number;
  offset?: number;
}): Promise<ProductCatalogPageResult> {
  const { data, error } = await requireSupabase().rpc('get_products_page_v1', {
    p_search: params.search?.trim() || null,
    p_category: params.category?.trim() || null,
    p_stock_filter: params.stockFilter || 'ALL',
    p_sort: params.sort || 'CODE',
    p_code_from: params.codeFrom?.trim() || null,
    p_code_to: params.codeTo?.trim() || null,
    p_limit: params.limit ?? 25,
    p_offset: params.offset ?? 0,
  });
  if (error) throw new Error(error.message || 'Falha ao carregar catálogo paginado.');
  const result = data as Row;
  const totals = (result.totals ?? {}) as Row;
  return {
    rows: ((result.rows ?? []) as Row[]).map((row) => ({
      id: String(row.id),
      code: String(row.code ?? ''),
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
      category: categoryValue(row.category_name),
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
}

/**
 * Fast article lookup for operational screens. Unlike the catalogue page this can
 * calculate stock for a single warehouse, which prevents a branch from treating
 * group-wide stock as locally available stock.
 */
export async function searchStockProducts(
  search: string,
  warehouseId?: string,
  limit = 40,
): Promise<Article[]> {
  const { data, error } = await requireSupabase().rpc('search_stock_products_v1', {
    p_search: search.trim(),
    p_warehouse_id: warehouseId || null,
    p_limit: Math.min(Math.max(limit, 1), 100),
  });
  if (error) throw new Error(error.message || 'Falha ao pesquisar artigos.');
  return ((data ?? []) as Row[]).map((row) => ({
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
    category: categoryValue(row.category_name),
    categoryId: row.category_id ?? undefined,
    categoryName: row.category_name ?? undefined,
    brand: row.brand_name ?? undefined,
    brandId: row.brand_id ?? undefined,
    brandName: row.brand_name ?? undefined,
    unitId: row.unit_id ?? undefined,
  }));
}

export async function setOperationalContext(warehouseId: string, posTerminalId?: string): Promise<void> {
  const { error } = await requireSupabase().rpc('set_operational_context_v1', {
    p_warehouse_id: warehouseId,
    p_pos_terminal_id: posTerminalId || null,
  });
  if (error) throw new Error(error.message || 'Falha ao alterar o armazém operacional.');
}

export async function fetchStockTransfers(limit = 100): Promise<StockTransfer[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('stock_transfers')
    .select(`
      id,transfer_number,transfer_date,status,notes,created_at,dispatched_at,received_at,
      from_warehouse_id,to_warehouse_id,
      from_warehouse:warehouses!stock_transfers_from_warehouse_id_fkey(id,name),
      to_warehouse:warehouses!stock_transfers_to_warehouse_id_fkey(id,name),
      stock_transfer_lines(id,product_id,quantity,unit_cost,products(code,description))
    `)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 250));
  if (error) throw new Error(error.message || 'Falha ao carregar transferências.');

  return ((data ?? []) as Row[]).map((row) => {
    const fromWarehouse = relation(row.from_warehouse);
    const toWarehouse = relation(row.to_warehouse);
    const lines = ((row.stock_transfer_lines ?? []) as Row[]).map((line): StockTransferLine => {
      const product = relation(line.products);
      return {
        id: String(line.id ?? ''),
        articleId: String(line.product_id ?? ''),
        articleCode: String(product?.code ?? ''),
        articleDescription: String(product?.description ?? ''),
        quantity: numberValue(line.quantity),
        unitCost: numberValue(line.unit_cost),
      };
    });
    return {
      id: String(row.id),
      transferNumber: String(row.transfer_number ?? `TRF-${String(row.id).slice(0, 8).toUpperCase()}`),
      transferDate: String(row.transfer_date ?? ''),
      fromWarehouseId: String(row.from_warehouse_id ?? ''),
      fromWarehouseName: String(fromWarehouse?.name ?? 'Origem'),
      toWarehouseId: String(row.to_warehouse_id ?? ''),
      toWarehouseName: String(toWarehouse?.name ?? 'Destino'),
      status: String(row.status ?? 'PENDING').toUpperCase() as StockTransfer['status'],
      notes: row.notes ? String(row.notes) : undefined,
      createdAt: row.created_at ? String(row.created_at) : undefined,
      dispatchedAt: row.dispatched_at ? String(row.dispatched_at) : undefined,
      receivedAt: row.received_at ? String(row.received_at) : undefined,
      lines,
    };
  });
}

export async function createStockTransfer(input: {
  fromWarehouseId: string;
  toWarehouseId: string;
  transferDate: string;
  notes?: string;
  lines: Array<{ articleId: string; quantity: number }>;
}): Promise<{ id: string; transferNumber: string }> {
  const { data, error } = await requireSupabase().rpc('create_stock_transfer_v1', {
    p_from_warehouse_id: input.fromWarehouseId,
    p_to_warehouse_id: input.toWarehouseId,
    p_transfer_date: input.transferDate,
    p_notes: input.notes?.trim() || null,
    p_lines: input.lines.map((line) => ({ product_id: line.articleId, quantity: line.quantity })),
  });
  if (error) throw new Error(error.message || 'Falha ao criar transferência.');
  return { id: String((data as Row).id), transferNumber: String((data as Row).transfer_number) };
}

export async function dispatchStockTransfer(transferId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('dispatch_stock_transfer_v1', { p_transfer_id: transferId });
  if (error) throw new Error(error.message || 'Falha ao enviar transferência.');
}

export async function receiveStockTransfer(transferId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('receive_stock_transfer_v1', { p_transfer_id: transferId });
  if (error) throw new Error(error.message || 'Falha ao receber transferência.');
}

export async function cancelStockTransfer(transferId: string, reason: string): Promise<void> {
  const { error } = await requireSupabase().rpc('cancel_stock_transfer_v1', {
    p_transfer_id: transferId,
    p_reason: reason.trim() || null,
  });
  if (error) throw new Error(error.message || 'Falha ao cancelar transferência.');
}

export interface OperationalReportData {
  rows: Row[];
  totalCount: number;
  totals: Record<string, number>;
}

export async function loadOperationalReport(
  report: string,
  from: string,
  to: string,
  limit: number,
  offset: number,
): Promise<OperationalReportData> {
  const { data, error } = await requireSupabase().rpc('get_operational_report', {
    p_report: report,
    p_from: from || null,
    p_to: to || null,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw new Error(error.message);
  const result = data as Row;
  return {
    rows: result.rows ?? [],
    totalCount: numberValue(result.total_count),
    totals: result.totals ?? {},
  };
}

import { env } from '../app/config/env';
import {
  DEMO_COMPANY,
  DEMO_ARTICLES,
  DEMO_CLIENTS,
  DEMO_SUPPLIERS,
  DEMO_DOCUMENTS,
  DEMO_MOVEMENTS,
  DEMO_USERS,
  DEMO_METRICS,
  DEMO_PAYMENT_TERMS,
  DEMO_PAYMENT_METHODS,
} from '@/shared/mock';

export type AppDataScope = 'all' | 'core' | 'initial' | 'dashboard' | 'sales' | 'stock' | 'documents' | 'entities' | 'users' | 'reports' | 'after-sale';

export async function loadAppData(scope: AppDataScope = 'all'): Promise<AppData> {
  if (env.useMockData) {
    return {
      company: DEMO_COMPANY,
      permissions: ['*'],
      articles: DEMO_ARTICLES,
      clients: DEMO_CLIENTS,
      suppliers: DEMO_SUPPLIERS,
      sales: [],
      movements: DEMO_MOVEMENTS,
      documents: DEMO_DOCUMENTS,
      payments: [],
      ledger: [],
      users: DEMO_USERS,
      systemMode: 'ONLINE',
      userContext: {
        userId: 'usr-001',
        companyId: DEMO_COMPANY.id || 'a0000000-0000-0000-0000-000000000001',
        fullName: 'Administrador Geral',
        email: 'admin@autopneus.co.mz',
        isActive: true,
        forcePasswordChange: false,
        roles: [{ code: 'ADMINISTRATOR', name: 'Administrador do Sistema' }],
        permissions: ['*'],
        branches: [{ id: 'b001', code: 'SED', name: 'Sede Maputo' }],
        warehouses: [{ id: 'w001', code: 'ARM1', name: 'Armazém Principal' }],
        activeWarehouse: { id: 'w001', code: 'ARM1', name: 'Armazém Principal' },
        activePosTerminal: { id: 'pos001', code: 'POS-01', name: 'Caixa 01' },
        systemMode: 'ONLINE',
      },
      dashboardMetrics: DEMO_METRICS,
      paymentTerms: DEMO_PAYMENT_TERMS,
      paymentMethods: DEMO_PAYMENT_METHODS,
      productCategories: [
        { id: '1', code: 'PNEUS', name: 'Pneus Ligeiros' },
        { id: '2', code: 'PNEUS_4X4', name: 'Pneus 4x4 / SUV' },
        { id: '3', code: 'PNEUS_PESADOS', name: 'Pneus Pesados / Camião' },
        { id: '4', code: 'BATERIAS', name: 'Baterias Auto' },
        { id: '5', code: 'SERVICOS', name: 'Serviços Oficina' },
        { id: '6', code: 'LUBRIFICANTES', name: 'Lubrificantes' },
      ],
      brands: [
        { id: '1', code: 'BRIDGESTONE', name: 'Bridgestone' },
        { id: '2', code: 'MICHELIN', name: 'Michelin' },
        { id: '3', code: 'GOODYEAR', name: 'Goodyear' },
        { id: '4', code: 'CONTINENTAL', name: 'Continental' },
        { id: '5', code: 'WILLARD', name: 'Willard' },
        { id: '6', code: 'EXIDE', name: 'Exide' },
        { id: '7', code: 'CASTROL', name: 'Castrol' },
      ],
      units: [
        { id: '1', code: 'UN', name: 'Unidade (UN)' },
        { id: '2', code: 'KG', name: 'Quilograma (KG)' },
        { id: '3', code: 'L', name: 'Litro (L)' },
        { id: '4', code: 'CX', name: 'Caixa (CX)' },
      ],
      taxCodes: [
        { id: '1', code: 'IVA16', name: 'IVA Taxa Normal (16%)' },
        { id: '2', code: 'ISE', name: 'Isento de IVA (0%)' },
      ],
    };
  }

  const client = requireSupabase();
  const companyIdResult = await client.rpc('get_user_company_id');
  if (companyIdResult.error || !companyIdResult.data) {
    throw companyIdResult.error ?? new Error('Empresa do utilizador não definida.');
  }

  const wants = (...scopes: AppDataScope[]) => scope === 'all' || scopes.includes(scope);
  const skipped = () => Promise.resolve({ data: [] as Row[], error: null });
  const wantsProducts = wants('sales', 'stock', 'documents', 'reports', 'after-sale');
  const wantsCustomers = wants('sales', 'stock', 'documents', 'entities', 'reports', 'after-sale');
  const wantsSuppliers = wants('stock', 'documents', 'entities', 'reports');
  const wantsDocuments = wants('sales', 'stock', 'documents', 'entities', 'reports', 'after-sale');

  const [contextResult, metricsResult, permissionsResult, modeResult, companyResult, productsResult, balancesResult, customersResult, suppliersResult, documentsResult, movementsResult, paymentsResult, ledgerResult, usersResult, paymentTermsResult, paymentMethodsResult, categoriesResult, brandsResult, unitsResult, taxCodesResult, supplierPurchasesRpcResult] =
    await Promise.all([
      client.rpc('get_current_user_context'),
      client.rpc('get_dashboard_metrics'),
      client.rpc('get_user_permissions'),
      client
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'SYSTEM_MODE')
        .single(),
      client
        .from('companies')
        .select('id,name,tax_number,address,city,country,phone,email,currency,bank_bci_account,bank_bci_nib,bank_bim_account,bank_bim_nib,quotation_validity_days,quotation_default_notes,bank_accounts')
        .eq('id', companyIdResult.data)
        .single(),
      wantsProducts ? client
        .from('products')
        .select('id,code,description,min_stock,avg_cost,profit_pct,sale_price_excl,sale_price_incl,tax_code_id,tax_codes(id,code,description,rate),product_categories(id,name),brands(id,name),units_of_measure(id,abbreviation)')
        .eq('is_active', true)
        .order('code')
        .limit(2000) : skipped(),
      wantsProducts ? client.from('inventory_balances').select('product_id,quantity').limit(2000) : skipped(),
      wantsCustomers ? client
        .from('customers')
        .select('id,customer_number,name,tax_number,telephone,email,current_balance,customer_addresses(address_line_1,is_primary)')
        .eq('active', true)
        .order('name')
        .limit(2000) : skipped(),
      wantsSuppliers ? client
        .from('suppliers')
        .select('id,supplier_number,name,tax_number,telephone,email,contact_person,current_balance,supplier_addresses(address_line_1,is_primary)')
        .eq('active', true)
        .order('name')
        .limit(500) : skipped(),
      wantsDocuments ? client.rpc('get_operational_documents_page_v2', { p_limit: 1000, p_offset: 0 }) : skipped(),
      wants('stock', 'after-sale') ? client
        .from('stock_movements')
        .select('id,movement_type,legacy_ref,source_document_id,created_at,quantity_in,quantity_out,unit_cost,products(code,description),warehouses(id,name),user_profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(100) : skipped(),
      wants('documents', 'entities', 'reports') ? client
        .from('payments')
        .select('id,display_number,payment_date,direction,total_amount,allocated_amount,unapplied_amount,status,external_reference,description,customers(name),suppliers(name)')
        .order('payment_date', { ascending: false })
        .limit(2000) : skipped(),
      wants('documents', 'entities', 'reports') ? client
        .from('ledger_entries')
        .select('id,entry_date,party_type,entry_type,debit_amount,credit_amount,outstanding_amount,status,customers(name),suppliers(name)')
        .order('entry_date', { ascending: false })
        .limit(1000) : skipped(),
      wants('users') ? client
        .from('user_profiles')
        .select('id,full_name,email,phone,is_active,user_roles(roles(code,name))')
        .order('full_name')
        .limit(250) : skipped(),
      client
        .from('payment_terms')
        .select('id,code,name,requires_immediate_payment')
        .eq('active', true)
        .order('payment_days')
        .limit(100),
      client
        .from('payment_methods')
        .select('id,code,name,requires_reference,allows_customer_receipt,allows_supplier_payment')
        .eq('active', true)
        .order('display_order')
        .limit(100),
      wantsProducts ? client.from('product_categories').select('id,code,name').order('name').limit(250) : skipped(),
      wantsProducts ? client.from('brands').select('id,name').order('name').limit(250) : skipped(),
      wantsProducts ? client.from('units_of_measure').select('id,name,abbreviation').order('name').limit(100) : skipped(),
      wantsProducts ? client.from('tax_codes').select('id,code,description,rate').eq('is_active', true).order('rate', { ascending: false }).limit(50) : skipped(),
      wantsSuppliers ? client.rpc('get_supplier_total_purchases_summary') : skipped(),
    ]);

  const criticalFailed = [
    contextResult,
    metricsResult,
    permissionsResult,
    companyResult,
    productsResult,
  ].find((result) => result && result.error);
  if (criticalFailed?.error) throw criticalFailed.error;
  if (!companyResult.data) throw new Error('Dados da empresa não encontrados.');

  const rawContext = contextResult.data as Row;
  const userContext: UserContext = {
    userId: rawContext.user_id,
    companyId: rawContext.company_id,
    fullName: rawContext.full_name,
    email: rawContext.email,
    isActive: Boolean(rawContext.is_active),
    forcePasswordChange: Boolean(rawContext.force_password_change),
    roles: rawContext.roles ?? [],
    permissions: rawContext.permissions ?? [],
    branches: rawContext.branches ?? [],
    warehouses: rawContext.warehouses ?? [],
    activeBranch: rawContext.active_branch ?? undefined,
    activeWarehouse: rawContext.active_warehouse ?? undefined,
    activePosTerminal: rawContext.active_pos_terminal ? {
      id: rawContext.active_pos_terminal.id,
      code: rawContext.active_pos_terminal.code,
      name: rawContext.active_pos_terminal.name,
      seriesPrefix: rawContext.active_pos_terminal.series_prefix ?? undefined,
    } : undefined,
    systemMode: rawContext.system_mode ?? 'UNKNOWN',
  };
  if (!userContext.isActive) throw new Error('USER_INACTIVE');

  const rawMetrics = metricsResult.data as Row;
  const dashboardMetrics: DashboardMetrics = {
    activeProducts: numberValue(rawMetrics.active_products),
    lowStockProducts: numberValue(rawMetrics.low_stock_products),
    outOfStockProducts: numberValue(rawMetrics.out_of_stock_products),
    salesToday: numberValue(rawMetrics.sales_today),
    receivables: numberValue(rawMetrics.receivables),
    debtorCount: numberValue(rawMetrics.debtor_count),
    payables: numberValue(rawMetrics.payables),
    draftDocuments: numberValue(rawMetrics.draft_documents),
    serverDate: rawMetrics.server_date ?? '',
  };

  const company: CompanyProfile = {
    id: companyResult.data.id,
    name: companyResult.data.name,
    taxNumber: companyResult.data.tax_number,
    address: companyResult.data.address ?? '',
    city: companyResult.data.city ?? '',
    country: companyResult.data.country ?? '',
    phone: companyResult.data.phone ?? '',
    email: companyResult.data.email ?? '',
    currency: companyResult.data.currency ?? 'MZN',
    bankBciAccount: companyResult.data.bank_bci_account ?? '',
    bankBciNib: companyResult.data.bank_bci_nib ?? '',
    bankBimAccount: companyResult.data.bank_bim_account ?? '',
    bankBimNib: companyResult.data.bank_bim_nib ?? '',
    bankAccounts: (companyResult.data.bank_accounts || []) as BankAccount[],
    quotationValidityDays: companyResult.data.quotation_validity_days ?? '7 dias',
    quotationDefaultNotes: companyResult.data.quotation_default_notes ?? '',
  };

  const stockByProduct = new Map<string, number>();
  for (const row of balancesResult.data ?? []) {
    stockByProduct.set(
      row.product_id,
      (stockByProduct.get(row.product_id) ?? 0) + numberValue(row.quantity),
    );
  }

  const articles: Article[] = (productsResult.data ?? []).map((row: Row) => {
    const taxCode = relation(row.tax_codes);
    const category = relation(row.product_categories);
    const brand = relation(row.brands);
    const unit = relation(row.units_of_measure);
    return {
      id: row.id,
      code: row.code,
      description: row.description,
      unit: unit?.abbreviation ?? 'UN',
      minStock: numberValue(row.min_stock),
      stock: stockByProduct.get(row.id) ?? 0,
      costPrice: numberValue(row.avg_cost),
      profitMargin: numberValue(row.profit_pct),
      sellPrice: numberValue(row.sale_price_excl),
      sellPriceWithIva: numberValue(row.sale_price_incl),
      taxCodeId: row.tax_code_id ?? undefined,
      taxRate: numberValue(taxCode?.rate ?? 16),
      category: categoryValue(category?.name),
      brand: brand?.name ?? undefined,
      categoryId: category?.id ?? undefined,
      brandId: brand?.id ?? undefined,
      unitId: unit?.id ?? undefined,
    };
  });

  const clients: Client[] = (customersResult.data ?? []).map((row: Row) => {
    const addresses = (row.customer_addresses ?? []) as Row[];
    const address = addresses.find((item) => item.is_primary) ?? addresses[0];
    return {
      id: row.id,
      number: row.customer_number,
      name: row.name,
      nuit: row.tax_number ?? '',
      address: address?.address_line_1 ?? '',
      phone: row.telephone ?? '',
      email: row.email ?? '',
      pendingBalance: numberValue(row.current_balance),
    };
  });

  const rpcSupplierTotals = (supplierPurchasesRpcResult?.data as Row[]) ?? [];

  const suppliers: Supplier[] = (suppliersResult.data ?? []).map((row: Row) => {
    const addresses = (row.supplier_addresses ?? []) as Row[];
    const address = addresses.find((item) => item.is_primary) ?? addresses[0];

    const rpcTotalRow = rpcSupplierTotals.find((r) => r.supplier_id === row.id);
    const totalPurchasesCalc = rpcTotalRow ? numberValue(rpcTotalRow.total_purchases) : 0;

    return {
      id: row.id,
      code: row.supplier_number ?? '',
      number: row.supplier_number ?? '',
      name: row.name,
      nuit: row.tax_number ?? '',
      address: address?.address_line_1 ?? '',
      phone: row.telephone ?? '',
      email: row.email ?? '',
      contactPerson: row.contact_person ?? '',
      totalPurchases: totalPurchasesCalc,
      pendingBalance: numberValue(row.current_balance),
    };
  });

  const sales: SaleInvoice[] = (documentsResult.data ?? []).map((row: Row) => {
    const customer = relation(row.customers);
    const paymentTerm = relation(row.payment_terms);
    const docType = relation(row.document_types);
    const isCot = row.display_number?.startsWith('COT') || row.display_number?.startsWith('CO/');
    const isGr = row.display_number?.startsWith('GR');
    const isVd = row.display_number?.startsWith('VD');
    const notesStr = (row.notes as string) ?? '';
    const notesNameMatch = notesStr.match(/\[CLIENTE:\s*([^|\]]+)/i);
    const customNameFromNotes = notesNameMatch?.[1]?.trim();
    const resolvedClientName = (customNameFromNotes && customNameFromNotes.toLowerCase() !== 'cliente pontual' && customNameFromNotes.toLowerCase() !== 'cliente final')
      ? customNameFromNotes
      : (customer?.name ?? 'Cliente Pontual');

    const notesNuitMatch = notesStr.match(/NUIT:\s*([^|\]]+)/i);
    const customNuitFromNotes = notesNuitMatch?.[1]?.trim();
    const resolvedClientNuit = (customNuitFromNotes && customNuitFromNotes !== 'N/A')
      ? customNuitFromNotes
      : (customer?.tax_number ?? '');

    const notesAddressMatch = notesStr.match(/MORADA:\s*([^|\]]+)/i);
    const customAddressFromNotes = notesAddressMatch?.[1]?.trim();
    const resolvedClientAddress = (customAddressFromNotes && customAddressFromNotes !== 'N/A')
      ? customAddressFromNotes
      : (clients.find((client) => client.id === row.customer_id)?.address ?? '');

    const docTypeCode = docType?.code || (isCot ? 'CUSTOMER_QUOTATION' : isGr ? 'CUSTOMER_DELIVERY_NOTE' : isVd ? 'CASH_SALE' : 'CUSTOMER_INVOICE');

    return {
      id: row.id,
      clientId: row.customer_id ?? undefined,
      documentTypeCode: docTypeCode,
      docNumber: row.display_number ?? 'Rascunho',
      date: row.document_date,
      clientName: resolvedClientName,
      clientNuit: resolvedClientNuit,
      clientAddress: resolvedClientAddress,
      paymentMethod: paymentTerm?.name ?? '',
      paymentTermCode: paymentTerm?.code ?? undefined,
      sellerName: row.salesperson_name ?? '',
      items: ((row.document_lines ?? []) as Row[]).map((line) => {
        const qty = numberValue(line.quantity) || 1;
        const tot = numberValue(line.total_amount);
        const discountAmount = numberValue(line.discount_amount);
        const legacyDiscountPercent = numberValue(line.discount_percentage) || 0;
        const legacyDiscountAmount = discountAmount > 0
          ? discountAmount
          : numberValue(line.unit_price) * qty * legacyDiscountPercent / 100;
        const priceWithIva = (tot > 0 && qty > 0)
          ? Math.round(((tot + legacyDiscountAmount) / qty) * 10000) / 10000
          : Math.round(numberValue(line.unit_price) * (1 + numberValue(line.tax_rate_snapshot) / 100) * 100) / 100;

        return {
          documentLineId: line.id,
          articleId: line.product_id ?? line.id,
          code: line.product_code_snapshot ?? '',
          description: line.description_snapshot,
          quantity: qty,
          unitPrice: priceWithIva,
          discountPercent: legacyDiscountPercent,
          discountAmount: Math.round(legacyDiscountAmount * 100) / 100,
          ivaPercent: line.tax_rate_snapshot !== null && line.tax_rate_snapshot !== undefined && !isNaN(Number(line.tax_rate_snapshot)) ? Number(line.tax_rate_snapshot) : 16,
          total: tot > 0 ? tot : calculateDocumentLine({ quantity: qty, unitPrice: priceWithIva, discountAmount: legacyDiscountAmount, discountPercent: 0, ivaPercent: line.tax_rate_snapshot !== null && line.tax_rate_snapshot !== undefined && !isNaN(Number(line.tax_rate_snapshot)) ? Number(line.tax_rate_snapshot) : 16 }).totalWithTax,
          lineType: line.product_id ? 'STOCK' : (String(line.product_code_snapshot || '').toUpperCase().startsWith('SERV') ? 'SERVICE' : 'MANUAL'),
          stockEffectEnabled: Boolean(line.stock_effect_enabled),
        };
      }),
      subtotalBruto: numberValue(row.subtotal),
      descontoTotal: numberValue(row.discount_total),
      generalDiscountAmount: numberValue(row.general_discount_amount),
      ivaTotal: numberValue(row.tax_total),
      totalAmount: numberValue(row.grand_total),
      paidAmount: numberValue(row.amount_paid),
      pendingAmount: numberValue(row.outstanding_amount),
      status:
        row.status === 'CANCELLED' || row.status === 'REVERSED'
          ? 'Cancelada'
          : row.status === 'PAID' || row.status === 'CONFIRMED'
            ? 'Concluída'
            : 'Pendente',
      time: '',
      notes: notesStr,
      createdAt: row.created_at ?? undefined,
    };
    });

  const documents: DocumentRecord[] = (documentsResult.data ?? []).map((row: Row) => {
    const customer = relation(row.customers);
    const supplier = relation(row.suppliers);
    const documentType = relation(row.document_types);
    const isCot =
      row.display_number?.toUpperCase().startsWith('COT') ||
      row.display_number?.toUpperCase().startsWith('CO/') ||
      row.display_number?.toUpperCase().startsWith('QUO') ||
      (row.notes && (row.notes.toLowerCase().includes('cotação') || row.notes.toLowerCase().includes('cotacao')));
    const isGr = row.display_number?.toUpperCase().startsWith('GR');
    const isVd = row.display_number?.toUpperCase().startsWith('VD');
    const isFt = row.display_number?.toUpperCase().startsWith('FT') || row.display_number?.toUpperCase().startsWith('A/');

    const typeCode = documentType?.code || (isCot ? 'CUSTOMER_QUOTATION' : isGr ? 'CUSTOMER_DELIVERY_NOTE' : isVd ? 'CASH_SALE' : isFt ? 'CUSTOMER_INVOICE' : '');
    const typeName = documentType?.name || (isCot ? 'Cotação' : isGr ? 'Guia de Remessa' : isVd ? 'Venda a Dinheiro' : isFt ? 'Factura' : '');

    let partyName = customer?.name ?? supplier?.name ?? 'Cliente Pontual';
    if (!customer && !supplier && typeCode === 'STOCK_ENTRY_GUIDE') {
      partyName = 'Sem fornecedor';
    }
    if (!customer && !supplier && typeCode === 'STOCK_EXIT_GUIDE') {
      partyName = 'Saida interna de stock';
    }
    if (row.notes && row.notes.includes('[CLIENTE:')) {
      const match = row.notes.match(/\[CLIENTE:\s*([^|]+)/);
      if (match && match[1].trim() && match[1].trim() !== 'N/A') {
        partyName = match[1].trim();
      }
    }

    return {
      id: row.id,
      displayNumber: row.display_number ?? 'Rascunho',
      externalReference: row.external_reference ?? undefined,
      warehouseId: row.warehouse_id ?? undefined,
      date: row.document_date,
      dueDate: row.due_date ?? '',
      typeCode: typeCode,
      typeName: typeName,
      partyType: row.customer_id ? 'CUSTOMER' : 'SUPPLIER',
      partyId: row.customer_id ?? row.supplier_id ?? '',
      partyCode: customer?.customer_number ?? supplier?.supplier_number ?? '',
      partyName: partyName,
      status: row.status,
      netTotal: numberValue(row.net_total),
      taxTotal: numberValue(row.tax_total),
      grandTotal: numberValue(row.grand_total),
      paidAmount: numberValue(row.amount_paid),
      outstandingAmount: numberValue(row.outstanding_amount),
      salespersonName: row.salesperson_name ?? '',
      notes: row.notes ?? '',
      sourceDocumentId: row.source_document_id ?? undefined,
      createdAt: row.created_at ?? undefined,
      items: ((row.document_lines ?? []) as Row[]).map((line) => {
        const qty = numberValue(line.quantity) || 1;
        const lineTotal = numberValue(line.total_amount);
        const discountAmount = numberValue(line.discount_amount);
        const unitPriceWithTax = qty > 0
          ? Math.round(((lineTotal + discountAmount) / qty) * 10000) / 10000
          : numberValue(line.unit_price);
        return {
          documentLineId: line.id,
          articleId: line.product_id ?? line.id,
          code: line.product_code_snapshot ?? 'DIV',
          description: line.description_snapshot,
          quantity: qty,
          unitPrice: unitPriceWithTax,
          discountPercent: numberValue(line.discount_percentage),
          discountAmount,
          ivaPercent: numberValue(line.tax_rate_snapshot),
          total: lineTotal,
          lineType: line.product_id ? 'STOCK' : 'MANUAL',
          stockEffectEnabled: Boolean(line.stock_effect_enabled),
        } as SaleItem;
      }),
      stockGuideItems: (typeCode === 'STOCK_ENTRY_GUIDE' || typeCode === 'STOCK_EXIT_GUIDE') ? ((row.document_lines ?? []) as Row[]).map((line) => ({
        documentLineId: line.id,
        articleId: line.product_id ?? line.id,
        articleCode: line.product_code_snapshot ?? '',
        articleDescription: line.description_snapshot ?? '',
        quantity: numberValue(line.quantity),
        unitCost: line.cost_was_provided ? numberValue(line.unit_cost_snapshot) : undefined,
        salePriceWithIva: line.sale_price_incl == null ? undefined : numberValue(line.sale_price_incl),
        currentStock: articles.find((article) => article.id === line.product_id)?.stock ?? 0,
        totalCost: numberValue(line.total_amount),
      })) : undefined,
    };
  });

  const rawMovements = ((movementsResult?.data as Row[]) ?? []).map((row: Row) => {
    // Filter out initial legacy test movements STK-001, STK-002
    if (row.legacy_ref === 'STK-001' || row.legacy_ref === 'STK-002') return null;

    const product = relation(row.products) || articles.find((p: Article) => p.id === row.product_id);
    if (!product || !product.code) return null;

    const matchedDoc = documents.find((d) => d.id === row.source_document_id);
    const isEntrada = numberValue(row.quantity_in) > 0;
    const isOpeningOrMigration = row.movement_type === 'opening_stock' || (row.legacy_ref && (row.legacy_ref.includes('Migração') || row.legacy_ref.includes('Pos.zip') || row.legacy_ref.startsWith('STK-')));

    const computedRef = matchedDoc
      ? `${matchedDoc.typeName} ${matchedDoc.displayNumber}`
      : isOpeningOrMigration
        ? (isEntrada ? 'Entrada Inicial (Migração POS)' : 'Saída Inicial (Migração POS)')
        : row.legacy_ref || (isEntrada ? 'Entrada Directa por Guia' : 'Saída Directa por Guia');

    const item: StockMovement = {
      id: row.id,
      type: isEntrada ? 'entrada' : 'saida',
      docRef: computedRef,
      sourceDocumentId: row.source_document_id ?? matchedDoc?.id,
      docTypeCode: matchedDoc?.typeCode,
      docTypeName: matchedDoc?.typeName,
      date: row.created_at,
      articleCode: product.code,
      articleDescription: product.description,
      quantity: Math.max(numberValue(row.quantity_in), numberValue(row.quantity_out)),
      entityName: '',
      operator: relation(row.user_profiles)?.full_name || 'Administrador',
      warehouseId: relation(row.warehouses)?.id ?? undefined,
      warehouseName: relation(row.warehouses)?.name ?? undefined,
      reason: isEntrada ? 'Entrada Direta Manual' : 'Saída Direta Manual',
      unitCost: numberValue(row.unit_cost),
    };
    return item;
  });

  const baseMovements: StockMovement[] = rawMovements.filter((m): m is StockMovement => m !== null);

  // Synthesize stock exit movements from customer sales & delivery notes
  const saleExitMovements: StockMovement[] = [];
  sales.forEach((s) => {
    if (s.documentTypeCode === 'CUSTOMER_QUOTATION' || s.status === 'Cancelada') return;
    s.items.forEach((item, idx) => {
      if (!item.code || item.quantity <= 0) return;
      const docName = s.documentTypeCode === 'CASH_SALE' ? 'Venda a Dinheiro' : s.documentTypeCode === 'CUSTOMER_DELIVERY_NOTE' ? 'Guia de Remessa' : 'Factura';
      saleExitMovements.push({
        id: `sale-mov-${s.id}-${idx}`,
        type: 'saida',
        docRef: `${docName} ${s.docNumber}`,
        sourceDocumentId: s.id,
        docTypeCode: s.documentTypeCode,
        docTypeName: docName,
        date: s.date,
        articleCode: item.code,
        articleDescription: item.description,
        quantity: item.quantity,
        entityName: s.clientName,
        operator: s.sellerName || 'Operador de Caixa',
        reason: 'Venda / Emissão de Documento',
        unitCost: item.unitPrice,
      });
    });
  });

  const movements: StockMovement[] = [...baseMovements, ...saleExitMovements];

  const payments: PaymentRecord[] = (paymentsResult.data ?? []).map((row: Row) => ({
    id: row.id,
    displayNumber: row.display_number ?? 'Rascunho',
    date: row.payment_date,
    direction: row.direction,
    partyName: relation(row.customers)?.name ?? relation(row.suppliers)?.name ?? '',
    totalAmount: numberValue(row.total_amount),
    allocatedAmount: numberValue(row.allocated_amount),
    unappliedAmount: numberValue(row.unapplied_amount),
    status: row.status,
    reference: row.external_reference ?? undefined,
    description: row.description ?? undefined,
  }));

  const ledger: LedgerRecord[] = (ledgerResult.data ?? []).map((row: Row) => ({
    id: row.id,
    date: row.entry_date,
    partyType: row.party_type,
    partyName: relation(row.customers)?.name ?? relation(row.suppliers)?.name ?? '',
    entryType: row.entry_type,
    debitAmount: numberValue(row.debit_amount),
    creditAmount: numberValue(row.credit_amount),
    outstandingAmount: numberValue(row.outstanding_amount),
    status: row.status,
  }));

  const users: UserSummary[] = (usersResult.data ?? []).map((row: Row) => {
    const roles = ((row.user_roles ?? []) as Row[])
      .map((userRole) => relation(userRole.roles)?.code)
      .filter((code): code is string => Boolean(code));
    return {
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      active: row.is_active,
      telephone: row.phone ?? '',
      roles,
      bundles: bundleCodesFromRoleCodes(roles),
    };
  });

  const paymentTerms: ReferenceOption[] = (paymentTermsResult.data ?? []).map((row: Row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    requiresImmediatePayment: Boolean(row.requires_immediate_payment),
  }));
  const paymentMethods: ReferenceOption[] = (paymentMethodsResult.data ?? []).map((row: Row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    requiresReference: Boolean(row.requires_reference),
    allowsCustomerReceipt: Boolean(row.allows_customer_receipt),
    allowsSupplierPayment: Boolean(row.allows_supplier_payment),
  }));
  const productCategories: ReferenceOption[] = (categoriesResult.data ?? []).map((row: Row) => ({
    id: row.id, code: row.code, name: row.name,
  }));
  const brands: ReferenceOption[] = (brandsResult.data ?? []).map((row: Row) => ({
    id: row.id, code: row.id, name: row.name,
  }));

  const units: ReferenceOption[] = (unitsResult.data ?? []).map((row: Row) => ({
    id: row.id, code: row.abbreviation, name: `${row.name} (${row.abbreviation})`,
  }));
  const taxCodes: ReferenceOption[] = (taxCodesResult.data ?? []).map((row: Row) => ({
    id: row.id, code: row.code, name: `${row.description} (${numberValue(row.rate)}%)`,
  }));

  return {
    company,
    permissions: permissionsResult.data ?? [],
    articles,
    clients,
    suppliers,
    sales,
    movements,
    documents,
    payments,
    ledger,
    users,
    systemMode: (modeResult.data?.setting_value === 'MIGRATION' || !modeResult.data?.setting_value) ? 'PRODUCTION' : modeResult.data.setting_value,
    userContext,
    dashboardMetrics,
    paymentTerms,
    paymentMethods,
    productCategories,
    brands,
    units,
    taxCodes,
  };
}

export interface StockExtractResult {
  product_id: string;
  product_code: string;
  product_description: string;
  unit: string;
  opening_balance: number;
  current_stock: number;
  avg_cost: number;
  stock_valuation: number;
  can_view_cost: boolean;
  reconciliation_opening?: number;
  movement_count: number;
  limit: number;
  offset: number;
  movements: Array<{
    id: string;
    created_at: string;
    doc_ref: string;
    source_document_id?: string;
    doc_type_code: string;
    doc_type_name: string;
    movement_direction: 'ENTRADA' | 'SAÍDA';
    quantity_in: number;
    quantity_out: number;
    unit_cost: number;
    movement_value: number;
    running_balance: number;
    operator_name: string;
    reason: string;
  }>;
  totals: {
    total_in_qty: number;
    total_out_qty: number;
    total_in_val: number;
    total_out_val: number;
  };
}

export async function fetchStockMovementExtract(
  productId: string,
  from?: string,
  to?: string,
  movementType: string = 'ALL',
  limit: number = 100,
  offset: number = 0,
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

  if (error) throw new Error(error.message || 'Falha ao carregar extracto de stock.');
  return data as StockExtractResult;
}

export interface StockMovementsPageResult {
  rows: StockMovement[];
  totalCount: number;
  totalStock: number;
}

export async function fetchStockMovementsPage(
  from: string,
  to: string,
  movementType: 'ALL' | 'entrada' | 'saida',
  search: string,
  limit: number,
  offset: number,
): Promise<StockMovementsPageResult> {
  const { data, error } = await requireSupabase().rpc('get_stock_movements_page_v2', {
    p_from: from || null,
    p_to: to || null,
    p_movement_type: movementType === 'entrada' ? 'ENTRADA' : movementType === 'saida' ? 'SAIDA' : 'ALL',
    p_search: search.trim() || null,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw new Error(error.message || 'Falha ao carregar histórico de movimentos.');
  const result = data as Row;
  return {
    totalCount: numberValue(result.total_count),
    totalStock: numberValue(result.total_stock),
    rows: ((result.rows ?? []) as Row[]).map((row) => ({
      id: row.id,
      productId: row.product_id,
      type: row.movement_direction === 'ENTRADA' ? 'entrada' : 'saida',
      docRef: row.doc_ref ?? '',
      sourceDocumentId: row.source_document_id ?? undefined,
      docTypeCode: row.doc_type_code ?? undefined,
      docTypeName: row.doc_type_name ?? undefined,
      date: row.created_at,
      articleCode: row.product_code,
      articleDescription: row.product_description,
      quantity: Math.max(numberValue(row.quantity_in), numberValue(row.quantity_out)),
      quantityIn: numberValue(row.quantity_in),
      quantityOut: numberValue(row.quantity_out),
      balanceAfter: numberValue(row.balance_after),
      entityName: '',
      operator: row.operator_name ?? 'Sistema',
      warehouseId: row.warehouse_id ?? undefined,
      warehouseName: row.warehouse_name ?? undefined,
      reason: row.reason ?? '',
      unitCost: numberValue(row.unit_cost),
    })),
  };
}

export async function fetchSalesOperationalReport(
  from?: string,
  to?: string,
  docType: string = 'ALL',
  paymentStatus: string = 'ALL',
  customerId?: string,
  productId?: string,
  limit: number = 1000,
  offset: number = 0
): Promise<any> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('get_sales_operational_report_v2', {
    p_from: from || null,
    p_to: to || null,
    p_doc_type: docType,
    p_payment_status: paymentStatus,
    p_customer_id: customerId || null,
    p_product_id: productId || null,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw new Error(error.message || 'Falha ao carregar relatório de vendas.');
  return data;
}

export async function createAndConfirmFinancialAdvice(payload: {
  entityType: 'CUSTOMER' | 'SUPPLIER';
  adviceType: 'CREDIT';
  entityId: string;
  documentDate: string;
  targetDocumentId: string;
  reason: string;
  notes: string;
  returnStock: boolean;
  items: {
    source_line_id: string;
    quantity: number;
  }[];
}): Promise<DocumentRecord> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('create_and_confirm_credit_note_v2', {
    p_entity_type: payload.entityType,
    p_entity_id: payload.entityId,
    p_source_document_id: payload.targetDocumentId,
    p_document_date: payload.documentDate,
    p_reason: payload.reason,
    p_notes: payload.notes || null,
    p_items: payload.items,
    p_return_stock: payload.returnStock,
    p_idempotency_key: crypto.randomUUID(),
  });

  if (error) throw new Error(error.message || 'Falha ao confirmar a nota de crédito na base de dados.');
  const document = Array.isArray(data) ? data[0] : data;
  return {
    id: document.id, displayNumber: document.display_number, date: document.document_date,
    dueDate: document.due_date ?? '', typeCode: payload.entityType === 'CUSTOMER' ? 'CUSTOMER_CREDIT_NOTE' : 'SUPPLIER_CREDIT_ADVICE',
    typeName: payload.entityType === 'CUSTOMER' ? 'Nota de Crédito a Cliente' : 'Nota de Crédito de Fornecedor',
    partyType: payload.entityType, partyId: payload.entityId, partyName: '', status: document.status,
    netTotal: numberValue(document.net_total), taxTotal: numberValue(document.tax_total), grandTotal: numberValue(document.grand_total),
    paidAmount: numberValue(document.amount_paid), outstandingAmount: numberValue(document.outstanding_amount),
    notes: document.notes ?? '', sourceDocumentId: document.source_document_id ?? payload.targetDocumentId,
  };
}

export async function cancelFinancialAdvice(
  documentId: string,
  reason: string,
  idempotencyKey: string
): Promise<boolean> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('cancel_credit_note_v2', {
    p_document_id: documentId,
    p_reason: reason,
    p_idempotency_key: idempotencyKey,
  });

  if (error) throw new Error(error.message || 'Falha ao cancelar a nota de crédito na base de dados.');
  return Boolean(data);
}

export async function cancelOperationalDocument(
  documentId: string,
  reason: string,
  idempotencyKey: string
): Promise<boolean> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('admin_cancel_operational_document_v2', {
    p_document_id: documentId,
    p_reason: reason.trim(),
    p_idempotency_key: idempotencyKey,
  });

  if (error) throw new Error(error.message || 'Falha ao anular o documento na base de dados.');
  return Boolean(data);
}

export async function saveCompanyQuotationSettings(companyId: string, settings: {
  bankBciAccount: string;
  bankBciNib: string;
  bankBimAccount: string;
  bankBimNib: string;
  bankAccounts?: BankAccount[];
  quotationValidityDays: string;
  quotationDefaultNotes: string;
}): Promise<void> {
  const client = requireSupabase();
  if (!companyId) throw new Error('A empresa ativa não possui um identificador válido.');
  const targetId = companyId;
  const { error } = await client.from('companies').update({
    bank_bci_account: settings.bankBciAccount,
    bank_bci_nib: settings.bankBciNib,
    bank_bim_account: settings.bankBimAccount,
    bank_bim_nib: settings.bankBimNib,
    bank_accounts: settings.bankAccounts,
    quotation_validity_days: settings.quotationValidityDays,
    quotation_default_notes: settings.quotationDefaultNotes,
  }).eq('id', targetId);

  if (error) throw new Error(error.message || 'Falha ao salvar as configurações de cotação.');
}

function mapCashSession(row: any): CashSession {
  return {
    id: row.id,
    branchId: row.branch_id,
    warehouseId: row.warehouse_id,
    posTerminalId: row.pos_terminal_id ?? undefined,
    openedBy: row.opened_by,
    openedAt: row.opened_at,
    openingAmount: numberValue(row.opening_amount),
    status: row.status,
    closedAt: row.closed_at ?? undefined,
    declaredClosingAmount: row.declared_closing_amount == null ? undefined : numberValue(row.declared_closing_amount),
    expectedClosingAmount: row.expected_closing_amount == null ? undefined : numberValue(row.expected_closing_amount),
    varianceAmount: row.variance_amount == null ? undefined : numberValue(row.variance_amount),
    closingNotes: row.closing_notes ?? undefined,
  };
}

export async function fetchCashSessions(limit = 20): Promise<CashSession[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('cash_sessions')
    .select('*')
    .order('opened_at', { ascending: false })
    .limit(Math.max(1, Math.min(limit, 100)));
  if (error) throw new Error(error.message || 'Falha ao carregar os turnos de caixa.');
  return (data ?? []).map(mapCashSession);
}

export async function openCashSession(openingAmount: number): Promise<CashSession> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('open_cash_session_v1', {
    p_opening_amount: openingAmount,
  });
  if (error) throw new Error(error.message || 'Falha ao abrir o caixa.');
  return mapCashSession(Array.isArray(data) ? data[0] : data);
}

export async function addCashSessionMovement(
  movementType: 'REINFORCEMENT' | 'WITHDRAWAL',
  amount: number,
  note?: string,
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('add_cash_session_movement_v1', {
    p_movement_type: movementType,
    p_amount: amount,
    p_note: note?.trim() || null,
  });
  if (error) throw new Error(error.message || 'Falha ao registar o movimento de caixa.');
}

export async function closeCashSession(declaredAmount: number, notes?: string): Promise<CashSession> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('close_cash_session_v1', {
    p_declared_amount: declaredAmount,
    p_notes: notes?.trim() || null,
  });
  if (error) throw new Error(error.message || 'Falha ao fechar o caixa.');
  return mapCashSession(Array.isArray(data) ? data[0] : data);
}

export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    code: 'STARTER',
    name: 'STARTER',
    description: 'Para pequenos negócios em crescimento e prestadores de serviços.',
    priceMonthly: 4500,
    priceAnnual: 45900,
    maxUsers: 3,
    maxBranches: 1,
    maxWarehouses: 1,
    maxPosTerminals: 1,
    includedFeatures: ['CORE'],
  },
  {
    code: 'BUSINESS',
    name: 'BUSINESS',
    description: 'O equilíbrio perfeito para operações consolidadas e comércio a retalho.',
    priceMonthly: 8900,
    priceAnnual: 90780,
    maxUsers: 7,
    maxBranches: 1,
    maxWarehouses: 2,
    maxPosTerminals: 2,
    includedFeatures: ['CORE', 'ADVANCED_STOCK', 'PURCHASES', 'FINANCIAL', 'BANK_RECONCILIATION', 'STOCK_VALUATION_PRO'],
    popular: true,
  },
  {
    code: 'PRO',
    name: 'PRO',
    description: 'Para empresas em expansão com necessidades analíticas e multi-filial.',
    priceMonthly: 13900,
    priceAnnual: 141780,
    maxUsers: 15,
    maxBranches: 2,
    maxWarehouses: 6,
    maxPosTerminals: 6,
    includedFeatures: ['CORE', 'ADVANCED_STOCK', 'PURCHASES', 'FINANCIAL', 'BANK_RECONCILIATION', 'STOCK_VALUATION_PRO', 'BI_PRO', 'MULTI_BRANCH', 'SECURITY_PRO'],
  },
  {
    code: 'ENTERPRISE',
    name: 'ENTERPRISE',
    description: 'Redes de lojas, grandes distribuidores, talhos industriais e supermercados com API dedicada.',
    priceMonthly: 0,
    priceAnnual: 0,
    maxUsers: null,
    maxBranches: null,
    maxWarehouses: null,
    maxPosTerminals: null,
    includedFeatures: [
      'CORE', 'ADVANCED_STOCK', 'PURCHASES', 'FINANCIAL', 'BANK_RECONCILIATION', 'STOCK_VALUATION_PRO', 'BI_PRO',
      'MULTI_BRANCH', 'SECURITY_PRO', 'SUPERMARKET_POS', 'BUTCHER_MODULE',
      'OFFLINE_SYNC', 'LOCAL_PAYMENTS', 'BUSINESS_API', 'BACKUP_TRANSITION',
    ],
  },
];

export const AVAILABLE_ADDONS_CATALOG: Array<{
  code: string;
  name: string;
  description: string;
  priceMonthly: number;
  category: string;
}> = [
  {
    code: 'BUSINESS_API',
    name: 'Módulo Business API (Enterprise)',
    description: 'Chaves de API REST, Webhooks e sincronização com e-commerce e ERPs externos.',
    priceMonthly: 2500,
    category: 'Integração',
  },
  {
    code: 'BACKUP_TRANSITION',
    name: 'Backup Cloud Contínuo & Transição de Dados',
    description: 'Cópias de segurança automáticas em nuvem isolada e assistente de importação de dados.',
    priceMonthly: 1500,
    category: 'Sistema',
  },
  {
    code: 'STOCK_VALUATION_PRO',
    name: 'Rastreabilidade Lotes, Validade & Séries (FIFO/LIFO)',
    description: 'Controlo de lotes com validade, números de série e métodos de valorização FIFO/LIFO.',
    priceMonthly: 1500,
    category: 'Stock',
  },
  {
    code: 'BANK_RECONCILIATION',
    name: 'Baixa de Banco & Reconciliação Bancária',
    description: 'Extratos de contas bancárias (BIM, BCI, Standard Bank) com baixa automática de faturas.',
    priceMonthly: 1500,
    category: 'Financeiro',
  },
  {
    code: 'ADVANCED_STOCK',
    name: 'Stock Avançado & Múltiplos Armazéns',
    description: 'Transferências em trânsito com Guia, rastreio minucioso e inventários por armazém.',
    priceMonthly: 1500,
    category: 'Stock',
  },
  {
    code: 'PURCHASES',
    name: 'Compras & Fornecedores Multimoeda',
    description: 'Faturas de compras com câmbio manual e contas correntes de fornecedores.',
    priceMonthly: 1500,
    category: 'Compras',
  },
  {
    code: 'FINANCIAL',
    name: 'Financeiro & Contas Correntes',
    description: 'Extratos de clientes, liquidações a prazo e recibos com alocação atómica.',
    priceMonthly: 2000,
    category: 'Financeiro',
  },
  {
    code: 'BI_PRO',
    name: 'Relatórios & BI Pro',
    description: 'Margens reais, curva ABC, rentabilidade e exportações analíticas.',
    priceMonthly: 1500,
    category: 'Relatórios',
  },
  {
    code: 'MULTI_BRANCH',
    name: 'Multi-Filial / Sucursais',
    description: 'Gestão de múltiplas lojas com consolidação centralizada.',
    priceMonthly: 1500,
    category: 'Gestão',
  },
  {
    code: 'SUPERMARKET_POS',
    name: 'Módulo Supermercado & Balanças',
    description: 'Frente de caixa rápida com leitura de códigos de barras de balança EAN-13.',
    priceMonthly: 1500,
    category: 'POS',
  },
  {
    code: 'BUTCHER_MODULE',
    name: 'Módulo Talho & Desmancho',
    description: 'Conversão de carcaças em cortes, rendimento, quebra e lotes.',
    priceMonthly: 1500,
    category: 'Produção',
  },
  {
    code: 'OFFLINE_SYNC',
    name: 'Offline-First & Sync Windows',
    description: 'Operação ininterrupta sem internet com sincronização automática.',
    priceMonthly: 1500,
    category: 'Sistema',
  },
  {
    code: 'SECURITY_PRO',
    name: 'Segurança & Auditoria Fina',
    description: 'Perfis avançados por função e logs detalhados de ações críticas.',
    priceMonthly: 1000,
    category: 'Segurança',
  },
];

export async function fetchSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  try {
    const client = requireSupabase();
    const { data, error } = await client
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true);
    if (!error && data && data.length > 0) {
      return (data as Row[]).map((row) => {
        const defaultPlan = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.code === row.code);
        return {
          code: row.code as SubscriptionPlanCode,
          name: row.name,
          description: row.description || defaultPlan?.description || '',
          priceMonthly: defaultPlan?.priceMonthly ?? 0,
          priceAnnual: defaultPlan?.priceAnnual ?? 0,
          maxUsers: row.max_users,
          maxBranches: row.max_branches,
          maxWarehouses: row.max_warehouses,
          maxPosTerminals: row.max_pos_terminals,
          includedFeatures: row.included_features ?? [],
          popular: row.code === 'BUSINESS',
        };
      });
    }
  } catch {
    // Fallback to default catalog
  }
  return DEFAULT_SUBSCRIPTION_PLANS;
}

export async function fetchCompanyLicenseOverview(): Promise<LicenseOverview> {
  try {
    const client = requireSupabase();
    const { data, error } = await client.rpc('get_company_license_overview_v1');
    if (!error && data) {
      const res = data as Row;
      const planData = (res.plan ?? {}) as Row;
      const defaultPlan = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.code === planData.code) || DEFAULT_SUBSCRIPTION_PLANS[1];
      const plan: SubscriptionPlan = {
        code: (planData.code ?? 'BUSINESS') as SubscriptionPlanCode,
        name: planData.name ?? defaultPlan.name,
        description: planData.description ?? defaultPlan.description,
        priceMonthly: defaultPlan.priceMonthly,
        priceAnnual: defaultPlan.priceAnnual,
        maxUsers: planData.max_users ?? defaultPlan.maxUsers,
        maxBranches: planData.max_branches ?? defaultPlan.maxBranches,
        maxWarehouses: planData.max_warehouses ?? defaultPlan.maxWarehouses,
        maxPosTerminals: planData.max_pos_terminals ?? defaultPlan.maxPosTerminals,
        includedFeatures: planData.included_features ?? defaultPlan.includedFeatures,
        popular: planData.code === 'BUSINESS',
      };

      const subData = (res.subscription ?? {}) as Row;
      const subscription: CompanySubscription = {
        status: subData.status ?? 'ACTIVE',
        startsAt: subData.starts_at ?? new Date().toISOString(),
        expiresAt: subData.expires_at ?? undefined,
        daysRemaining: numberValue(subData.days_remaining ?? 30),
      };

      const usageData = (res.usage ?? {}) as Row;
      const usage: LicenseUsage = {
        usersCount: numberValue(usageData.users_count ?? 1),
        branchesCount: numberValue(usageData.branches_count ?? 1),
        warehousesCount: numberValue(usageData.warehouses_count ?? 1),
        posTerminalsCount: numberValue(usageData.pos_terminals_count ?? 1),
      };

      const addons: CompanyAddonItem[] = ((res.addons ?? []) as Row[]).map((a) => {
        const cat = AVAILABLE_ADDONS_CATALOG.find((item) => item.code === a.addon_code);
        return {
          id: a.id,
          addonCode: a.addon_code,
          name: cat?.name ?? a.addon_code,
          description: cat?.description ?? '',
          priceMonthly: cat?.priceMonthly ?? 1500,
          isActive: Boolean(a.is_active),
          startsAt: a.starts_at,
          expiresAt: a.expires_at,
        };
      });

      const invoices: LicenseBillingInvoice[] = ((res.invoices ?? []) as Row[]).map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        periodStart: inv.period_start,
        periodEnd: inv.period_end,
        planCode: inv.plan_code,
        amountMzn: numberValue(inv.amount_mzn),
        paymentMethod: inv.payment_method ?? 'M_PESA',
        paymentReference: inv.payment_reference,
        status: inv.status ?? 'PAID',
        paidAt: inv.paid_at,
      }));

      return { plan, subscription, usage, addons, invoices };
    }
  } catch (err) {
    console.warn('Could not load online license overview, using defaults:', err);
  }

  return {
    plan: DEFAULT_SUBSCRIPTION_PLANS[1],
    subscription: {
      status: 'ACTIVE',
      startsAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      daysRemaining: 30,
    },
    usage: {
      usersCount: 1,
      branchesCount: 1,
      warehousesCount: 1,
      posTerminalsCount: 1,
    },
    addons: [],
    invoices: [],
  };
}

export async function upgradeSubscriptionPlan(
  planCode: string,
  cycle: 'MONTHLY' | 'ANNUAL' = 'MONTHLY',
  paymentMethod: string = 'M_PESA',
  paymentReference?: string,
): Promise<{ success: boolean; invoiceNumber?: string }> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('upgrade_subscription_plan_v1', {
    p_plan_code: planCode,
    p_cycle: cycle,
    p_payment_method: paymentMethod,
    p_payment_reference: paymentReference || null,
  });
  if (error) throw new Error(error.message || 'Falha ao atualizar o plano de subscrição.');
  return data;
}

export async function toggleCompanyAddon(addonCode: string, active: boolean): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('toggle_company_addon_v1', {
    p_addon_code: addonCode,
    p_active: active,
  });
  if (error) throw new Error(error.message || 'Falha ao alterar estado do add-on.');
}

export async function provisionNewTenant(input: TenantOnboardingInput): Promise<{
  success: boolean;
  message?: string;
}> {
  if (!input.companyName.trim()) throw new Error('O nome da empresa é obrigatório.');
  if (!input.taxNumber.trim()) throw new Error('O NUIT da empresa é obrigatório.');
  if (!input.adminEmail.trim()) throw new Error('O email do administrador é obrigatório.');
  if (input.adminPassword.length < 8) throw new Error('A palavra-passe deve ter pelo menos 8 caracteres.');

  try {
    const client = requireSupabase();
    const { error: authError } = await client.auth.signUp({
      email: input.adminEmail.trim(),
      password: input.adminPassword,
      options: {
        data: {
          full_name: input.adminFullName.trim(),
          phone: input.adminPhone?.trim() || null,
          company_name: input.companyName.trim(),
          nuit: input.taxNumber.trim(),
          city: input.city.trim(),
          plan_code: input.planCode,
          billing_cycle: input.billingCycle,
        },
      },
    });

    if (authError) throw authError;

    return {
      success: true,
      message: 'Registo concluído com sucesso! Pode agora iniciar sessão com a sua nova conta.',
    };
  } catch (err: any) {
    throw new Error(err.message || 'Não foi possível concluir o registo.');
  }
}

