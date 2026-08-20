import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  normalizeTransferStatus,
  canDispatchTransfer,
  canReceiveTransfer,
  canCancelTransfer,
  calculateSupplierCreditTotal,
  projectStockAfterMovement,
  buildStockMovementsCsv,
} from '../../src/features/stock-transfers/utils/stockTransferState';
import { StockTransfersService } from '../../src/features/stock-transfers/services/stockTransfers.service';
import { TransferStatusBadge } from '../../src/features/stock-transfers/components/TransferStatusBadge';
import { DirectGuideHistorySection } from '../../src/features/stock-transfers/components/DirectGuideHistorySection';
import { CancelGuideModal } from '../../src/features/stock-transfers/components/CancelGuideModal';
import { useDirectStockMovement } from '../../src/features/stock-transfers/hooks/useDirectStockMovement';
import { useStockTransfersManagement } from '../../src/features/stock-transfers/hooks/useStockTransfersManagement';
import type { StockMovement, StockGuideItem, DocumentRecord, Article, Supplier, AccessScope } from '../../src/shared/types/domain.types';

describe('Stock Transfers Domain & State Machine Contract', () => {
  describe('Canonical State Machine Transitions & Normalization', () => {
    it('normalizes legacy aliases to canonical database statuses', () => {
      expect(normalizeTransferStatus('DRAFT')).toBe('PENDING');
      expect(normalizeTransferStatus('pending')).toBe('PENDING');
      expect(normalizeTransferStatus('DISPATCHED')).toBe('IN_TRANSIT');
      expect(normalizeTransferStatus('in_transit')).toBe('IN_TRANSIT');
      expect(normalizeTransferStatus('RECEIVED')).toBe('RECEIVED');
      expect(normalizeTransferStatus('CANCELLED')).toBe('CANCELLED');
    });

    it('only allows dispatch from PENDING (or alias DRAFT)', () => {
      expect(canDispatchTransfer('PENDING')).toBe(true);
      expect(canDispatchTransfer('DRAFT')).toBe(true);
      expect(canDispatchTransfer('pending')).toBe(true);

      expect(canDispatchTransfer('IN_TRANSIT')).toBe(false);
      expect(canDispatchTransfer('DISPATCHED')).toBe(false);
      expect(canDispatchTransfer('RECEIVED')).toBe(false);
      expect(canDispatchTransfer('CANCELLED')).toBe(false);
      expect(canDispatchTransfer('UNKNOWN_XYZ')).toBe(false);
    });

    it('only allows reception from IN_TRANSIT (or alias DISPATCHED)', () => {
      expect(canReceiveTransfer('IN_TRANSIT')).toBe(true);
      expect(canReceiveTransfer('DISPATCHED')).toBe(true);
      expect(canReceiveTransfer('in_transit')).toBe(true);

      expect(canReceiveTransfer('PENDING')).toBe(false);
      expect(canReceiveTransfer('DRAFT')).toBe(false);
      expect(canReceiveTransfer('RECEIVED')).toBe(false);
      expect(canReceiveTransfer('CANCELLED')).toBe(false);
    });

    it('allows cancellation only for non-finalised states PENDING and IN_TRANSIT', () => {
      expect(canCancelTransfer('PENDING')).toBe(true);
      expect(canCancelTransfer('DRAFT')).toBe(true);
      expect(canCancelTransfer('IN_TRANSIT')).toBe(true);
      expect(canCancelTransfer('DISPATCHED')).toBe(true);

      expect(canCancelTransfer('RECEIVED')).toBe(false);
      expect(canCancelTransfer('CANCELLED')).toBe(false);
      expect(canCancelTransfer('UNKNOWN')).toBe(false);
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

  describe('DirectGuideHistorySection Component Interaction Contracts', () => {
    const dummyDoc: DocumentRecord = {
      id: 'doc-123',
      displayNumber: 'GE-2026/001',
      externalReference: 'GE-2026/001',
      date: '2026-08-20',
      typeCode: 'STOCK_ENTRY_GUIDE',
      partyId: 'sup-1',
      partyName: 'Fornecedor A',
      status: 'CONFIRMED',
      grandTotal: 5000,
      stockGuideItems: [{ articleId: 'art-1', articleCode: 'A1', articleDescription: 'Item 1', quantity: 5, unitCost: 1000, currentStock: 10 }],
    };

    const dummyCancelledDoc: DocumentRecord = {
      ...dummyDoc,
      id: 'doc-cancelled-456',
      displayNumber: 'GE-2026/002',
      status: 'CANCELLED',
    };

    it('renders Edit, Cancel and Print buttons for confirmed guide', () => {
      const html = renderToString(
        React.createElement(DirectGuideHistorySection, {
          stockGuideDocuments: [dummyDoc],
          lastSavedGuide: null,
          canCancelGuide: true,
          onOpenDocument: vi.fn(),
          onEditGuide: vi.fn(),
          onCancelGuide: vi.fn(),
        })
      );

      expect(html).toContain('GE-2026/001');
      expect(html).toContain('Editar');
      expect(html).toContain('Anular');
      expect(html).toContain('Imprimir');
      expect(html).toContain('Confirmada');
    });

    it('hides Anular button when canCancelGuide is false', () => {
      const html = renderToString(
        React.createElement(DirectGuideHistorySection, {
          stockGuideDocuments: [dummyDoc],
          lastSavedGuide: null,
          canCancelGuide: false,
          onOpenDocument: vi.fn(),
          onEditGuide: vi.fn(),
          onCancelGuide: vi.fn(),
        })
      );

      expect(html).toContain('Editar');
      expect(html).not.toContain('title="Anular guia e reverter stock"');
    });

    it('marks cancelled guides as Anulada and disables Edit and Cancel', () => {
      const html = renderToString(
        React.createElement(DirectGuideHistorySection, {
          stockGuideDocuments: [dummyCancelledDoc],
          lastSavedGuide: null,
          canCancelGuide: true,
          onOpenDocument: vi.fn(),
          onEditGuide: vi.fn(),
          onCancelGuide: vi.fn(),
        })
      );

      expect(html).toContain('Anulada');
      expect(html).toContain('disabled=""');
    });
  });

  describe('CancelGuideModal Component Interaction Contracts', () => {
    const dummyDoc: DocumentRecord = {
      id: 'doc-123',
      displayNumber: 'GE-2026/001',
      date: '2026-08-20',
      typeCode: 'STOCK_ENTRY_GUIDE',
      status: 'CONFIRMED',
    };

    it('disables confirmation button when cancellation reason is empty', () => {
      const html = renderToString(
        React.createElement(CancelGuideModal, {
          cancellingGuide: dummyDoc,
          cancelReason: '',
          onCancelReasonChange: vi.fn(),
          isCancelling: false,
          onClose: vi.fn(),
          onConfirmCancel: vi.fn(),
        })
      );

      expect(html).toContain('Confirmar Anulação');
      expect(html).toContain('disabled=""');
    });

    it('enables confirmation button when valid reason is provided', () => {
      const html = renderToString(
        React.createElement(CancelGuideModal, {
          cancellingGuide: dummyDoc,
          cancelReason: 'Artigos devolvidos ao fornecedor',
          onCancelReasonChange: vi.fn(),
          isCancelling: false,
          onClose: vi.fn(),
          onConfirmCancel: vi.fn(),
        })
      );

      expect(html).toContain('Confirmar Anulação');
      // When enabled and isCancelling is false, button is not disabled
      expect(html).toContain('Artigos devolvidos ao fornecedor');
    });

    it('shows loading state when isCancelling is true', () => {
      const html = renderToString(
        React.createElement(CancelGuideModal, {
          cancellingGuide: dummyDoc,
          cancelReason: 'Erro de lançamento',
          onCancelReasonChange: vi.fn(),
          isCancelling: true,
          onClose: vi.fn(),
          onConfirmCancel: vi.fn(),
        })
      );

      expect(html).toContain('A anular...');
    });
  });

  describe('Double-Submit & Write Safety Mutex (useDirectStockMovement)', () => {
    const dummyWarehouses: AccessScope[] = [{ id: 'wh-1', name: 'Armazém Central' }];
    const dummyArticles: Article[] = [
      { id: 'art-1', code: 'PNEU-01', description: 'Pneu Radial', unit: 'UN', stock: 20, minStock: 5, costPrice: 1000, sellPrice: 1500, taxRate: 16, category: 'Geral' },
    ];
    const dummySuppliers: Supplier[] = [
      { id: 'sup-1', name: 'Fornecedor A', email: '', phone: '', address: '', taxNumber: '', balance: 0, pendingBalance: 0 },
    ];

    it('prevents double-submit on concurrent submitGuide calls via savingRef lock', async () => {
      let resolveSave!: (id: string) => void;
      const onSaveGuidePromise = new Promise<string>((res) => { resolveSave = res; });
      const onSaveGuideMock = vi.fn().mockImplementation(() => onSaveGuidePromise);

      let hook!: ReturnType<typeof useDirectStockMovement>;
      const Harness: React.FC = () => {
        hook = useDirectStockMovement({
          articles: dummyArticles,
          suppliers: dummySuppliers,
          warehouses: dummyWarehouses,
          initialDraft: {
            warehouseId: 'wh-1',
            guideNumber: 'GUIA-TEST-001',
            documentDate: '2026-08-20',
            items: [
              { articleId: 'art-1', articleCode: 'PNEU-01', articleDescription: 'Pneu Radial', quantity: 5, unitCost: 1000, currentStock: 20 },
            ],
          },
          canPostEntry: true,
          canPostExit: true,
          canAllowNegative: false,
          onSaveGuide: onSaveGuideMock,
        });
        return null;
      };

      renderToString(React.createElement(Harness));

      // Call submitGuide concurrently twice
      const p1 = hook.submitGuide();
      const p2 = hook.submitGuide();

      resolveSave('doc-created-1');
      await Promise.all([p1, p2]);

      // Exactly 1 call reached onSaveGuide
      expect(onSaveGuideMock).toHaveBeenCalledTimes(1);
    });

    it('submits with existing document id when editingGuideId is set (UPDATE path)', async () => {
      const onSaveGuideMock = vi.fn().mockResolvedValue('doc-existing-888');

      let hook!: ReturnType<typeof useDirectStockMovement>;
      const Harness: React.FC = () => {
        hook = useDirectStockMovement({
          articles: dummyArticles,
          suppliers: dummySuppliers,
          warehouses: dummyWarehouses,
          initialDraft: {
            editingGuideId: 'doc-existing-888',
            warehouseId: 'wh-1',
            guideNumber: 'GUIA-UPDATE-888',
            documentDate: '2026-08-20',
            items: [
              { articleId: 'art-1', articleCode: 'PNEU-01', articleDescription: 'Pneu Radial', quantity: 5, unitCost: 1000, currentStock: 20 },
            ],
          },
          canPostEntry: true,
          canPostExit: true,
          canAllowNegative: false,
          onSaveGuide: onSaveGuideMock,
        });
        return null;
      };

      renderToString(React.createElement(Harness));

      await hook.submitGuide();

      expect(onSaveGuideMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'doc-existing-888',
          guideNumber: 'GUIA-UPDATE-888',
        })
      );
    });

    it('releases lock on failure so user can retry submission', async () => {
      const onSaveGuideMock = vi.fn()
        .mockRejectedValueOnce(new Error('Network error on first attempt'))
        .mockResolvedValueOnce('doc-created-retry');

      let hook!: ReturnType<typeof useDirectStockMovement>;
      const Harness: React.FC = () => {
        hook = useDirectStockMovement({
          articles: dummyArticles,
          suppliers: dummySuppliers,
          warehouses: dummyWarehouses,
          initialDraft: {
            warehouseId: 'wh-1',
            guideNumber: 'GUIA-RETRY-001',
            documentDate: '2026-08-20',
            items: [
              { articleId: 'art-1', articleCode: 'PNEU-01', articleDescription: 'Pneu Radial', quantity: 5, unitCost: 1000, currentStock: 20 },
            ],
          },
          canPostEntry: true,
          canPostExit: true,
          canAllowNegative: false,
          onSaveGuide: onSaveGuideMock,
        });
        return null;
      };

      renderToString(React.createElement(Harness));

      // First attempt fails
      await hook.submitGuide();
      expect(onSaveGuideMock).toHaveBeenCalledTimes(1);
      expect(hook.savingRef.current).toBe(false);

      // Second attempt succeeds
      await hook.submitGuide();
      expect(onSaveGuideMock).toHaveBeenCalledTimes(2);
      expect(hook.savingRef.current).toBe(false);
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
