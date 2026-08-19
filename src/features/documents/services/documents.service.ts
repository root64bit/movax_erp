import { requireSupabase } from '@/integrations/supabase/client';
import { numberValue } from '@/integrations/supabase/helpers';
import { logger } from '@/shared/lib/logger';
import { AppError, ValidationError } from '@/shared/utils/errorUtils';
import { sanitizePostgrestSearch } from '@/shared/utils/pagination';
import type { DocumentRecord, SaleItem } from '@/shared/types/domain.types';
import { recalculateSaleItems } from '@/lib/documentCalculations';

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

export interface DocumentsPageParams {
  limit?: number;
  offset?: number;
  search?: string;
  partyType?: 'ALL' | 'CUSTOMER' | 'SUPPLIER';
  status?: string;
  typeCode?: string;
  dateFrom?: string;
  dateTo?: string;
  customerId?: string;
  supplierId?: string;
  isCashier?: boolean;
}

export interface DocumentsPageResult {
  rows: DocumentRecord[];
  totalCount: number;
}

export const DocumentsService = {
  async fetchDocumentsPage(params: DocumentsPageParams = {}): Promise<DocumentsPageResult> {
    const client = requireSupabase();
    const limit = Math.min(Math.max(params.limit ?? 25, 1), 200);
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
        customer_id,
        supplier_id,
        document_types!inner(code,name,party_type),
        customers(id,customer_number,name,tax_number),
        suppliers(id,supplier_number,name,tax_number)
      `, { count: 'exact' });

    if (params.partyType && params.partyType !== 'ALL') {
      query = query.eq('document_types.party_type', params.partyType);
    }

    if (params.status && params.status !== 'ALL') {
      query = query.eq('status', params.status);
    }

    if (params.typeCode && params.typeCode !== 'ALL') {
      query = query.eq('document_types.code', params.typeCode);
    }

    if (params.isCashier) {
      // Cashiers can only view delivery notes & quotations
      query = query.in('document_types.code', ['CUSTOMER_DELIVERY_NOTE', 'CUSTOMER_QUOTATION', 'QUOTATION', 'COT']);
    }

    if (params.dateFrom?.trim()) {
      query = query.gte('document_date', params.dateFrom.trim());
    }

    if (params.dateTo?.trim()) {
      query = query.lte('document_date', params.dateTo.trim());
    }

    if (params.customerId?.trim()) {
      query = query.eq('customer_id', params.customerId.trim());
    }

    if (params.supplierId?.trim()) {
      query = query.eq('supplier_id', params.supplierId.trim());
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
      logger.error('Failed to fetch operational documents page', error, { module: 'DocumentsService' });
      throw new AppError(error.message || 'Falha ao carregar documentos.');
    }

    const rows: DocumentRecord[] = ((data || []) as any[]).map((row: any) => {
      const isCustomer = row.document_types?.party_type === 'CUSTOMER';
      const isSupplier = row.document_types?.party_type === 'SUPPLIER';
      const party = isCustomer ? row.customers : isSupplier ? row.suppliers : null;

      return {
        id: String(row.id),
        displayNumber: String(row.display_number ?? ''),
        externalReference: row.external_reference ? String(row.external_reference) : undefined,
        warehouseId: row.warehouse_id ? String(row.warehouse_id) : undefined,
        date: String(row.document_date || row.created_at || ''),
        dueDate: String(row.due_date || row.document_date || row.created_at || ''),
        createdAt: String(row.created_at || ''),
        sourceDocumentId: row.source_document_id ? String(row.source_document_id) : undefined,
        status: String(row.status ?? 'DRAFT'),
        partyType: (row.document_types?.party_type ?? 'CUSTOMER') as 'CUSTOMER' | 'SUPPLIER',
        partyId: String(party?.id || row.customer_id || row.supplier_id || ''),
        partyCode: party?.customer_number || party?.supplier_number || '',
        partyName: party?.name || 'Cliente Pontual',
        typeCode: String(row.document_types?.code ?? 'CUSTOMER_INVOICE'),
        typeName: String(row.document_types?.name ?? 'Factura'),
        salespersonName: row.salesperson_name ? String(row.salesperson_name) : undefined,
        netTotal: numberValue(row.net_total),
        taxTotal: numberValue(row.tax_total),
        grandTotal: numberValue(row.grand_total),
        paidAmount: numberValue(row.amount_paid),
        outstandingAmount: numberValue(row.outstanding_amount),
        notes: row.notes ? String(row.notes) : undefined,
      };
    });

    return { rows, totalCount: count ?? rows.length };
  },

  async updateDocumentDetails(documentId: string, payload: DocumentUpdatePayload): Promise<void> {
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
      logger.error('Failed to update operational document', error, { module: 'DocumentsService', documentId });
      throw new AppError(error.message || 'Falha ao atualizar documento.');
    }
  },

  async issueFinancialAdvice(documentId: string, clientName: string, amount: number, notes?: string): Promise<void> {
    const client = requireSupabase();
    const { error } = await client.rpc('create_financial_advice_document_v1', {
      p_source_document_id: documentId,
      p_client_name: clientName.trim(),
      p_amount: Number(amount) || 0,
      p_notes: notes?.trim() || null,
    });

    if (error) {
      logger.error('Failed to issue financial advice', error, { module: 'DocumentsService', documentId });
      throw new AppError(error.message || 'Falha ao emitir nota de crédito/débito.');
    }
  },

  async cancelFinancialAdvice(documentId: string, reason: string): Promise<void> {
    if (!reason.trim()) throw new ValidationError('O motivo do cancelamento é obrigatório.');
    const client = requireSupabase();
    const { error } = await client.rpc('cancel_financial_advice_document_v1', {
      p_document_id: documentId,
      p_reason: reason.trim(),
    });

    if (error) {
      logger.error('Failed to cancel financial advice', error, { module: 'DocumentsService', documentId });
      throw new AppError(error.message || 'Falha ao cancelar nota de crédito/débito.');
    }
  },
};
