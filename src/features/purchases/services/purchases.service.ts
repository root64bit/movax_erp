import { requireSupabase } from '@/integrations/supabase/client';
import { numberValue } from '@/integrations/supabase/helpers';
import { logger } from '@/shared/lib/logger';
import { AppError, ValidationError } from '@/shared/utils/errorUtils';
import type { PurchaseInvoiceInput, DocumentRecord, Supplier } from '@/shared/types/domain.types';

export const PurchasesService = {
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
