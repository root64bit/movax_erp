import { requireSupabase } from '@/integrations/supabase/client';
import { numberValue } from '@/integrations/supabase/helpers';
import { logger } from '@/shared/lib/logger';
import { AppError, ValidationError } from '@/shared/utils/errorUtils';
import { sanitizePostgrestSearch } from '@/shared/utils/pagination';
import type { PurchaseInvoiceInput, DocumentRecord } from '@/shared/types/domain.types';

export interface PurchasesPageParams {
  supplierId?: string;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface PurchasesPageResult {
  rows: DocumentRecord[];
  totalCount: number;
}

export const PurchasesService = {
  async fetchPurchasesPage(params: PurchasesPageParams = {}): Promise<PurchasesPageResult> {
    const client = requireSupabase();
    const limit = Math.min(Math.max(params.limit ?? 25, 1), 100);
    const offset = Math.max(params.offset ?? 0, 0);

    let query = client
      .from('documents')
      .select(`
        id,
        display_number,
        external_reference,
        warehouse_id,
        document_date,
        due_date,
        created_at,
        source_document_id,
        status,
        notes,
        net_total,
        tax_total,
        grand_total,
        amount_paid,
        outstanding_amount,
        salesperson_name,
        supplier_id,
        document_types!inner(code,name,party_type),
        suppliers(id,supplier_number,name,tax_number)
      `, { count: 'exact' })
      .eq('document_types.party_type', 'SUPPLIER');

    if (params.supplierId?.trim()) {
      query = query.eq('supplier_id', params.supplierId.trim());
    }

    if (params.date?.trim()) {
      query = query.eq('document_date', params.date.trim());
    } else {
      if (params.dateFrom?.trim()) {
        query = query.gte('document_date', params.dateFrom.trim());
      }
      if (params.dateTo?.trim()) {
        query = query.lte('document_date', params.dateTo.trim());
      }
    }

    if (params.status && params.status !== 'ALL') {
      query = query.eq('status', params.status);
    }

    if (params.search?.trim()) {
      const sanitized = sanitizePostgrestSearch(params.search);
      if (sanitized) {
        query = query.or(`display_number.ilike.%${sanitized}%,external_reference.ilike.%${sanitized}%,notes.ilike.%${sanitized}%`);
      }
    }

    const { data, count, error } = await query
      .order('document_date', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Failed to fetch purchases page', error, { module: 'PurchasesService' });
      throw new AppError(error.message || 'Falha ao carregar histórico de compras.');
    }

    const rows: DocumentRecord[] = (data || []).map((row: any) => ({
      id: String(row.id),
      displayNumber: String(row.display_number ?? ''),
      externalReference: row.external_reference ? String(row.external_reference) : undefined,
      warehouseId: row.warehouse_id ? String(row.warehouse_id) : undefined,
      date: String(row.document_date || row.created_at || ''),
      dueDate: String(row.due_date || row.document_date || row.created_at || ''),
      createdAt: String(row.created_at || ''),
      sourceDocumentId: row.source_document_id ? String(row.source_document_id) : undefined,
      status: String(row.status ?? 'DRAFT'),
      partyType: 'SUPPLIER',
      partyId: String(row.suppliers?.id || row.supplier_id || ''),
      partyCode: row.suppliers?.supplier_number || '',
      partyName: row.suppliers?.name || 'Fornecedor',
      typeCode: String(row.document_types?.code ?? 'SUPPLIER_INVOICE'),
      typeName: String(row.document_types?.name ?? 'Factura de Fornecedor'),
      salespersonName: row.salesperson_name ? String(row.salesperson_name) : undefined,
      netTotal: numberValue(row.net_total),
      taxTotal: numberValue(row.tax_total),
      grandTotal: numberValue(row.grand_total),
      paidAmount: numberValue(row.amount_paid),
      outstandingAmount: numberValue(row.outstanding_amount),
      notes: row.notes ? String(row.notes) : undefined,
    }));

    return { rows, totalCount: count ?? rows.length };
  },

  async createSupplierInvoice(invoice: PurchaseInvoiceInput): Promise<DocumentRecord> {
    if (!invoice.supplierId) throw new ValidationError('O fornecedor é obrigatório.');
    if (!invoice.items || invoice.items.length === 0) {
      throw new ValidationError('A compra deve conter pelo menos um artigo.');
    }

    const client = requireSupabase();
    const idempotencyKey = crypto.randomUUID();

    const { data, error } = await client.rpc('create_and_confirm_supplier_invoice', {
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
    });

    if (error) {
      logger.error('Failed to create supplier invoice', error, { module: 'PurchasesService' });
      throw new AppError(error.message || 'Falha ao confirmar a compra a fornecedor.');
    }

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
  },
};
