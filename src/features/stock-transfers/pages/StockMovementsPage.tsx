import React, { useState, useEffect, useMemo } from 'react';
import type { Article, DocumentRecord } from '@/shared/types/domain.types';
import type { StockMovementsProps, StockWorkspaceMode } from '../types/stock-transfer.types';
import { InventoryService } from '@/features/inventory/services/inventory.service';
import { ArticleLedgerModal } from '@/features/inventory/components/ArticleLedgerModal';
import { useDirectStockMovement } from '../hooks/useDirectStockMovement';
import { useStockTransfersManagement } from '../hooks/useStockTransfersManagement';
import { useStockMovementHistory } from '../hooks/useStockMovementHistory';
import { StockModeSelector } from '../components/StockModeSelector';
import { DirectMovementSection } from '../components/DirectMovementSection';
import { DirectGuideHistorySection } from '../components/DirectGuideHistorySection';
import { StockTransferSection } from '../components/StockTransferSection';
import { TransferHistorySection } from '../components/TransferHistorySection';
import { MovementHistorySection } from '../components/MovementHistorySection';
import { CancelGuideModal } from '../components/CancelGuideModal';

export const StockMovements: React.FC<StockMovementsProps> = ({
  movements = [],
  articles,
  suppliers,
  documents = [],
  warehouses,
  operatorName,
  onSaveGuide,
  onCancelGuide,
  onOpenDocument,
  canPostEntry,
  canPostExit,
  canAllowNegative,
  canViewCost = true,
  canCancelGuide,
  canTransfer,
}) => {
  const [workspaceMode, setWorkspaceMode] = useState<StockWorkspaceMode>('direct');
  const [ledgerArticle, setLedgerArticle] = useState<Article | null>(null);
  const [cancellingGuide, setCancellingGuide] = useState<DocumentRecord | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // History hook
  const history = useStockMovementHistory({ initialMovements: movements });

  // Direct Movement hook
  const directMovement = useDirectStockMovement({
    articles,
    suppliers,
    warehouses,
    documents,
    canPostEntry,
    canPostExit,
    canAllowNegative,
    onSaveGuide,
    onSuccessCallback: () => {
      history.triggerHistoryRefresh();
    },
  });

  // Transfers Management hook
  const transfers = useStockTransfersManagement({
    articles,
    warehouses,
    canTransfer,
    canAllowNegative,
    documentDate: directMovement.documentDate,
    onSuccessCallback: () => {
      history.triggerHistoryRefresh();
    },
  });

  // Loaders
  const directArticleLoader = useMemo(
    () => (query: string) => InventoryService.searchProducts(query, directMovement.warehouseId || undefined, 50),
    [directMovement.warehouseId]
  );

  const transferArticleLoader = useMemo(
    () => (query: string) => InventoryService.searchProducts(query, transfers.transferFromWarehouseId || undefined, 50),
    [transfers.transferFromWarehouseId]
  );

  // Global Keyboard shortcut F2 to submit direct guide
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' && workspaceMode === 'direct') {
        e.preventDefault();
        void directMovement.submitGuide();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [workspaceMode, directMovement]);

  const confirmGuideCancellation = async () => {
    if (!cancellingGuide || isCancelling) return;
    if (!cancelReason.trim()) {
      directMovement.setError('Indique o motivo da anulação da guia.');
      return;
    }
    setIsCancelling(true);
    try {
      await onCancelGuide(cancellingGuide.id, cancelReason.trim());
      if (directMovement.editingGuideId === cancellingGuide.id) {
        directMovement.clearGuideForm();
      }
      directMovement.setSuccess(
        `Guia ${cancellingGuide.externalReference || cancellingGuide.displayNumber} anulada e stock revertido.`
      );
      setCancellingGuide(null);
      setCancelReason('');
      history.triggerHistoryRefresh();
    } catch (cause) {
      directMovement.setError(cause instanceof Error ? cause.message : 'Falha ao anular a guia.');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <StockModeSelector
        workspaceMode={workspaceMode}
        type={directMovement.type}
        warehouses={warehouses}
        canPostEntry={canPostEntry}
        canPostExit={canPostExit}
        canTransfer={canTransfer}
        onSelectMode={(mode, newType) => {
          setWorkspaceMode(mode);
          if (newType) directMovement.setType(newType);
          directMovement.setError('');
          directMovement.setSuccess('');
          transfers.setTransferError('');
          transfers.setTransferSuccess('');
        }}
      />

      {workspaceMode === 'direct' && (canPostEntry || canPostExit) && (
        <div className="space-y-6">
          <DirectMovementSection
            type={directMovement.type}
            onTypeChange={directMovement.setType}
            warehouseId={directMovement.warehouseId}
            onWarehouseChange={directMovement.setWarehouseId}
            warehouses={warehouses}
            guideNumber={directMovement.guideNumber}
            onGuideNumberChange={directMovement.setGuideNumber}
            documentDate={directMovement.documentDate}
            onDocumentDateChange={directMovement.setDocumentDate}
            supplierId={directMovement.supplierId}
            onSupplierChange={directMovement.setSupplierId}
            suppliers={suppliers}
            notes={directMovement.notes}
            onNotesChange={directMovement.setNotes}
            operatorName={operatorName}
            canPostEntry={canPostEntry}
            canPostExit={canPostExit}
            canViewCost={canViewCost}
            articles={articles}
            articleId={directMovement.articleId}
            onSelectArticle={directMovement.handleSelectArticle}
            onAfterArticleSelect={directMovement.handleAfterArticleSelect}
            resolvedArticle={directMovement.resolvedArticle}
            onResolveArticle={directMovement.setResolvedArticle}
            directArticleLoader={directArticleLoader}
            quantityStr={directMovement.quantityStr}
            onQuantityChange={directMovement.setQuantityStr}
            unitCostStr={directMovement.unitCostStr}
            onUnitCostChange={directMovement.setUnitCostStr}
            priceWithIvaStr={directMovement.priceWithIvaStr}
            onPriceWithIvaChange={directMovement.setPriceWithIvaStr}
            article={directMovement.article}
            guideItems={directMovement.guideItems}
            editingGuideId={directMovement.editingGuideId}
            editingDocument={directMovement.editingDocument}
            saving={directMovement.saving}
            error={directMovement.error}
            success={directMovement.success}
            lastSavedGuide={directMovement.lastSavedGuide}
            guideNumberRef={directMovement.guideNumberRef}
            notesRef={directMovement.notesRef}
            qtyInputRef={directMovement.qtyInputRef}
            costInputRef={directMovement.costInputRef}
            priceInputRef={directMovement.priceInputRef}
            onAddItemToGuide={directMovement.addItemToGuide}
            onRemoveItemFromGuide={directMovement.removeItemFromGuide}
            onClearGuideForm={directMovement.clearGuideForm}
            onSubmitGuide={directMovement.submitGuide}
            onOpenDocument={onOpenDocument}
          />

          <DirectGuideHistorySection
            stockGuideDocuments={directMovement.stockGuideDocuments}
            lastSavedGuide={directMovement.lastSavedGuide}
            canCancelGuide={canCancelGuide}
            onOpenDocument={onOpenDocument}
            onEditGuide={directMovement.openGuideForEdit}
            onCancelGuide={(doc) => {
              setCancellingGuide(doc);
              setCancelReason('');
              directMovement.setError('');
            }}
          />
        </div>
      )}

      {workspaceMode === 'transfer' && canTransfer && (
        <div className="space-y-6">
          <StockTransferSection
            transferFromWarehouseId={transfers.transferFromWarehouseId}
            onTransferFromWarehouseChange={transfers.setTransferFromWarehouseId}
            transferToWarehouseId={transfers.transferToWarehouseId}
            onTransferToWarehouseChange={transfers.setTransferToWarehouseId}
            warehouses={warehouses}
            articles={articles}
            transferArticleId={transfers.transferArticleId}
            onSelectTransferArticle={transfers.setTransferArticleId}
            resolvedTransferArticle={transfers.resolvedTransferArticle}
            onResolveTransferArticle={transfers.setResolvedTransferArticle}
            transferArticleLoader={transferArticleLoader}
            transferQuantityStr={transfers.transferQuantityStr}
            onTransferQuantityChange={transfers.setTransferQuantityStr}
            transferNotes={transfers.transferNotes}
            onTransferNotesChange={transfers.setTransferNotes}
            transferItems={transfers.transferItems}
            transferLoading={transfers.transferLoading}
            transferError={transfers.transferError}
            transferSuccess={transfers.transferSuccess}
            onAddTransferItem={transfers.addTransferItem}
            onRemoveTransferItem={transfers.removeTransferItem}
            onSendTransfer={transfers.sendTransfer}
          />

          <TransferHistorySection
            transfers={transfers.transfers}
            transferLoading={transfers.transferLoading}
            onDispatchTransfer={transfers.dispatchExistingTransfer}
            onReceiveTransfer={transfers.receiveTransfer}
            onVoidTransfer={transfers.voidTransfer}
          />
        </div>
      )}

      <MovementHistorySection
        historyMovements={history.historyMovements}
        historyTotalCount={history.historyTotalCount}
        historyTotalStock={history.historyTotalStock}
        historyLoading={history.historyLoading}
        historyError={history.historyError}
        movementsPage={history.movementsPage}
        onPageChange={history.setMovementsPage}
        movementsPageSize={history.movementsPageSize}
        dateFrom={history.dateFrom}
        onDateFromChange={history.setDateFrom}
        dateTo={history.dateTo}
        onDateToChange={history.setDateTo}
        typeFilter={history.typeFilter}
        onTypeFilterChange={history.setTypeFilter}
        searchQuery={history.searchQuery}
        onSearchQueryChange={history.setSearchQuery}
        onClearFilters={history.handleClearFilters}
        onExportCSV={history.exportMovementsToCSV}
        onOpenLedger={(art) => setLedgerArticle(art)}
        articles={articles}
      />

      <CancelGuideModal
        cancellingGuide={cancellingGuide}
        cancelReason={cancelReason}
        onCancelReasonChange={setCancelReason}
        isCancelling={isCancelling}
        onClose={() => {
          setCancellingGuide(null);
          setCancelReason('');
        }}
        onConfirmCancel={confirmGuideCancellation}
      />

      <ArticleLedgerModal
        isOpen={Boolean(ledgerArticle)}
        article={ledgerArticle}
        articles={articles}
        movements={movements}
        documents={documents}
        onClose={() => setLedgerArticle(null)}
        onOpenDocument={onOpenDocument}
        canViewCost={canViewCost}
      />
    </div>
  );
};

export { StockMovements as StockMovementsPage };
export default StockMovements;
