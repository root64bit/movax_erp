import { requireSupabase } from '@/integrations/supabase/client';
import { numberValue } from '@/integrations/supabase/helpers';
import { logger } from '@/shared/lib/logger';
import { AppError, ValidationError } from '@/shared/utils/errorUtils';
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

export const DocumentsService = {
  async fetchDocumentsPage(params: {
    limit?: number;
    offset?: number;
  }): Promise<DocumentRecord[]> {
    const client = requireSupabase();
    const limit = Math.min(Math.max(params.limit ?? 25, 1), 200);
    const offset = Math.max(params.offset ?? 0, 0);

    const { data, error } = await client.rpc('get_operational_documents_page_v2', {
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      logger.error('Failed to fetch operational documents page', error, { module: 'DocumentsService' });
      throw new AppError(error.message || 'Falha ao carregar documentos.');
    }

    return ((data || []) as any[]).map((row: any) => {
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
      throw new AppError(error.message || 'Falha ao emitir aviso financeiro.');
    }
  },

  async cancelFinancialAdvice(adviceId: string, reason: string): Promise<void> {
    const client = requireSupabase();
    const { error } = await client.rpc('cancel_financial_advice_document_v1', {
      p_advice_id: adviceId,
      p_reason: reason.trim(),
      p_idempotency_key: crypto.randomUUID(),
    });

    if (error) {
      logger.error('Failed to cancel financial advice', error, { module: 'DocumentsService', adviceId });
      throw new AppError(error.message || 'Falha ao anular aviso financeiro.');
    }
  },
};
