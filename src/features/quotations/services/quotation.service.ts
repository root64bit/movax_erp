import { requireSupabase } from '@/integrations/supabase/client';
import { numberValue, isUuid } from '@/integrations/supabase/helpers';
import { logger } from '@/shared/lib/logger';
import { AppError, ValidationError } from '@/shared/utils/errorUtils';
import type { SaleInvoice } from '@/shared/types/domain.types';
import { calculateDocumentTotals } from '@/lib/documentCalculations';
import { SalesService } from '@/features/sales/services/sales.service';

export const QuotationService = {
  async createQuotation(sale: SaleInvoice, customerId: string): Promise<SaleInvoice> {
    const client = requireSupabase();
    if (!sale.items || sale.items.length === 0) {
      throw new ValidationError('A cotação deve conter pelo menos um artigo.');
    }

    const targetCustomerId = await SalesService.resolveOrRegisterCustomer(
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
        tax_rate: item.ivaPercent !== undefined && item.ivaPercent !== null ? Number(item.ivaPercent) : 16,
        line_type: item.lineType || (isUuid(item.articleId) ? 'STOCK' : 'MANUAL'),
        stock_effect_enabled: false,
      })),
      p_notes: encodedNotes,
      p_idempotency_key: crypto.randomUUID(),
      p_general_discount: calculated.generalDiscount,
    });

    if (error) {
      logger.error('Failed to create customer quotation RPC', error, { module: 'QuotationService' });
      throw new AppError(error.message || 'Falha ao guardar cotação na base de dados.');
    }

    if (!data) throw new AppError('A cotação não devolveu um documento confirmado.');

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
  },

  async saveCompanyQuotationSettings(
    companyId: string,
    settings: { validityDays: number; defaultNotes: string }
  ): Promise<void> {
    const client = requireSupabase();
    const { error } = await client
      .from('companies')
      .update({
        quotation_validity_days: settings.validityDays,
        quotation_default_notes: settings.defaultNotes.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', companyId);

    if (error) {
      logger.error('Failed to save quotation settings', error, { module: 'QuotationService', companyId });
      throw new AppError(error.message || 'Falha ao guardar definições de cotação.');
    }
  },
};
