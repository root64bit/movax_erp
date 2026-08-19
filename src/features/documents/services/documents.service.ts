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
