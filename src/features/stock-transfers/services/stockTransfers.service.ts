import { requireSupabase } from '@/integrations/supabase/client';
import { numberValue } from '@/integrations/supabase/helpers';
import { logger } from '@/shared/lib/logger';
import { AppError, ValidationError } from '@/shared/utils/errorUtils';
import type { StockTransfer, StockTransferLine } from '@/shared/types/domain.types';

export const StockTransfersService = {
  async fetchTransfers(limit = 100): Promise<StockTransfer[]> {
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

    if (error) {
      logger.error('Failed to fetch stock transfers', error, { module: 'StockTransfersService' });
      throw new AppError(error.message || 'Falha ao carregar transferências de stock.');
    }

    return ((data ?? []) as Record<string, any>[]).map((row) => {
      const fromWarehouse = Array.isArray(row.from_warehouse) ? row.from_warehouse[0] : row.from_warehouse;
      const toWarehouse = Array.isArray(row.to_warehouse) ? row.to_warehouse[0] : row.to_warehouse;
      const lines = ((row.stock_transfer_lines ?? []) as Record<string, any>[]).map((line): StockTransferLine => {
        const product = Array.isArray(line.products) ? line.products[0] : line.products;
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
  },

  async createTransfer(input: {
    fromWarehouseId: string;
    toWarehouseId: string;
    transferDate: string;
    notes?: string;
    lines: Array<{ articleId: string; quantity: number }>;
  }): Promise<{ id: string; transferNumber: string }> {
    if (!input.fromWarehouseId) throw new ValidationError('O armazém de origem é obrigatório.');
    if (!input.toWarehouseId) throw new ValidationError('O armazém de destino é obrigatório.');
    if (input.fromWarehouseId === input.toWarehouseId) {
      throw new ValidationError('O armazém de destino deve ser diferente do de origem.');
    }
    if (!input.lines || input.lines.length === 0) {
      throw new ValidationError('A transferência deve conter pelo menos um artigo.');
    }

    const client = requireSupabase();
    const { data, error } = await client.rpc('create_stock_transfer_v1', {
      p_from_warehouse_id: input.fromWarehouseId,
      p_to_warehouse_id: input.toWarehouseId,
      p_transfer_date: input.transferDate,
      p_notes: input.notes?.trim() || null,
      p_lines: input.lines.map((line) => ({ product_id: line.articleId, quantity: line.quantity })),
    });

    if (error) {
      logger.error('Failed to create stock transfer', error, { module: 'StockTransfersService' });
      throw new AppError(error.message || 'Falha ao criar transferência de stock.');
    }

    const row = data as Record<string, any>;
    return { id: String(row.id), transferNumber: String(row.transfer_number) };
  },

  async dispatchTransfer(transferId: string): Promise<void> {
    const client = requireSupabase();
    const { error } = await client.rpc('dispatch_stock_transfer_v1', { p_transfer_id: transferId });
    if (error) {
      logger.error('Failed to dispatch transfer', error, { module: 'StockTransfersService', transferId });
      throw new AppError(error.message || 'Falha ao enviar transferência.');
    }
  },

  async receiveTransfer(transferId: string): Promise<void> {
    const client = requireSupabase();
    const { error } = await client.rpc('receive_stock_transfer_v1', { p_transfer_id: transferId });
    if (error) {
      logger.error('Failed to receive transfer', error, { module: 'StockTransfersService', transferId });
      throw new AppError(error.message || 'Falha ao receber transferência.');
    }
  },

  async cancelTransfer(transferId: string, reason: string): Promise<void> {
    if (!reason.trim()) throw new ValidationError('O motivo do cancelamento é obrigatório.');
    const client = requireSupabase();
    const { error } = await client.rpc('cancel_stock_transfer_v1', {
      p_transfer_id: transferId,
      p_reason: reason.trim() || null,
    });
    if (error) {
      logger.error('Failed to cancel transfer', error, { module: 'StockTransfersService', transferId });
      throw new AppError(error.message || 'Falha ao cancelar transferência.');
    }
  },

  async cancelStockGuide(documentId: string, reason: string): Promise<void> {
    if (!reason.trim()) throw new ValidationError('O motivo da anulação é obrigatório.');
    const client = requireSupabase();
    const { error } = await client.rpc('cancel_stock_guide_v2', {
      p_document_id: documentId,
      p_reason: reason.trim(),
      p_idempotency_key: crypto.randomUUID(),
    });
    if (error) {
      logger.error('Failed to cancel stock guide', error, { module: 'StockTransfersService', documentId });
      throw new AppError(error.message || 'Falha ao anular a guia de stock.');
    }
  },
};
