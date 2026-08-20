import type { StockTransfer, StockMovement } from '@/shared/types/domain.types';
import type { GuideLineItem, StockMovementType } from '../types/stock-transfer.types';

export type CanonicalTransferStatus = 'PENDING' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';

/**
 * Normalizes transfer status strings to canonical PostgreSQL database statuses:
 * - PENDING (includes legacy DRAFT alias)
 * - IN_TRANSIT (includes legacy DISPATCHED alias)
 * - RECEIVED
 * - CANCELLED
 */
export function normalizeTransferStatus(
  status: StockTransfer['status'] | string | undefined | null
): CanonicalTransferStatus | string {
  const upper = String(status || '').trim().toUpperCase();
  if (upper === 'PENDING' || upper === 'DRAFT') return 'PENDING';
  if (upper === 'IN_TRANSIT' || upper === 'DISPATCHED') return 'IN_TRANSIT';
  if (upper === 'RECEIVED') return 'RECEIVED';
  if (upper === 'CANCELLED') return 'CANCELLED';
  return upper;
}

export function canDispatchTransfer(status: StockTransfer['status'] | string | undefined | null): boolean {
  return normalizeTransferStatus(status) === 'PENDING';
}

export function canReceiveTransfer(status: StockTransfer['status'] | string | undefined | null): boolean {
  return normalizeTransferStatus(status) === 'IN_TRANSIT';
}

export function canCancelTransfer(status: StockTransfer['status'] | string | undefined | null): boolean {
  const norm = normalizeTransferStatus(status);
  return norm === 'PENDING' || norm === 'IN_TRANSIT';
}

export function calculateSupplierCreditTotal(items: GuideLineItem[]): number {
  return items.reduce((sum, item) => sum + (item.quantity * (item.unitCost ?? 0)), 0);
}

export function projectStockAfterMovement(
  currentStock: number,
  type: StockMovementType,
  quantity: number,
  originalQuantity: number = 0
): number {
  const direction = type === 'entrada' ? 1 : -1;
  return currentStock + direction * (quantity - originalQuantity);
}

export function buildStockMovementsCsv(rows: StockMovement[]): string {
  const headers = ['Data', 'Tipo', 'Documento / Guia', 'Código Artigo', 'Descrição Artigo', 'Entrada (Qtd)', 'Saída (Qtd)', 'Saldo Final'];
  const sorted = [...rows];
  
  const formattedRows = sorted.map((item) => {
    const saldo = item.balanceAfter ?? 0;
    const formattedDate = new Date(item.date).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return [
      `"${formattedDate}"`,
      item.type.toUpperCase(),
      `"${(item.docRef || (item.type === 'entrada' ? 'Entrada Directa' : 'Saída Directa')).replace(/"/g, '""')}"`,
      `"${item.articleCode.replace(/"/g, '""')}"`,
      `"${item.articleDescription.replace(/"/g, '""')}"`,
      item.type === 'entrada' ? item.quantity.toFixed(3) : '0',
      item.type === 'saida' ? item.quantity.toFixed(3) : '0',
      saldo.toFixed(3),
    ];
  });

  return [headers.join(','), ...formattedRows.map((r) => r.join(','))].join('\r\n');
}
