import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  canDispatchTransfer,
  canReceiveTransfer,
  canCancelTransfer,
  calculateSupplierCreditTotal,
  projectStockAfterMovement,
  buildStockMovementsCsv,
} from '../../src/features/stock-transfers/utils/stockTransferState';
import { StockTransfersService } from '../../src/features/stock-transfers/services/stockTransfers.service';
import { TransferStatusBadge } from '../../src/features/stock-transfers/components/TransferStatusBadge';
import type { StockMovement, StockGuideItem } from '../../src/shared/types/domain.types';

describe('Stock Transfers Domain & State Machine Contract', () => {
  describe('State Machine Transitions', () => {
    it('only allows dispatch from DRAFT or PENDING status', () => {
      expect(canDispatchTransfer('DRAFT')).toBe(true);
      expect(canDispatchTransfer('PENDING')).toBe(true);
      expect(canDispatchTransfer('pending')).toBe(true);

      expect(canDispatchTransfer('IN_TRANSIT')).toBe(false);
      expect(canDispatchTransfer('DISPATCHED')).toBe(false);
      expect(canDispatchTransfer('RECEIVED')).toBe(false);
      expect(canDispatchTransfer('CANCELLED')).toBe(false);
    });

    it('only allows reception from IN_TRANSIT or DISPATCHED status', () => {
      expect(canReceiveTransfer('IN_TRANSIT')).toBe(true);
      expect(canReceiveTransfer('DISPATCHED')).toBe(true);
      expect(canReceiveTransfer('in_transit')).toBe(true);

      expect(canReceiveTransfer('DRAFT')).toBe(false);
      expect(canReceiveTransfer('PENDING')).toBe(false);
      expect(canReceiveTransfer('RECEIVED')).toBe(false);
      expect(canReceiveTransfer('CANCELLED')).toBe(false);
    });

    it('allows cancellation only for non-finalised states', () => {
      expect(canCancelTransfer('DRAFT')).toBe(true);
      expect(canCancelTransfer('PENDING')).toBe(true);
      expect(canCancelTransfer('IN_TRANSIT')).toBe(true);
      expect(canCancelTransfer('DISPATCHED')).toBe(true);

      expect(canCancelTransfer('RECEIVED')).toBe(false);
      expect(canCancelTransfer('CANCELLED')).toBe(false);
    });
  });

  describe('TransferStatusBadge Unknown Status Handling', () => {
    it('renders neutral badge with raw status when unknown status is encountered', () => {
      const htmlUnknown = renderToString(React.createElement(TransferStatusBadge, { status: 'CUSTOM_REVIEW' }));
      expect(htmlUnknown).toContain('CUSTOM_REVIEW');

      const htmlEmpty = renderToString(React.createElement(TransferStatusBadge, { status: '' }));
      expect(htmlEmpty).toContain('Desconhecido');
    });
  });

  describe('Stock Projection and Calculations', () => {
    it('projects stock increase for entrada and decrease for saida', () => {
      expect(projectStockAfterMovement(10, 'entrada', 5, 0)).toBe(15);
      expect(projectStockAfterMovement(10, 'saida', 4, 0)).toBe(6);
      expect(projectStockAfterMovement(15, 'entrada', 8, 5)).toBe(18);
      expect(projectStockAfterMovement(6, 'saida', 2, 4)).toBe(8);
    });

    it('calculates total supplier credit correctly', () => {
      const items: StockGuideItem[] = [
        { articleId: '1', articleCode: 'ART-1', articleDescription: 'Pneu', quantity: 10, unitCost: 1500, currentStock: 5 },
        { articleId: '2', articleCode: 'ART-2', articleDescription: 'Filtro', quantity: 5, unitCost: 300, currentStock: 2 },
        { articleId: '3', articleCode: 'ART-3', articleDescription: 'Óleo', quantity: 2, unitCost: undefined, currentStock: 0 },
      ];

      expect(calculateSupplierCreditTotal(items)).toBe(10 * 1500 + 5 * 300 + 0);
    });

    it('formats CSV export correctly with UTF-8 BOM headers', () => {
      const movements: StockMovement[] = [
        {
          id: 'mov-1',
          date: '2026-08-20T10:00:00Z',
          type: 'entrada',
          articleCode: 'PNEU-01',
          articleDescription: 'Pneu Radial 175/70',
          quantity: 20,
          balanceAfter: 50,
          docRef: 'GUIA-001',
          entityName: '',
          operator: 'Operador',
        },
      ];

      const csv = buildStockMovementsCsv(movements);
      expect(csv).toContain('Data,Tipo,Documento / Guia,Código Artigo,Descrição Artigo,Entrada (Qtd),Saída (Qtd),Saldo Final');
      expect(csv).toContain('ENTRADA');
      expect(csv).toContain('PNEU-01');
      expect(csv).toContain('20.000');
      expect(csv).toContain('50.000');
    });
  });

  describe('StockTransfersService Validation Contracts', () => {
    it('validates that origin and destination warehouses must be different', async () => {
      await expect(
        StockTransfersService.createTransfer({
          fromWarehouseId: 'WH-01',
          toWarehouseId: 'WH-01',
          transferDate: '2026-08-20',
          lines: [{ articleId: 'art-1', quantity: 5 }],
        })
      ).rejects.toThrow('O armazém de destino deve ser diferente do de origem.');
    });

    it('validates that a transfer must contain at least one line item', async () => {
      await expect(
        StockTransfersService.createTransfer({
          fromWarehouseId: 'WH-01',
          toWarehouseId: 'WH-02',
          transferDate: '2026-08-20',
          lines: [],
        })
      ).rejects.toThrow('A transferência deve conter pelo menos um artigo.');
    });
  });
});
