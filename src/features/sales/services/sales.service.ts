import { requireSupabase } from '@/integrations/supabase/client';
import { numberValue, isUuid } from '@/integrations/supabase/helpers';
import { logger } from '@/shared/lib/logger';
import { AppError, ValidationError } from '@/shared/utils/errorUtils';
import type { SaleInvoice } from '@/shared/types/domain.types';
import { calculateDocumentTotals } from '@/lib/documentCalculations';

export const SalesService = {
  async resolveOrRegisterCustomer(
    customerId: string,
    customerName?: string,
    customerNuit?: string,
    customerAddress?: string,
    keepAsWalkIn?: boolean,
  ): Promise<string> {
    const client = requireSupabase();
    if (customerId && isUuid(customerId) && customerId !== '1') {
      return customerId;
    }

    if (keepAsWalkIn) {
      const { data: walkIn, error: walkInError } = await client
        .from('customers')
        .select('id')
        .eq('number', '1')
        .limit(1)
        .maybeSingle();

      if (!walkInError && walkIn?.id) {
        return walkIn.id;
      }
    }

    const cleanName = (customerName || '').trim();
    if (!cleanName || cleanName.toLowerCase() === 'consumidor final' || cleanName === '1') {
      const { data: walkIn } = await client
        .from('customers')
        .select('id')
        .eq('number', '1')
        .limit(1)
        .maybeSingle();

      if (walkIn?.id) return walkIn.id;
    }

    const { data: registeredId, error } = await client.rpc('resolve_or_create_operational_customer', {
      p_name: cleanName || 'Cliente Balcão',
      p_tax_number: customerNuit?.trim() || null,
      p_address: customerAddress?.trim() || null,
    });

    if (error) {
      logger.error('Failed to resolve or create customer for sale', error, { module: 'SalesService', customerName });
      throw new AppError(error.message || 'Falha ao associar cliente à venda.');
    }

    return String(registeredId);
  },

  async createSaleInvoice(sale: SaleInvoice, customerId: string): Promise<SaleInvoice> {
    const client = requireSupabase();
    const idempotencyKey = crypto.randomUUID();

    if (!sale.items || sale.items.length === 0) {
      throw new ValidationError('A venda deve conter pelo menos um artigo.');
    }

    const targetCustomerId = await this.resolveOrRegisterCustomer(
      customerId,
      sale.clientName,
      sale.clientNuit,
      sale.clientAddress,
      sale.keepAsWalkIn,
    );

    const encodedNotes = `[CLIENTE: ${sale.clientName} | NUIT: ${sale.clientNuit || 'N/A'} | MORADA: ${sale.clientAddress || 'N/A'}] ${sale.notes || ''}`.trim();
    const calculated = calculateDocumentTotals(
      sale.items,
      sale.descontoTotal - sale.items.reduce((sum, item) => sum + (item.discountAmount || 0), 0)
    );

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
        tax_rate: item.ivaPercent !== undefined && item.ivaPercent !== null ? Number(item.ivaPercent) : 16,
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

    if (error) {
      logger.error('Failed to confirm customer sale RPC', error, { module: 'SalesService' });
      throw new AppError(error.message || 'Falha ao confirmar a venda.');
    }

    if (!data) throw new AppError('A venda não devolveu um documento confirmado.');

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
  },

  async cancelDocument(documentId: string, reason: string): Promise<void> {
    if (!reason.trim()) throw new ValidationError('O motivo da anulação é obrigatório.');
    const client = requireSupabase();
    const { error } = await client.rpc('cancel_operational_document_v2', {
      p_document_id: documentId,
      p_reason: reason.trim(),
      p_idempotency_key: crypto.randomUUID(),
    });
    if (error) {
      logger.error('Failed to cancel document', error, { module: 'SalesService', documentId });
      throw new AppError(error.message || 'Falha ao anular documento.');
    }
  },
};
