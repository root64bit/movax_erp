import { useState, useEffect, useCallback, useRef } from 'react';
import type { Article, AccessScope, StockTransfer } from '@/shared/types/domain.types';
import type { GuideLineItem } from '../types/stock-transfer.types';
import { StockTransfersService } from '../services/stockTransfers.service';

export interface UseStockTransfersManagementProps {
  articles: Article[];
  warehouses: AccessScope[];
  documentDate?: string;
  canTransfer?: boolean;
  canAllowNegative?: boolean;
  onSuccessCallback?: () => void;
}

export function useStockTransfersManagement({
  articles,
  warehouses,
  documentDate: initialDocumentDate,
  canTransfer = true,
  canAllowNegative = false,
  onSuccessCallback,
}: UseStockTransfersManagementProps) {
  const [transferFromWarehouseId, setTransferFromWarehouseId] = useState(() => warehouses[0]?.id || '');
  const [transferToWarehouseId, setTransferToWarehouseId] = useState(() => warehouses[1]?.id || '');
  const [transferArticleId, setTransferArticleId] = useState('');
  const [resolvedTransferArticle, setResolvedTransferArticle] = useState<Article | null>(null);
  const [transferQuantityStr, setTransferQuantityStr] = useState('');
  const [documentDate] = useState(() => initialDocumentDate || new Date().toISOString().slice(0, 10));
  const [transferNotes, setTransferNotes] = useState('');
  const [transferItems, setTransferItems] = useState<GuideLineItem[]>([]);

  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [transferLoading, setTransferLoading] = useState(false);
  const transferWriteLockRef = useRef(false);
  const [transferError, setTransferError] = useState('');
  const [transferSuccess, setTransferSuccess] = useState('');
  const [transferRefreshKey, setTransferRefreshKey] = useState(0);

  const loadTransfers = useCallback(async () => {
    if (!canTransfer) return;
    setTransferLoading(true);
    setTransferError('');
    try {
      const rows = await StockTransfersService.fetchTransfers(100);
      setTransfers(rows);
    } catch (cause) {
      setTransferError(cause instanceof Error ? cause.message : 'Falha ao carregar transferências.');
    } finally {
      setTransferLoading(false);
    }
  }, [canTransfer]);

  useEffect(() => {
    void loadTransfers();
  }, [loadTransfers, transferRefreshKey]);

  const addTransferItem = useCallback(() => {
    const selected = resolvedTransferArticle?.id === transferArticleId
      ? resolvedTransferArticle
      : articles.find((item) => item.id === transferArticleId);
    const qty = Number(transferQuantityStr);
    if (!selected || !Number.isFinite(qty) || qty <= 0) {
      setTransferError('Seleccione um artigo e indique uma quantidade válida.');
      return;
    }
    if (qty > selected.stock && !canAllowNegative) {
      setTransferError(`Stock insuficiente em ${selected.code}: disponível ${selected.stock}, solicitado ${qty}.`);
      return;
    }
    setTransferError('');
    setTransferItems((current) => {
      const next: GuideLineItem = {
        articleId: selected.id,
        articleCode: selected.code,
        articleDescription: selected.description,
        quantity: qty,
        currentStock: selected.stock,
        unitCost: selected.costPrice,
      };
      const exists = current.findIndex((item) => item.articleId === selected.id);
      return exists < 0 ? [...current, next] : current.map((item, index) => index === exists ? next : item);
    });
    setTransferArticleId('');
    setResolvedTransferArticle(null);
    setTransferQuantityStr('');
  }, [resolvedTransferArticle, transferArticleId, articles, transferQuantityStr, canAllowNegative]);

  const removeTransferItem = useCallback((index: number) => {
    setTransferItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const sendTransfer = useCallback(async () => {
    if (transferWriteLockRef.current) return;
    if (!transferFromWarehouseId || !transferToWarehouseId || transferFromWarehouseId === transferToWarehouseId) {
      setTransferError('Escolha armazéns de origem e destino diferentes.');
      return;
    }
    if (transferItems.length === 0) {
      setTransferError('Adicione pelo menos um artigo à transferência.');
      return;
    }

    transferWriteLockRef.current = true;
    setTransferLoading(true);
    setTransferError('');
    setTransferSuccess('');
    try {
      const created = await StockTransfersService.createTransfer({
        fromWarehouseId: transferFromWarehouseId,
        toWarehouseId: transferToWarehouseId,
        transferDate: documentDate,
        notes: transferNotes,
        lines: transferItems.map((item) => ({ articleId: item.articleId, quantity: item.quantity })),
      });
      await StockTransfersService.dispatchTransfer(created.id);
      setTransferItems([]);
      setTransferArticleId('');
      setResolvedTransferArticle(null);
      setTransferQuantityStr('');
      setTransferNotes('');
      setTransferSuccess(`${created.transferNumber} enviada. O stock saiu da origem e está agora em trânsito.`);
      setTransferRefreshKey((val) => val + 1);
      onSuccessCallback?.();
    } catch (cause) {
      setTransferError(cause instanceof Error ? cause.message : 'Falha ao enviar transferência.');
    } finally {
      transferWriteLockRef.current = false;
      setTransferLoading(false);
    }
  }, [
    transferFromWarehouseId,
    transferToWarehouseId,
    transferItems,
    documentDate,
    transferNotes,
    onSuccessCallback,
  ]);

  const dispatchExistingTransfer = useCallback(async (transfer: StockTransfer) => {
    if (transferWriteLockRef.current) return;
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (!window.confirm(`Enviar ${transfer.transferNumber} de ${transfer.fromWarehouseName} para ${transfer.toWarehouseName}?`)) return;
    }
    transferWriteLockRef.current = true;
    setTransferLoading(true);
    setTransferError('');
    setTransferSuccess('');
    try {
      await StockTransfersService.dispatchTransfer(transfer.id);
      setTransferSuccess(`${transfer.transferNumber} enviada. O stock está em trânsito.`);
      setTransferRefreshKey((val) => val + 1);
      onSuccessCallback?.();
    } catch (cause) {
      setTransferError(cause instanceof Error ? cause.message : 'Falha ao enviar transferência.');
    } finally {
      transferWriteLockRef.current = false;
      setTransferLoading(false);
    }
  }, [onSuccessCallback]);

  const receiveTransfer = useCallback(async (transfer: StockTransfer) => {
    if (transferWriteLockRef.current) return;
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (!window.confirm(`Confirmar recepção de ${transfer.transferNumber} em ${transfer.toWarehouseName}?`)) return;
    }
    transferWriteLockRef.current = true;
    setTransferLoading(true);
    setTransferError('');
    try {
      await StockTransfersService.receiveTransfer(transfer.id);
      setTransferSuccess(`${transfer.transferNumber} recebida e adicionada ao stock de ${transfer.toWarehouseName}.`);
      setTransferRefreshKey((val) => val + 1);
      onSuccessCallback?.();
    } catch (cause) {
      setTransferError(cause instanceof Error ? cause.message : 'Falha ao receber transferência.');
    } finally {
      transferWriteLockRef.current = false;
      setTransferLoading(false);
    }
  }, [onSuccessCallback]);

  const voidTransfer = useCallback(async (transfer: StockTransfer) => {
    if (transferWriteLockRef.current) return;
    let reason: string | null = 'Cancelada pelo operador';
    if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
      reason = window.prompt(`Motivo do cancelamento de ${transfer.transferNumber}:`, 'Cancelada pelo operador');
      if (reason === null) return;
    }
    transferWriteLockRef.current = true;
    setTransferLoading(true);
    setTransferError('');
    try {
      await StockTransfersService.cancelTransfer(transfer.id, reason);
      setTransferSuccess(`${transfer.transferNumber} cancelada. ${transfer.status === 'IN_TRANSIT' ? 'O stock regressou ao armazém de origem.' : ''}`);
      setTransferRefreshKey((val) => val + 1);
      onSuccessCallback?.();
    } catch (cause) {
      setTransferError(cause instanceof Error ? cause.message : 'Falha ao cancelar transferência.');
    } finally {
      transferWriteLockRef.current = false;
      setTransferLoading(false);
    }
  }, [onSuccessCallback]);

  return {
    transferFromWarehouseId,
    setTransferFromWarehouseId,
    transferToWarehouseId,
    setTransferToWarehouseId,
    transferArticleId,
    setTransferArticleId,
    resolvedTransferArticle,
    setResolvedTransferArticle,
    transferQuantityStr,
    setTransferQuantityStr,
    transferNotes,
    setTransferNotes,
    transferItems,
    setTransferItems,
    transfers,
    transferLoading,
    transferWriteLockRef,
    transferError,
    setTransferError,
    transferSuccess,
    setTransferSuccess,
    transferRefreshKey,
    setTransferRefreshKey,
    loadTransfers,
    addTransferItem,
    removeTransferItem,
    sendTransfer,
    dispatchExistingTransfer,
    receiveTransfer,
    voidTransfer,
  };
}
