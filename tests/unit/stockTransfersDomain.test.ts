import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
import type { StockMovement, StockGuideItem, DocumentRecord, Article, Supplier, AccessScope, StockTransfer } from '../../src/shared/types/domain.types';

// Helper to traverse a React element tree and find elements matching a predicate
function findElements(element: any, predicate: (el: any) => boolean, acc: any[] = []): any[] {
  if (!element || typeof element !== 'object') return acc;
  if (predicate(element)) acc.push(element);
  if (element.props && element.props.children) {
    const children = Array.isArray(element.props.children) ? element.props.children : [element.props.children];
    for (const child of children) {
      findElements(child, predicate, acc);
    }
  }
  return acc;
}

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

  describe('DirectGuideHistorySection Component Real Interaction Contracts', () => {
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

    it('executes real onEditGuide callback when Editar button is clicked', () => {
      const onEditGuideMock = vi.fn();
      const tree = DirectGuideHistorySection({
        stockGuideDocuments: [dummyDoc],
        lastSavedGuide: null,
        canCancelGuide: true,
        onOpenDocument: vi.fn(),
        onEditGuide: onEditGuideMock,
        onCancelGuide: vi.fn(),
      });

      const buttons = findElements(tree, (el) => el.type === 'button' && (el.props?.title === 'Editar guia' || el.props?.children === 'Editar'));
      expect(buttons).toHaveLength(1);
      expect(buttons[0].props.disabled).toBe(false);

      // Execute real click event handler on the element
      buttons[0].props.onClick({ preventDefault: vi.fn(), stopPropagation: vi.fn() });

      expect(onEditGuideMock).toHaveBeenCalledTimes(1);
      expect(onEditGuideMock).toHaveBeenCalledWith(dummyDoc);
    });

    it('executes real onCancelGuide callback when Anular button is clicked', () => {
      const onCancelGuideMock = vi.fn();
      const tree = DirectGuideHistorySection({
        stockGuideDocuments: [dummyDoc],
        lastSavedGuide: null,
        canCancelGuide: true,
        onOpenDocument: vi.fn(),
        onEditGuide: vi.fn(),
        onCancelGuide: onCancelGuideMock,
      });

      const buttons = findElements(tree, (el) => el.type === 'button' && (el.props?.title === 'Anular guia e reverter stock' || el.props?.children === 'Anular'));
      expect(buttons).toHaveLength(1);
      expect(buttons[0].props.disabled).toBe(false);

      buttons[0].props.onClick({ preventDefault: vi.fn(), stopPropagation: vi.fn() });

      expect(onCancelGuideMock).toHaveBeenCalledTimes(1);
      expect(onCancelGuideMock).toHaveBeenCalledWith(dummyDoc);
    });

    it('executes real onOpenDocument callback when Imprimir button is clicked', () => {
      const onOpenDocumentMock = vi.fn();
      const tree = DirectGuideHistorySection({
        stockGuideDocuments: [dummyDoc],
        lastSavedGuide: null,
        canCancelGuide: true,
        onOpenDocument: onOpenDocumentMock,
        onEditGuide: vi.fn(),
        onCancelGuide: vi.fn(),
      });

      const buttons = findElements(tree, (el) => el.type === 'button' && (el.props?.title === 'Imprimir guia' || el.props?.children === 'Imprimir'));
      expect(buttons).toHaveLength(1);

      buttons[0].props.onClick({ preventDefault: vi.fn(), stopPropagation: vi.fn() });

      expect(onOpenDocumentMock).toHaveBeenCalledTimes(1);
      expect(onOpenDocumentMock).toHaveBeenCalledWith(dummyDoc);
    });

    it('does not render Anular button when canCancelGuide is false', () => {
      const tree = DirectGuideHistorySection({
        stockGuideDocuments: [dummyDoc],
        lastSavedGuide: null,
        canCancelGuide: false,
        onOpenDocument: vi.fn(),
        onEditGuide: vi.fn(),
        onCancelGuide: vi.fn(),
      });

      const cancelButtons = findElements(tree, (el) => el.type === 'button' && (el.props?.title === 'Anular guia e reverter stock' || el.props?.children === 'Anular'));
      expect(cancelButtons).toHaveLength(0);
    });

    it('disables Edit and Cancel buttons for cancelled guides', () => {
      const tree = DirectGuideHistorySection({
        stockGuideDocuments: [dummyCancelledDoc],
        lastSavedGuide: null,
        canCancelGuide: true,
        onOpenDocument: vi.fn(),
        onEditGuide: vi.fn(),
        onCancelGuide: vi.fn(),
      });

      const editButtons = findElements(tree, (el) => el.type === 'button' && (el.props?.title === 'Editar guia' || el.props?.children === 'Editar'));
      const cancelButtons = findElements(tree, (el) => el.type === 'button' && (el.props?.title === 'Anular guia e reverter stock' || el.props?.children === 'Anular'));

      expect(editButtons[0].props.disabled).toBe(true);
      expect(cancelButtons[0].props.disabled).toBe(true);
    });
  });

  describe('CancelGuideModal Component Real Interaction Contracts', () => {
    const dummyDoc: DocumentRecord = {
      id: 'doc-123',
      displayNumber: 'GE-2026/001',
      date: '2026-08-20',
      typeCode: 'STOCK_ENTRY_GUIDE',
      status: 'CONFIRMED',
    };

    it('disables confirmation button when reason is empty', () => {
      const onConfirmCancelMock = vi.fn();
      const tree = CancelGuideModal({
        cancellingGuide: dummyDoc,
        cancelReason: '',
        onCancelReasonChange: vi.fn(),
        isCancelling: false,
        onClose: vi.fn(),
        onConfirmCancel: onConfirmCancelMock,
      });

      const confirmButtons = findElements(tree, (el) => el.type === 'button' && el.props?.children === 'Confirmar Anulação');
      expect(confirmButtons[0].props.disabled).toBe(true);
    });

    it('updates reason on textarea input and calls onConfirmCancel on click', () => {
      const onCancelReasonChangeMock = vi.fn();
      const onConfirmCancelMock = vi.fn();
      const tree = CancelGuideModal({
        cancellingGuide: dummyDoc,
        cancelReason: 'Erro de lançamento em armazém',
        onCancelReasonChange: onCancelReasonChangeMock,
        isCancelling: false,
        onClose: vi.fn(),
        onConfirmCancel: onConfirmCancelMock,
      });

      const textareas = findElements(tree, (el) => el.type === 'textarea');
      expect(textareas).toHaveLength(1);
      textareas[0].props.onChange({ target: { value: 'Nova razão' } });
      expect(onCancelReasonChangeMock).toHaveBeenCalledWith('Nova razão');

      const confirmButtons = findElements(tree, (el) => el.type === 'button' && el.props?.children === 'Confirmar Anulação');
      expect(confirmButtons[0].props.disabled).toBe(false);

      confirmButtons[0].props.onClick({ preventDefault: vi.fn() });
      expect(onConfirmCancelMock).toHaveBeenCalledTimes(1);
    });

    it('disables confirm and shows loading state when isCancelling is true', () => {
      const tree = CancelGuideModal({
        cancellingGuide: dummyDoc,
        cancelReason: 'Motivo válido',
        onCancelReasonChange: vi.fn(),
        isCancelling: true,
        onClose: vi.fn(),
        onConfirmCancel: vi.fn(),
      });

      const loadingButtons = findElements(tree, (el) => el.type === 'button' && el.props?.children === 'A anular...');
      expect(loadingButtons).toHaveLength(1);
      expect(loadingButtons[0].props.disabled).toBe(true);
    });
  });

  describe('Direct Guide Write-Safety Mutex & Runtime Contracts (useDirectStockMovement)', () => {
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
      expect(hook.savingRef.current).toBe(false);
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

  describe('Transfer Write-Safety & Mutex Runtime Contracts (useStockTransfersManagement)', () => {
    const dummyWarehouses: AccessScope[] = [
      { id: 'wh-1', name: 'Armazém Central' },
      { id: 'wh-2', name: 'Armazém Secundário' },
    ];
    const dummyArticles: Article[] = [
      { id: 'art-1', code: 'PNEU-01', description: 'Pneu Radial', unit: 'UN', stock: 20, minStock: 5, costPrice: 1000, sellPrice: 1500, taxRate: 16, category: 'Geral' },
    ];

    const dummyTransfer: StockTransfer = {
      id: 'trf-123',
      transferNumber: 'TRF-2026/001',
      transferDate: '2026-08-20',
      fromWarehouseId: 'wh-1',
      fromWarehouseName: 'Armazém Central',
      toWarehouseId: 'wh-2',
      toWarehouseName: 'Armazém Secundário',
      status: 'PENDING',
      lines: [{ productId: 'art-1', productCode: 'PNEU-01', productName: 'Pneu Radial', quantity: 5, unitCost: 1000 }],
    };

    beforeEach(() => {
      if (typeof window === 'undefined') {
        (globalThis as any).window = {
          confirm: vi.fn(() => true),
          prompt: vi.fn(() => 'Cancelada pelo operador'),
          scrollTo: vi.fn(),
        };
      }
      vi.spyOn(StockTransfersService, 'fetchTransfers').mockResolvedValue([]);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('prevents duplicate sendTransfer via transferWriteLockRef mutex', async () => {
      let resolveCreate!: (val: any) => void;
      const pendingCreate = new Promise<any>((res) => { resolveCreate = res; });
      const createSpy = vi.spyOn(StockTransfersService, 'createTransfer').mockImplementation(() => pendingCreate);
      const dispatchSpy = vi.spyOn(StockTransfersService, 'dispatchTransfer').mockResolvedValue({
        id: 'trf-created-1',
        transferNumber: 'TRF-001',
        status: 'IN_TRANSIT',
      });

      let hook!: ReturnType<typeof useStockTransfersManagement>;
      const Harness: React.FC = () => {
        hook = useStockTransfersManagement({
          articles: dummyArticles,
          warehouses: dummyWarehouses,
          initialTransferDraft: {
            fromWarehouseId: 'wh-1',
            toWarehouseId: 'wh-2',
            items: [{ articleId: 'art-1', articleCode: 'PNEU-01', articleDescription: 'Pneu', quantity: 5, currentStock: 10 }],
          },
        });
        return null;
      };

      renderToString(React.createElement(Harness));

      // Trigger two concurrent submissions
      const p1 = hook.sendTransfer();
      const p2 = hook.sendTransfer();

      resolveCreate({ id: 'trf-created-1', transferNumber: 'TRF-001', status: 'PENDING' });
      await Promise.all([p1, p2]);

      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(dispatchSpy).toHaveBeenCalledTimes(1);
      expect(hook.transferWriteLockRef.current).toBe(false);
    });

    it('releases lock on transfer creation failure for retry', async () => {
      const createSpy = vi.spyOn(StockTransfersService, 'createTransfer')
        .mockRejectedValueOnce(new Error('Erro no servidor de transferências'))
        .mockResolvedValueOnce({ id: 'trf-created-2', transferNumber: 'TRF-002', status: 'PENDING' });
      const dispatchSpy = vi.spyOn(StockTransfersService, 'dispatchTransfer').mockResolvedValue({
        id: 'trf-created-2',
        transferNumber: 'TRF-002',
        status: 'IN_TRANSIT',
      });

      let hook!: ReturnType<typeof useStockTransfersManagement>;
      const Harness: React.FC = () => {
        hook = useStockTransfersManagement({
          articles: dummyArticles,
          warehouses: dummyWarehouses,
          initialTransferDraft: {
            fromWarehouseId: 'wh-1',
            toWarehouseId: 'wh-2',
            items: [{ articleId: 'art-1', articleCode: 'PNEU-01', articleDescription: 'Pneu', quantity: 5, currentStock: 10 }],
          },
        });
        return null;
      };

      renderToString(React.createElement(Harness));

      // First attempt fails
      await hook.sendTransfer();
      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(hook.transferWriteLockRef.current).toBe(false);

      // Second attempt succeeds
      await hook.sendTransfer();
      expect(createSpy).toHaveBeenCalledTimes(2);
      expect(dispatchSpy).toHaveBeenCalledTimes(1);
      expect(hook.transferWriteLockRef.current).toBe(false);
    });

    it('prevents concurrent dispatchExistingTransfer calls via transferWriteLockRef mutex', async () => {
      let resolveDispatch!: (val: any) => void;
      const pendingDispatch = new Promise<any>((res) => { resolveDispatch = res; });
      const dispatchSpy = vi.spyOn(StockTransfersService, 'dispatchTransfer').mockImplementation(() => pendingDispatch);
      window.confirm = vi.fn().mockReturnValue(true);

      let hook!: ReturnType<typeof useStockTransfersManagement>;
      const Harness: React.FC = () => {
        hook = useStockTransfersManagement({
          articles: dummyArticles,
          warehouses: dummyWarehouses,
        });
        return null;
      };

      renderToString(React.createElement(Harness));

      const p1 = hook.dispatchExistingTransfer(dummyTransfer);
      const p2 = hook.dispatchExistingTransfer(dummyTransfer);

      resolveDispatch({ id: 'trf-123', transferNumber: 'TRF-2026/001', status: 'IN_TRANSIT' });
      await Promise.all([p1, p2]);

      expect(dispatchSpy).toHaveBeenCalledTimes(1);
      expect(hook.transferWriteLockRef.current).toBe(false);
    });

    it('prevents concurrent receiveTransfer calls via transferWriteLockRef mutex', async () => {
      let resolveReceive!: (val: any) => void;
      const pendingReceive = new Promise<any>((res) => { resolveReceive = res; });
      const receiveSpy = vi.spyOn(StockTransfersService, 'receiveTransfer').mockImplementation(() => pendingReceive);
      window.confirm = vi.fn().mockReturnValue(true);

      let hook!: ReturnType<typeof useStockTransfersManagement>;
      const Harness: React.FC = () => {
        hook = useStockTransfersManagement({
          articles: dummyArticles,
          warehouses: dummyWarehouses,
        });
        return null;
      };

      renderToString(React.createElement(Harness));

      const p1 = hook.receiveTransfer({ ...dummyTransfer, status: 'IN_TRANSIT' });
      const p2 = hook.receiveTransfer({ ...dummyTransfer, status: 'IN_TRANSIT' });

      resolveReceive({ id: 'trf-123', transferNumber: 'TRF-2026/001', status: 'RECEIVED' });
      await Promise.all([p1, p2]);

      expect(receiveSpy).toHaveBeenCalledTimes(1);
      expect(hook.transferWriteLockRef.current).toBe(false);
    });

    it('prevents concurrent voidTransfer calls via transferWriteLockRef mutex', async () => {
      let resolveCancel!: (val: any) => void;
      const pendingCancel = new Promise<any>((res) => { resolveCancel = res; });
      const cancelSpy = vi.spyOn(StockTransfersService, 'cancelTransfer').mockImplementation(() => pendingCancel);
      window.prompt = vi.fn().mockReturnValue('Cancelada pelo operador');

      let hook!: ReturnType<typeof useStockTransfersManagement>;
      const Harness: React.FC = () => {
        hook = useStockTransfersManagement({
          articles: dummyArticles,
          warehouses: dummyWarehouses,
        });
        return null;
      };

      renderToString(React.createElement(Harness));

      const p1 = hook.voidTransfer(dummyTransfer);
      const p2 = hook.voidTransfer(dummyTransfer);

      resolveCancel({ id: 'trf-123', transferNumber: 'TRF-2026/001', status: 'CANCELLED' });
      await Promise.all([p1, p2]);

      expect(cancelSpy).toHaveBeenCalledTimes(1);
      expect(hook.transferWriteLockRef.current).toBe(false);
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
