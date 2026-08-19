import { requireSupabase } from '@/integrations/supabase/client';
import { numberValue } from '@/integrations/supabase/helpers';
import { logger } from '@/shared/lib/logger';
import { AppError, ValidationError } from '@/shared/utils/errorUtils';
import type { CashSession, CashSessionMovement, PaymentRecord, SaleInvoice, DocumentRecord } from '@/shared/types/domain.types';

function mapCashSession(row: Record<string, any>): CashSession {
  return {
    id: String(row.id),
    branchId: String(row.branch_id),
    warehouseId: String(row.warehouse_id),
    posTerminalId: row.pos_terminal_id ? String(row.pos_terminal_id) : undefined,
    openedBy: String(row.opened_by),
    openedAt: String(row.opened_at),
    openingAmount: numberValue(row.opening_amount),
    status: (row.status as 'OPEN' | 'CLOSED') || 'OPEN',
    closedAt: row.closed_at ? String(row.closed_at) : undefined,
    declaredClosingAmount: row.declared_closing_amount !== null && row.declared_closing_amount !== undefined ? numberValue(row.declared_closing_amount) : undefined,
    expectedClosingAmount: row.expected_closing_amount !== null && row.expected_closing_amount !== undefined ? numberValue(row.expected_closing_amount) : undefined,
    varianceAmount: row.variance_amount !== null && row.variance_amount !== undefined ? numberValue(row.variance_amount) : undefined,
    closingNotes: row.closing_notes ? String(row.closing_notes) : undefined,
  };
}

export const CashService = {
  async fetchActiveSession(): Promise<CashSession | null> {
    const client = requireSupabase();
    const { data, error } = await client.rpc('get_active_cash_session_v1');
    if (error) {
      logger.warn('Failed to fetch active cash session', { module: 'CashService', error });
      return null;
    }
    if (!data) return null;
    return mapCashSession(Array.isArray(data) ? data[0] : data);
  },

  async openSession(openingAmount: number): Promise<CashSession> {
    if (openingAmount < 0) throw new ValidationError('O valor de abertura de caixa não pode ser negativo.');
    const client = requireSupabase();
    const { data, error } = await client.rpc('open_cash_session_v1', {
      p_opening_amount: openingAmount,
    });
    if (error) {
      logger.error('Failed to open cash session', error, { module: 'CashService', openingAmount });
      throw new AppError(error.message || 'Falha ao abrir o caixa.');
    }
    return mapCashSession(Array.isArray(data) ? data[0] : data);
  },

  async addMovement(movementType: 'REINFORCEMENT' | 'WITHDRAWAL', amount: number, note?: string): Promise<void> {
    if (amount <= 0) throw new ValidationError('O valor do movimento de caixa deve ser maior que zero.');
    if (movementType === 'WITHDRAWAL' && !note?.trim()) {
      throw new ValidationError('A sangria de caixa requer um motivo obrigatório.');
    }
    const client = requireSupabase();
    const { error } = await client.rpc('add_cash_session_movement_v1', {
      p_movement_type: movementType,
      p_amount: amount,
      p_note: note?.trim() || null,
    });
    if (error) {
      logger.error('Failed to add cash movement', error, { module: 'CashService', movementType, amount });
      throw new AppError(error.message || 'Falha ao registar o movimento de caixa.');
    }
  },

  async closeSession(declaredAmount: number, notes?: string): Promise<CashSession> {
    if (declaredAmount < 0) throw new ValidationError('O valor declarado de fecho não pode ser negativo.');
    const client = requireSupabase();
    const { data, error } = await client.rpc('close_cash_session_v1', {
      p_declared_amount: declaredAmount,
      p_notes: notes?.trim() || null,
    });
    if (error) {
      logger.error('Failed to close cash session', error, { module: 'CashService', declaredAmount });
      throw new AppError(error.message || 'Falha ao fechar o caixa.');
    }
    return mapCashSession(Array.isArray(data) ? data[0] : data);
  },

  async createCustomerPayment(
    sale: SaleInvoice | DocumentRecord,
    methodCode: string,
    amount: number,
    reference: string,
  ): Promise<PaymentRecord> {
    const isDocumentRecord = 'partyId' in sale;
    const customerId = isDocumentRecord ? sale.partyId : sale.clientId;
    const pendingAmount = isDocumentRecord ? sale.outstandingAmount : sale.pendingAmount;
    if (!customerId) throw new ValidationError('Cliente do pagamento não identificado.');

    const client = requireSupabase();
    const { data, error } = await client.rpc('create_and_confirm_customer_payment', {
      p_customer_id: customerId,
      p_document_id: sale.id,
      p_method_code: methodCode,
      p_amount: Math.min(amount, pendingAmount),
      p_reference: methodCode === 'CASH' ? null : reference.trim(),
      p_idempotency_key: crypto.randomUUID(),
    });

    if (error) {
      logger.error('Failed to create customer payment', error, { module: 'CashService' });
      throw new AppError(error.message || 'Falha ao registar recebimento do cliente.');
    }

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
  },

  async createSupplierPayment(
    document: DocumentRecord,
    methodCode: string,
    amount: number,
    reference: string,
  ): Promise<PaymentRecord> {
    const client = requireSupabase();
    const { data, error } = await client.rpc('create_and_confirm_supplier_payment', {
      p_supplier_id: document.partyId,
      p_document_id: document.id,
      p_method_code: methodCode,
      p_amount: Math.min(amount, document.outstandingAmount),
      p_reference: methodCode === 'CASH' ? null : reference.trim(),
      p_idempotency_key: crypto.randomUUID(),
    });

    if (error) {
      logger.error('Failed to create supplier payment', error, { module: 'CashService' });
      throw new AppError(error.message || 'Falha ao registar pagamento a fornecedor.');
    }

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
  },
};
