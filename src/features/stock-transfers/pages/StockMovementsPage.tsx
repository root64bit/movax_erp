import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AccessScope, Article, StockMovement, DocumentRecord, StockGuideInput, StockGuideItem, Supplier, StockTransfer } from '@/shared/types/domain.types';
import { ArticleSearchSelect } from '@/features/inventory/components/ArticleSearchSelect';
import { ArticleLedgerModal } from '@/features/inventory/components/ArticleLedgerModal';
import { Pagination } from '@/components/Pagination';
import { formatMZN } from '@/shared/utils/formatters';
import { StockTransfersService } from '../services/stockTransfers.service';
import { InventoryService } from '@/features/inventory/services/inventory.service';
import { fetchStockMovementsPage } from '@/lib/appData';

export type GuideLineItem = StockGuideItem;

interface StockMovementsProps {
  movements: StockMovement[];
  articles: Article[];
  suppliers: Supplier[];
  documents?: DocumentRecord[];
  warehouses: AccessScope[];
  operatorName: string;
  onSaveGuide: (guide: StockGuideInput) => Promise<string>;
  onCancelGuide: (documentId: string, reason: string) => Promise<void>;
  onOpenDocument?: (doc: DocumentRecord) => void;
  canPostEntry: boolean;
  canPostExit: boolean;
  canAllowNegative: boolean;
  canViewCost?: boolean;
  canCancelGuide: boolean;
  canTransfer: boolean;
}

export const StockMovements: React.FC<StockMovementsProps> = ({
  movements, articles, suppliers, documents = [], warehouses, operatorName, onSaveGuide, onCancelGuide, onOpenDocument, canPostEntry, canPostExit, canAllowNegative, canViewCost = true, canCancelGuide, canTransfer,
}) => {
  const [workspaceMode, setWorkspaceMode] = useState<'direct' | 'transfer'>('direct');
  const [type, setType] = useState<'entrada' | 'saida'>(canPostEntry ? 'entrada' : 'saida');
  const [warehouseId, setWarehouseId] = useState('');
  const [articleId, setArticleId] = useState('');
  const [resolvedArticle, setResolvedArticle] = useState<Article | null>(null);
  const [quantityStr, setQuantityStr] = useState('');
  const [guideNumber, setGuideNumber] = useState('');
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().slice(0, 10));
  const [supplierId, setSupplierId] = useState('');
  const [unitCostStr, setUnitCostStr] = useState('');
  const [priceWithIvaStr, setPriceWithIvaStr] = useState('');
  const [notes, setNotes] = useState('');
  
  // Batch guide items (up to 99 items per guide)
  const [guideItems, setGuideItems] = useState<GuideLineItem[]>([]);

  // History Pagination
  const [movementsPage, setMovementsPage] = useState(1);
  const [movementsPageSize, setMovementsPageSize] = useState(25);
  const [historyMovements, setHistoryMovements] = useState<StockMovement[]>([]);
  const [historyTotalCount, setHistoryTotalCount] = useState(0);
  const [historyTotalStock, setHistoryTotalStock] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [ledgerArticle, setLedgerArticle] = useState<Article | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [editingGuideId, setEditingGuideId] = useState<string | null>(null);
  const [lastSavedGuide, setLastSavedGuide] = useState<DocumentRecord | null>(null);
  const [cancellingGuide, setCancellingGuide] = useState<DocumentRecord | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const guideNumberRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const costInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);

  // Date and Text Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'entrada' | 'saida'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Inter-warehouse transfers: intentionally simpler than a full ERP wizard.
  // The operator prepares the lines, sends them, and the destination confirms receipt.
  const [transferFromWarehouseId, setTransferFromWarehouseId] = useState('');
  const [transferToWarehouseId, setTransferToWarehouseId] = useState('');
  const [transferArticleId, setTransferArticleId] = useState('');
  const [resolvedTransferArticle, setResolvedTransferArticle] = useState<Article | null>(null);
  const [transferQuantityStr, setTransferQuantityStr] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [transferItems, setTransferItems] = useState<GuideLineItem[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [transferSuccess, setTransferSuccess] = useState('');
  const [transferRefreshKey, setTransferRefreshKey] = useState(0);

  // Clear Filters
  const handleClearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setTypeFilter('ALL');
    setSearchQuery('');
  };

  useEffect(() => {
    let cancelled=false;
    const timer=window.setTimeout(() => {
      setHistoryLoading(true);
      setHistoryError('');
      fetchStockMovementsPage(
        dateFrom,dateTo,typeFilter,searchQuery,movementsPageSize,(movementsPage-1)*movementsPageSize,
      ).then((result) => {
        if(cancelled)return;
        const lastAvailablePage=Math.max(1,Math.ceil(result.totalCount/movementsPageSize));
        if(movementsPage>lastAvailablePage){
          setMovementsPage(lastAvailablePage);
          return;
        }
        setHistoryMovements(result.rows);
        setHistoryTotalCount(result.totalCount);
        setHistoryTotalStock(result.totalStock);
      }).catch((cause) => {
        if(!cancelled)setHistoryError(cause instanceof Error?cause.message:'Falha ao carregar histórico de movimentos.');
      }).finally(() => { if(!cancelled)setHistoryLoading(false); });
    },searchQuery?250:0);
    return()=>{cancelled=true;window.clearTimeout(timer);};
  },[dateFrom,dateTo,typeFilter,searchQuery,movementsPage,movementsPageSize,movements,historyRefreshKey]);

  useEffect(()=>{setMovementsPage(1);},[dateFrom,dateTo,typeFilter,searchQuery,movementsPageSize]);

  const exportMovementsToCSV = () => {
    const headers = ['Data', 'Tipo', 'Documento / Guia', 'Código Artigo', 'Descrição Artigo', 'Entrada (Qtd)', 'Saída (Qtd)', 'Saldo Final'];
    const sorted = [...historyMovements];
    
    const rows = sorted.map((item) => {
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

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    const dateSuffix = dateFrom || dateTo ? `_${dateFrom || 'inicio'}_a_${dateTo || 'hoje'}` : '';
    link.download = `movimentos-stock-pagina-${movementsPage}${dateSuffix}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const article = useMemo(
    () => resolvedArticle?.id === articleId ? resolvedArticle : articles.find((item) => item.id === articleId),
    [articles, articleId, resolvedArticle],
  );
  const directArticleLoader = useMemo(
    () => (query: string) => InventoryService.searchProducts(query, warehouseId || undefined, 50),
    [warehouseId],
  );
  const transferArticleLoader = useMemo(
    () => (query: string) => InventoryService.searchProducts(query, transferFromWarehouseId || undefined, 50),
    [transferFromWarehouseId],
  );
  const quantity = Number(quantityStr) || 0;
  const expectedStock = article ? article.stock + (type === 'entrada' ? quantity : -quantity) : 0;
  const stockGuideDocuments = useMemo(() => documents
    .filter((document) => document.typeCode === 'STOCK_ENTRY_GUIDE' || document.typeCode === 'STOCK_EXIT_GUIDE')
    .sort((left, right) => {
      const dateDifference = new Date(right.date).getTime() - new Date(left.date).getTime();
      return dateDifference || (right.createdAt || '').localeCompare(left.createdAt || '');
    }), [documents]);
  const editingDocument = useMemo(
    () => stockGuideDocuments.find((document) => document.id === editingGuideId),
    [stockGuideDocuments, editingGuideId],
  );
  const supplierCreditTotal = useMemo(
    () => guideItems.reduce((sum, item) => sum + item.quantity * (item.unitCost ?? 0), 0),
    [guideItems],
  );

  const projectedStockFor = (item: GuideLineItem) => {
    const originalQuantity = editingDocument?.stockGuideItems?.find((original) => original.articleId === item.articleId)?.quantity ?? 0;
    const direction = type === 'entrada' ? 1 : -1;
    return item.currentStock + direction * (item.quantity - originalQuantity);
  };

  useEffect(() => { if (!warehouseId && warehouses[0]) setWarehouseId(warehouses[0].id); }, [warehouses, warehouseId]);
  useEffect(() => { if (!canPostEntry && canPostExit) setType('saida'); }, [canPostEntry, canPostExit]);
  useEffect(() => {
    if (!transferFromWarehouseId && warehouses[0]) setTransferFromWarehouseId(warehouses[0].id);
    if (!transferToWarehouseId && warehouses.length > 1) setTransferToWarehouseId(warehouses[1].id);
  }, [warehouses, transferFromWarehouseId, transferToWarehouseId]);

  useEffect(() => {
    if (!canTransfer) return;
    let cancelled = false;
    setTransferLoading(true);
    setTransferError('');
    void StockTransfersService.fetchTransfers(100)
      .then((rows: StockTransfer[]) => { if (!cancelled) setTransfers(rows); })
      .catch((cause: any) => { if (!cancelled) setTransferError(cause instanceof Error ? cause.message : 'Falha ao carregar transferências.'); })
      .finally(() => { if (!cancelled) setTransferLoading(false); });
    return () => { cancelled = true; };
  }, [canTransfer, transferRefreshKey, movements]);

  const addTransferItem = () => {
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
  };

  const sendTransfer = async () => {
    if (transferLoading) return;
    if (!transferFromWarehouseId || !transferToWarehouseId || transferFromWarehouseId === transferToWarehouseId) {
      setTransferError('Escolha armazéns de origem e destino diferentes.');
      return;
    }
    if (transferItems.length === 0) {
      setTransferError('Adicione pelo menos um artigo à transferência.');
      return;
    }
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
      setTransferRefreshKey((value) => value + 1);
      setHistoryRefreshKey((value) => value + 1);
    } catch (cause) {
      setTransferError(cause instanceof Error ? cause.message : 'Falha ao enviar transferência.');
    } finally {
      setTransferLoading(false);
    }
  };

  const receiveTransfer = async (transfer: StockTransfer) => {
    if (!window.confirm(`Confirmar recepção de ${transfer.transferNumber} em ${transfer.toWarehouseName}?`)) return;
    setTransferLoading(true);
    setTransferError('');
    try {
      await StockTransfersService.receiveTransfer(transfer.id);
      setTransferSuccess(`${transfer.transferNumber} recebida e adicionada ao stock de ${transfer.toWarehouseName}.`);
      setTransferRefreshKey((value) => value + 1);
      setHistoryRefreshKey((value) => value + 1);
    } catch (cause) {
      setTransferError(cause instanceof Error ? cause.message : 'Falha ao receber transferência.');
    } finally {
      setTransferLoading(false);
    }
  };

  const dispatchExistingTransfer = async (transfer: StockTransfer) => {
    if (!window.confirm(`Enviar ${transfer.transferNumber} de ${transfer.fromWarehouseName} para ${transfer.toWarehouseName}?`)) return;
    setTransferLoading(true);
    setTransferError('');
    setTransferSuccess('');
    try {
      await StockTransfersService.dispatchTransfer(transfer.id);
      setTransferSuccess(`${transfer.transferNumber} enviada. O stock está em trânsito.`);
      setTransferRefreshKey((value) => value + 1);
      setHistoryRefreshKey((value) => value + 1);
    } catch (cause) {
      setTransferError(cause instanceof Error ? cause.message : 'Falha ao enviar transferência.');
    } finally {
      setTransferLoading(false);
    }
  };

  const voidTransfer = async (transfer: StockTransfer) => {
    const reason = window.prompt(`Motivo do cancelamento de ${transfer.transferNumber}:`, 'Cancelada pelo operador');
    if (reason === null) return;
    setTransferLoading(true);
    setTransferError('');
    try {
      await StockTransfersService.cancelTransfer(transfer.id, reason);
      setTransferSuccess(`${transfer.transferNumber} cancelada. ${transfer.status === 'IN_TRANSIT' ? 'O stock regressou ao armazém de origem.' : ''}`);
      setTransferRefreshKey((value) => value + 1);
      setHistoryRefreshKey((value) => value + 1);
    } catch (cause) {
      setTransferError(cause instanceof Error ? cause.message : 'Falha ao cancelar transferência.');
    } finally {
      setTransferLoading(false);
    }
  };

  const handleSelectArticle = (id: string) => {
    setArticleId(id);
    setUnitCostStr('');
    setPriceWithIvaStr('');
  };

  const handleAfterArticleSelect = () => {
    setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 40);
  };

  const addItemToGuide = () => {
    if (guideItems.length >= 99) {
      setError('Limite máximo de 99 artigos por guia atingido.');
      return;
    }
    const targetArticle = article;
    const qty = Number(quantityStr);
    const cost = unitCostStr.trim() ? Number(unitCostStr) : undefined;
    const price = priceWithIvaStr.trim() ? Number(priceWithIvaStr) : undefined;
    if (!targetArticle || qty <= 0 || isNaN(qty)) {
      setError('Seleccione um artigo e indique uma quantidade válida.');
      return;
    }
    if ((cost !== undefined && (!Number.isFinite(cost) || cost < 0)) || (price !== undefined && (!Number.isFinite(price) || price < 0))) {
      setError('O custo e o preço de venda não podem ser negativos.');
      return;
    }
    if (type === 'saida' && qty > targetArticle.stock && !canAllowNegative) {
      setError(`A quantidade de saída (${qty}) excede o stock disponível (${targetArticle.stock}) para o artigo ${targetArticle.code}.`);
      return;
    }

    setError('');
    setGuideItems((prev) => {
      const nextItem: GuideLineItem = {
        articleId: targetArticle.id,
        articleCode: targetArticle.code,
        articleDescription: targetArticle.description,
        quantity: qty,
        unitCost: type === 'entrada' ? cost : undefined,
        salePriceWithIva: type === 'entrada' ? price : undefined,
        currentStock: targetArticle.stock,
      };
      const existingIndex = prev.findIndex((item) => item.articleId === targetArticle.id);
      return existingIndex < 0 ? [...prev, nextItem] : prev.map((item, index) => index === existingIndex ? nextItem : item);
    });

    setArticleId('');
    setResolvedArticle(null);
    setQuantityStr('');
    setUnitCostStr('');
    setPriceWithIvaStr('');

    setTimeout(() => {
      const searchInput = document.querySelector<HTMLInputElement>('input[placeholder*="Código do Artigo"]');
      if (searchInput) {
        searchInput.focus();
        searchInput.select?.();
      }
    }, 40);
  };

  const removeItemFromGuide = (index: number) => {
    setGuideItems((prev) => prev.filter((_, i) => i !== index));
  };

  const submitGuide = async () => {
    let currentGuideItems = [...guideItems];

    // If user has typed an item in the input row but hasn't clicked "Adicionar" yet, include it
    const targetArticle = article;
    const qty = Number(quantityStr);
    if (targetArticle && qty > 0 && !isNaN(qty)) {
      const typedCost = unitCostStr.trim() ? Number(unitCostStr) : undefined;
      const typedPrice = priceWithIvaStr.trim() ? Number(priceWithIvaStr) : undefined;
      if ((typedCost !== undefined && (!Number.isFinite(typedCost) || typedCost < 0)) || (typedPrice !== undefined && (!Number.isFinite(typedPrice) || typedPrice < 0))) {
        setError('O custo e o preco de venda nao podem ser negativos.');
        return;
      }
      if (type === 'saida' && qty > targetArticle.stock && !canAllowNegative) {
        setError(`A quantidade de saída (${qty}) excede o stock disponível (${targetArticle.stock}) para o artigo ${targetArticle.code}.`);
        return;
      }
      if (currentGuideItems.length < 99) {
        const typedItem: GuideLineItem = {
          articleId: targetArticle.id,
          articleCode: targetArticle.code,
          articleDescription: targetArticle.description,
          quantity: qty,
          unitCost: type === 'entrada' ? typedCost : undefined,
          salePriceWithIva: type === 'entrada' ? typedPrice : undefined,
          currentStock: targetArticle.stock,
        };
        const existingIndex = currentGuideItems.findIndex((item) => item.articleId === targetArticle.id);
        currentGuideItems = existingIndex < 0
          ? [...currentGuideItems, typedItem]
          : currentGuideItems.map((item, index) => index === existingIndex ? typedItem : item);
      }
    }

    if (currentGuideItems.length === 0) {
      setError('Adicione pelo menos um artigo à guia (até 99 artigos) antes de confirmar.');
      return;
    }

    if (!warehouseId) {
      setError('Seleccione o armazém antes de confirmar.');
      return;
    }
    if (!guideNumber.trim()) {
      setError('Introduza manualmente o número da guia.');
      return;
    }
    if (!documentDate) {
      setError('Seleccione a data da guia.');
      return;
    }
    if (currentGuideItems.some((item) => item.quantity <= 0 || !Number.isFinite(item.quantity) || (item.unitCost != null && (!Number.isFinite(item.unitCost) || item.unitCost < 0)) || (item.salePriceWithIva != null && (!Number.isFinite(item.salePriceWithIva) || item.salePriceWithIva < 0)))) {
      setError('Confirme as quantidades, custos e precos da guia antes de gravar.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const stockGuideItems = currentGuideItems.map((item) => ({
        ...item,
        unitCost: type === 'entrada' ? item.unitCost : undefined,
        salePriceWithIva: type === 'entrada' ? item.salePriceWithIva : undefined,
      }));
      const savedId = await onSaveGuide({
        id: editingGuideId || undefined,
        type,
        guideNumber: guideNumber.trim(),
        date: documentDate,
        warehouseId,
        supplierId: type === 'entrada' ? supplierId || undefined : undefined,
        supplierName: suppliers.find((supplier) => supplier.id === supplierId)?.name,
        notes,
        items: stockGuideItems,
      });
      const totalCost = stockGuideItems.reduce((sum, item) => sum + item.quantity * (item.unitCost ?? 0), 0);
      const printable: DocumentRecord = {
        id: savedId,
        displayNumber: guideNumber.trim(),
        externalReference: guideNumber.trim(),
        date: documentDate,
        dueDate: documentDate,
        typeCode: type === 'entrada' ? 'STOCK_ENTRY_GUIDE' : 'STOCK_EXIT_GUIDE',
        typeName: type === 'entrada' ? 'Guia de Entrada de Stock' : 'Guia de Saída de Stock',
        partyType: 'SUPPLIER',
        partyId: type === 'entrada' ? supplierId : '',
        partyName: type === 'entrada' ? (suppliers.find((supplier) => supplier.id === supplierId)?.name || 'Sem fornecedor') : 'Saida interna de stock',
        status: 'CONFIRMED', netTotal: totalCost, taxTotal: 0, grandTotal: totalCost, paidAmount: 0,
        outstandingAmount: type === 'entrada' && supplierId ? totalCost : 0,
        notes, warehouseId, stockGuideItems,
      };
      setLastSavedGuide(printable);

      setGuideItems([]);
      setArticleId('');
      setResolvedArticle(null);
      setQuantityStr('');
      setUnitCostStr('');
      setPriceWithIvaStr('');
      setGuideNumber('');
      setSupplierId('');
      setNotes('');
      setEditingGuideId(null);
      // A confirmed movement must be visible immediately, independently of
      // filters or of the page where the operator was consulting the history.
      setDateFrom('');
      setDateTo('');
      setTypeFilter('ALL');
      setSearchQuery('');
      setMovementsPage(1);
      setHistoryRefreshKey((value) => value + 1);
      setSuccess(`Guia ${printable.displayNumber} com ${currentGuideItems.length} artigo(s) gravada. O movimento já aparece no histórico abaixo.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao registar movimento de stock.');
    } finally {
      setSaving(false);
    }
  };

  // Global Keyboard shortcut F2 to submit guide
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        void submitGuide();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [guideItems, articleId, quantityStr, unitCostStr, priceWithIvaStr, guideNumber, documentDate, supplierId, notes, type, warehouseId, saving, editingGuideId]);

  const openGuideForEdit = (document: DocumentRecord) => {
    setEditingGuideId(document.id);
    setType(document.typeCode === 'STOCK_ENTRY_GUIDE' ? 'entrada' : 'saida');
    setGuideNumber(document.externalReference || document.displayNumber);
    setDocumentDate(document.date.slice(0, 10));
    setWarehouseId(document.warehouseId || warehouses[0]?.id || '');
    setSupplierId(document.typeCode === 'STOCK_ENTRY_GUIDE' ? document.partyId || '' : '');
    setNotes(document.notes || '');
    setGuideItems((document.stockGuideItems || []).map((item) => ({
      ...item,
      currentStock: articles.find((article) => article.id === item.articleId)?.stock ?? item.currentStock,
    })));
    setError('');
    setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearGuideForm = () => {
    setEditingGuideId(null);
    setGuideItems([]);
    setArticleId('');
    setResolvedArticle(null);
    setQuantityStr('');
    setUnitCostStr('');
    setPriceWithIvaStr('');
    setGuideNumber('');
    setSupplierId('');
    setNotes('');
    setDocumentDate(new Date().toISOString().slice(0, 10));
    setError('');
  };

  const confirmGuideCancellation = async () => {
    if (!cancellingGuide || isCancelling) return;
    if (!cancelReason.trim()) {
      setError('Indique o motivo da anulação da guia.');
      return;
    }
    setIsCancelling(true);
    try {
      await onCancelGuide(cancellingGuide.id, cancelReason.trim());
      if (editingGuideId === cancellingGuide.id) clearGuideForm();
      setSuccess(`Guia ${cancellingGuide.externalReference || cancellingGuide.displayNumber} anulada e stock revertido.`);
      setCancellingGuide(null);
      setCancelReason('');
      setHistoryRefreshKey((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao anular a guia.');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-[#1f2325] print:hidden">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white">Movimentar stock</h1>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Escolha o que pretende fazer. O Movax apresenta apenas os campos necessários para essa operação.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:min-w-[560px]">
            {canPostEntry && (
              <button
                type="button"
                onClick={() => { setWorkspaceMode('direct'); setType('entrada'); setError(''); setSuccess(''); }}
                className={`rounded-lg border px-4 py-3 text-left transition ${workspaceMode === 'direct' && type === 'entrada'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-200'
                  : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/50 dark:border-slate-700 dark:bg-[#282c2e]'}`}
              >
                <span className="block text-xs font-black uppercase">Entrada</span>
                <span className="mt-1 block text-[11px] opacity-70">Receber mercadoria ou corrigir stock</span>
              </button>
            )}
            {canPostExit && (
              <button
                type="button"
                onClick={() => { setWorkspaceMode('direct'); setType('saida'); setError(''); setSuccess(''); }}
                className={`rounded-lg border px-4 py-3 text-left transition ${workspaceMode === 'direct' && type === 'saida'
                  ? 'border-rose-600 bg-rose-50 text-rose-900 ring-2 ring-rose-100 dark:bg-rose-950/30 dark:text-rose-200'
                  : 'border-slate-200 bg-white hover:border-rose-300 hover:bg-rose-50/50 dark:border-slate-700 dark:bg-[#282c2e]'}`}
              >
                <span className="block text-xs font-black uppercase">Saída</span>
                <span className="mt-1 block text-[11px] opacity-70">Consumo, quebra ou saída autorizada</span>
              </button>
            )}
            {canTransfer && (
              <button
                type="button"
                onClick={() => { setWorkspaceMode('transfer'); setTransferError(''); setTransferSuccess(''); }}
                disabled={warehouses.length < 2}
                className={`rounded-lg border px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${workspaceMode === 'transfer'
                  ? 'border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-100 dark:bg-blue-950/30 dark:text-blue-200'
                  : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50 dark:border-slate-700 dark:bg-[#282c2e]'}`}
              >
                <span className="block text-xs font-black uppercase">Transferência</span>
                <span className="mt-1 block text-[11px] opacity-70">Mover stock entre armazéns</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {workspaceMode === 'direct' && (canPostEntry || canPostExit) && (
        <section className="rounded-lg border border-[#c3c6d1] bg-white p-4 shadow-sm dark:border-[#43474f] dark:bg-[#1f2325] sm:p-5 space-y-4 print:hidden">
          <div className="flex flex-wrap items-center justify-between border-b pb-2 border-[#c3c6d1] dark:border-[#43474f] gap-2">
            <h2 className="text-sm font-black text-primary dark:text-blue-200 uppercase flex items-center gap-2">
              {type === 'entrada' ? 'Entrada de stock' : 'Saída de stock'}
            </h2>
            <div className="flex items-center space-x-3">
              <span className="rounded bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-300">
                Artigos carregados: <b>{articles.length}</b>
              </span>
              <span className="text-xs font-bold text-slate-500">
                Linhas preparadas: <b className="text-primary font-mono text-sm">{guideItems.length}</b>
              </span>
            </div>
          </div>

          {/* Header Controls (Operação, Nº da Guia, Observações, Operador) */}
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-6">
            <label className="font-bold text-xs uppercase text-[#737780]">
              Operação
              <select
                value={type}
                onChange={(event) => {
                  const nextType = event.target.value as 'entrada' | 'saida';
                  setType(nextType);
                  if (nextType === 'saida') setSupplierId('');
                  setUnitCostStr('');
                  setPriceWithIvaStr('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    guideNumberRef.current?.focus();
                    guideNumberRef.current?.select();
                  }
                }}
                className="mt-1 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-2 dark:bg-[#282c2e] font-bold"
              >
                {canPostEntry && <option value="entrada">Entrada direta por Guia</option>}
                {canPostExit && <option value="saida">Saída direta por Guia</option>}
              </select>
            </label>

            <label className="font-bold text-xs uppercase text-[#737780]">
              Número da Guia
              <input
                ref={guideNumberRef}
                type="text"
                value={guideNumber}
                onChange={(event) => setGuideNumber(event.target.value)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    notesRef.current?.focus();
                    notesRef.current?.select();
                  }
                }}
                placeholder="Ex: GUIA-2026/001"
                className="mt-1 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-2 font-mono uppercase dark:bg-[#282c2e]"
              />
            </label>

            <label className="font-bold text-xs uppercase text-[#737780]">
              Data da Guia
              <input
                type="date"
                value={documentDate}
                onChange={(event) => setDocumentDate(event.target.value)}
                className="mt-1 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-2 font-mono dark:bg-[#282c2e]"
              />
            </label>

            {type === 'entrada' && (
              <label className="font-bold text-xs uppercase text-[#737780] lg:col-span-2">
                Fornecedor (opcional)
                <select
                  value={supplierId}
                  onChange={(event) => setSupplierId(event.target.value)}
                  className="mt-1 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-2 dark:bg-[#282c2e] font-bold"
                >
                  <option value="">-- Sem fornecedor --</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {warehouses.length > 1 && (
              <label className="font-bold text-xs uppercase text-[#737780]">
                Armazem
                <select
                  value={warehouseId}
                  onChange={(event) => setWarehouseId(event.target.value)}
                  className="mt-1 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-2 dark:bg-[#282c2e] font-bold"
                >
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="font-bold text-xs uppercase text-[#737780]">
              Operador
              <input readOnly value={operatorName} className="mt-1 w-full rounded border bg-slate-100 dark:bg-slate-800 p-2 font-medium" />
            </label>

            <label className="font-bold text-xs uppercase text-[#737780]">
              Observações
              <input
                ref={notesRef}
                maxLength={500}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const searchInput = document.querySelector<HTMLInputElement>('input[placeholder*="Código do Artigo"]');
                    if (searchInput) {
                      searchInput.focus();
                      searchInput.select?.();
                    }
                  }
                }}
                placeholder="Notas da guia..."
                className="mt-1 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-2 dark:bg-[#282c2e]"
              />
            </label>
          </div>

          {/* Item entry input row - Fast Enter key navigation */}
          <div className="bg-[#0000aa]/5 dark:bg-[#282c2e] p-3 rounded-lg border border-[#c3c6d1] dark:border-[#43474f] space-y-2">
            <span className="text-[11px] font-bold uppercase text-[#003366] dark:text-[#a7c8ff] block">
              Adicionar artigo · use Enter para avançar rapidamente
            </span>

            <div className="grid items-end gap-2 grid-cols-1 sm:grid-cols-12">
              <label className={`font-bold text-xs uppercase text-[#737780] ${type === 'entrada' ? 'sm:col-span-4' : 'sm:col-span-8'}`}>
                Código do Artigo (Pesquisa por Código)
                <ArticleSearchSelect
                  articles={articles}
                  selectedArticleId={articleId}
                  onSelect={handleSelectArticle}
                  loadOptions={directArticleLoader}
                  onResolveArticle={setResolvedArticle}
                  onAfterSelect={handleAfterArticleSelect}
                  searchByCodeOnly={true}
                  placeholder="Código ou código de barras…"
                  className="mt-1"
                />
              </label>

              <label className="font-bold text-xs uppercase text-[#737780] sm:col-span-2">
                Quantidade
                <input
                  ref={qtyInputRef}
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={quantityStr}
                  onChange={(event) => setQuantityStr(event.target.value)}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (type === 'entrada' && costInputRef.current) {
                        costInputRef.current.focus();
                        costInputRef.current.select();
                      } else {
                        addItemToGuide();
                      }
                    }
                  }}
                  placeholder="Ex: 10"
                  className="mt-1 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-2 text-right font-bold bg-yellow-100 dark:bg-[#1f2325] text-black dark:text-white"
                />
              </label>

              {type === 'entrada' && (
                <>
                  <label className="font-bold text-xs uppercase text-[#737780] sm:col-span-2">
                    Custo unit. (opcional)
                    <input
                      ref={costInputRef}
                      type="number"
                      min="0"
                      step="0.01"
                      value={unitCostStr}
                      onChange={(event) => setUnitCostStr(event.target.value)}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          priceInputRef.current?.focus();
                          priceInputRef.current?.select();
                        }
                      }}
                      placeholder="Ex: 5000"
                      className="mt-1 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-2 text-right font-mono text-emerald-700 font-bold dark:bg-[#282c2e]"
                    />
                  </label>

              <label className="font-bold text-xs uppercase text-[#737780] sm:col-span-2">
                Preço c/ IVA (MZN)
                <input
                  ref={priceInputRef}
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceWithIvaStr}
                  onChange={(event) => setPriceWithIvaStr(event.target.value)}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addItemToGuide();
                    }
                  }}
                  placeholder="Opcional"
                  className="mt-1 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-2 text-right font-mono text-blue-600 font-bold dark:bg-[#282c2e]"
                />
              </label>
                </>
              )}

              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={addItemToGuide}
                  disabled={guideItems.length >= 99}
                  className="w-full rounded bg-[#003366] py-2 text-xs font-bold uppercase text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  + Adicionar
                </button>
              </div>
            </div>

            {article && (
              <div className="text-xs font-mono flex items-center gap-4 text-slate-600 dark:text-slate-300 pt-1">
                <span>Stock atual: <b>{article.stock}</b></span>
                <span>
                  Stock previsto após {type}:{' '}
                  <b className={expectedStock < 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
                    {expectedStock}
                  </b>
                </span>
                {type === 'saida' && expectedStock < 0 && canAllowNegative && (
                  <span className="font-bold text-red-600">Saída autorizada com stock negativo.</span>
                )}
              </div>
            )}
          </div>

          {/* Active Guide Items Table (up to 99 items) */}
          <div className="border border-[#c3c6d1] dark:border-[#43474f] rounded-lg overflow-hidden">
            <div className="bg-[#f3f4f5] dark:bg-[#282c2e] px-3 py-2 text-xs font-bold uppercase flex justify-between items-center border-b border-[#c3c6d1] dark:border-[#43474f]">
              <span>Artigos preparados ({guideItems.length})</span>
              {guideItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setGuideItems([])}
                  className="text-red-600 hover:underline text-[11px] font-bold"
                >
                  Limpar Guia
                </button>
              )}
            </div>

            <table className="w-full text-xs font-mono border-collapse">
              <thead className="bg-[#e7e8e9] dark:bg-slate-800 text-[11px] uppercase font-bold text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="p-2 text-center w-10">#</th>
                  <th className="p-2 text-left">Código Artigo</th>
                  <th className="p-2 text-left">Descrição Artigo</th>
                  <th className="p-2 text-right">Qtd.</th>
                  <th className="p-2 text-right">Stock Atual</th>
                  <th className="p-2 text-right">Stock Previsto</th>
                  {type === 'entrada' && <th className="p-2 text-right">Custo Unit.</th>}
                  {type === 'entrada' && <th className="p-2 text-right">Preco venda c/ IVA</th>}
                  <th className="p-2 text-center w-16">Acção</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
                {guideItems.map((item, index) => {
                  const nextStock = projectedStockFor(item);
                  return (
                    <tr key={`${item.articleId}-${index}`} className="hover:bg-slate-50 dark:hover:bg-[#282c2e]">
                      <td className="p-2 text-center font-bold text-slate-400">{index + 1}</td>
                      <td className="p-2 font-bold text-[#003366] dark:text-[#a7c8ff]">{item.articleCode}</td>
                      <td className="p-2 font-sans font-medium">{item.articleDescription}</td>
                      <td className="p-2 text-right font-bold text-emerald-700 dark:text-emerald-400">{item.quantity}</td>
                      <td className="p-2 text-right">{item.currentStock}</td>
                      <td className={`p-2 text-right font-bold ${nextStock < 0 ? 'text-red-600' : ''}`}>{nextStock}</td>
                      {type === 'entrada' && <td className="p-2 text-right">{item.unitCost != null ? formatMZN(item.unitCost) : '—'}</td>}
                      {type === 'entrada' && <td className="p-2 text-right">{item.salePriceWithIva != null ? formatMZN(item.salePriceWithIva) : '—'}</td>}
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeItemFromGuide(index)}
                          className="text-red-600 hover:text-red-800 font-bold text-xs"
                          title="Remover artigo da guia"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {guideItems.length === 0 && (
                  <tr>
                    <td colSpan={type === 'entrada' ? 9 : 7} className="p-6 text-center text-slate-400 font-sans italic text-xs">
                      Nenhum artigo adicionado. Pesquise por código e indique a quantidade acima.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {error && <p role="alert" className="rounded bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}
          {success && (
            <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded bg-green-50 p-3 text-xs font-bold text-green-800">
              <span>{success}</span>
              {lastSavedGuide && onOpenDocument && (
                <button
                  type="button"
                  onClick={() => onOpenDocument(lastSavedGuide)}
                  className="rounded bg-[#003366] px-3 py-1.5 text-[11px] font-black uppercase text-white hover:brightness-110"
                >
                  Imprimir guia
                </button>
              )}
            </div>
          )}

          {/* Bottom Confirmation Section */}
          <div className="flex justify-between items-center pt-2 border-t border-[#c3c6d1] dark:border-[#43474f]">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
              {type === 'entrada' && supplierId && supplierCreditTotal > 0
                ? `${guideItems.length} artigo(s). Credito ao fornecedor: ${formatMZN(supplierCreditTotal)}.`
                : guideItems.length > 0 ? `${guideItems.length} artigo(s) prontos para gravar na guia.` : 'Preencha a guia acima.'}
            </span>
            <button
              type="button"
              disabled={saving || (guideItems.length === 0 && (!quantityStr || Number(quantityStr) <= 0))}
              onClick={() => void submitGuide()}
              className="rounded bg-[#006e25] px-6 py-2.5 text-xs font-black uppercase text-white disabled:opacity-50 hover:brightness-110 shadow-md"
            >
              {saving ? 'A gravar…' : `Confirmar ${type === 'entrada' ? 'entrada' : 'saída'} (F2)`}
            </button>
          </div>
        </section>
      )}

      {workspaceMode === 'transfer' && canTransfer && (
        <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-[#1f2325] sm:p-5 print:hidden">
          <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 dark:border-slate-700 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">Transferir entre armazéns</h2>
              <p className="mt-1 max-w-3xl text-xs text-slate-500 dark:text-slate-400">
                O stock sai da origem quando a transferência é enviada. Só entra no destino depois da confirmação de recepção.
              </p>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-bold">
              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">1. Preparar</span>
              <span className="text-slate-300">→</span>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">2. Em trânsito</span>
              <span className="text-slate-300">→</span>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">3. Recebida</span>
            </div>
          </div>

          {warehouses.length < 2 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              Para transferir stock são necessários pelo menos dois armazéns activos e acesso autorizado a ambos.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 xl:col-span-2">
                  De onde sai
                  <select
                    value={transferFromWarehouseId}
                    onChange={(event) => setTransferFromWarehouseId(event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm font-bold dark:border-slate-600 dark:bg-[#282c2e]"
                  >
                    {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                  </select>
                </label>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 xl:col-span-2">
                  Para onde vai
                  <select
                    value={transferToWarehouseId}
                    onChange={(event) => setTransferToWarehouseId(event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm font-bold dark:border-slate-600 dark:bg-[#282c2e]"
                  >
                    {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                  </select>
                </label>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Data
                  <input
                    type="date"
                    value={documentDate}
                    onChange={(event) => setDocumentDate(event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm dark:border-slate-600 dark:bg-[#282c2e]"
                  />
                </label>
              </div>

              {transferFromWarehouseId === transferToWarehouseId && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 dark:bg-red-950/30 dark:text-red-200">
                  A origem e o destino não podem ser o mesmo armazém.
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-[#282c2e]">
                <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-12">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 md:col-span-7">
                    Artigo
                    <ArticleSearchSelect
                      articles={articles}
                      selectedArticleId={transferArticleId}
                      onSelect={setTransferArticleId}
                      loadOptions={transferArticleLoader}
                      onResolveArticle={setResolvedTransferArticle}
                      placeholder="Código, descrição ou marca…"
                      className="mt-1.5"
                    />
                  </label>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 md:col-span-3">
                    Quantidade
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={transferQuantityStr}
                      onChange={(event) => setTransferQuantityStr(event.target.value)}
                      onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTransferItem(); } }}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-right text-sm font-black dark:border-slate-600 dark:bg-[#1f2325]"
                      placeholder="0"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={addTransferItem}
                    className="rounded-lg bg-slate-800 px-4 py-2.5 text-xs font-black uppercase text-white hover:bg-slate-700 md:col-span-2"
                  >
                    Adicionar
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="movax-table w-full min-w-[760px]">
                  <thead>
                    <tr>
                      <th className="text-left">Código</th>
                      <th className="text-left">Artigo</th>
                      <th className="text-right">Stock actual</th>
                      <th className="text-right">Transferir</th>
                      <th className="text-right">Fica na origem</th>
                      <th className="w-16 text-center">Acção</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transferItems.map((item, index) => (
                      <tr key={item.articleId}>
                        <td className="font-mono font-bold">{item.articleCode}</td>
                        <td className="font-semibold">{item.articleDescription}</td>
                        <td className="text-right tabular-nums">{item.currentStock}</td>
                        <td className="text-right font-black tabular-nums">{item.quantity}</td>
                        <td className={`text-right font-black tabular-nums ${item.currentStock - item.quantity < 0 ? 'text-red-600' : ''}`}>
                          {(item.currentStock - item.quantity).toFixed(3)}
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            onClick={() => setTransferItems((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                            className="rounded px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30"
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    ))}
                    {transferItems.length === 0 && (
                      <tr><td colSpan={6} className="py-8 text-center text-sm text-slate-400">Adicione os artigos que pretende enviar.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Observações
                  <input
                    value={transferNotes}
                    onChange={(event) => setTransferNotes(event.target.value)}
                    maxLength={500}
                    placeholder="Ex.: reposição de stock da loja da Matola"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm dark:border-slate-600 dark:bg-[#282c2e]"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void sendTransfer()}
                  disabled={transferLoading || transferItems.length === 0 || transferFromWarehouseId === transferToWarehouseId}
                  className="rounded-lg bg-blue-700 px-6 py-3 text-xs font-black uppercase text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {transferLoading ? 'A processar…' : 'Enviar transferência'}
                </button>
              </div>
            </>
          )}

          {transferError && <div role="alert" className="rounded-lg bg-red-50 p-3 text-xs font-bold text-red-700 dark:bg-red-950/30 dark:text-red-200">{transferError}</div>}
          {transferSuccess && <div role="status" className="rounded-lg bg-emerald-50 p-3 text-xs font-bold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">{transferSuccess}</div>}

          <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">Transferências recentes</h3>
                <p className="text-[11px] text-slate-500">A recepção deve ser confirmada no armazém de destino.</p>
              </div>
              <button type="button" onClick={() => setTransferRefreshKey((value) => value + 1)} className="rounded-lg border border-slate-300 px-3 py-2 text-[11px] font-bold hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-[#282c2e]">
                Actualizar
              </button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="movax-table w-full min-w-[900px]">
                <thead>
                  <tr>
                    <th className="text-left">Transferência</th>
                    <th className="text-left">Data</th>
                    <th className="text-left">Origem → Destino</th>
                    <th className="text-right">Itens</th>
                    <th className="text-left">Estado</th>
                    <th className="text-right">Acções</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((transfer) => {
                    const statusLabel = transfer.status === 'PENDING' ? 'Preparada' : transfer.status === 'IN_TRANSIT' ? 'Em trânsito' : transfer.status === 'RECEIVED' ? 'Recebida' : 'Cancelada';
                    const statusClass = transfer.status === 'PENDING' ? 'bg-slate-100 text-slate-700' : transfer.status === 'IN_TRANSIT' ? 'bg-amber-100 text-amber-800' : transfer.status === 'RECEIVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800';
                    return (
                      <tr key={transfer.id}>
                        <td className="font-mono font-black text-blue-800 dark:text-blue-300">{transfer.transferNumber}</td>
                        <td>{transfer.transferDate}</td>
                        <td className="font-semibold">{transfer.fromWarehouseName} <span className="text-slate-400">→</span> {transfer.toWarehouseName}</td>
                        <td className="text-right font-bold tabular-nums">{transfer.lines.length}</td>
                        <td><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${statusClass}`}>{statusLabel}</span></td>
                        <td>
                          <div className="flex justify-end gap-1.5">
                            {transfer.status === 'PENDING' && (
                              <button type="button" onClick={() => void dispatchExistingTransfer(transfer)} disabled={transferLoading} className="rounded bg-blue-700 px-2.5 py-1.5 text-[10px] font-black uppercase text-white disabled:opacity-50">Enviar</button>
                            )}
                            {transfer.status === 'IN_TRANSIT' && (
                              <button type="button" onClick={() => void receiveTransfer(transfer)} disabled={transferLoading} className="rounded bg-emerald-700 px-2.5 py-1.5 text-[10px] font-black uppercase text-white disabled:opacity-50">Confirmar recepção</button>
                            )}
                            {(transfer.status === 'PENDING' || transfer.status === 'IN_TRANSIT') && (
                              <button type="button" onClick={() => void voidTransfer(transfer)} disabled={transferLoading} className="rounded border border-red-300 px-2.5 py-1.5 text-[10px] font-black uppercase text-red-700 disabled:opacity-50">Cancelar</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!transferLoading && transfers.length === 0 && (
                    <tr><td colSpan={6} className="py-8 text-center text-sm text-slate-400">Ainda não existem transferências.</td></tr>
                  )}
                  {transferLoading && transfers.length === 0 && (
                    <tr><td colSpan={6} className="py-8 text-center text-sm text-slate-400">A carregar transferências…</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {workspaceMode === 'direct' && (
      <section className="overflow-hidden rounded-lg border border-[#c3c6d1] bg-white shadow-sm dark:border-[#43474f] dark:bg-[#1f2325] print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#c3c6d1] bg-slate-100 px-4 py-3 dark:border-[#43474f] dark:bg-slate-800">
          <h2 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200">
            Guias de Entrada / Saida de Stock ({stockGuideDocuments.length})
          </h2>
          {lastSavedGuide && onOpenDocument && (
            <button
              type="button"
              onClick={() => onOpenDocument(lastSavedGuide)}
              className="rounded bg-[#003366] px-3 py-1.5 text-xs font-extrabold uppercase text-white hover:brightness-110"
            >
              Imprimir ultima guia
            </button>
          )}
        </div>

        {stockGuideDocuments.length === 0 ? (
          <div className="p-6 text-center text-xs font-bold text-slate-500">
            Nenhuma guia de entrada ou saida registada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead className="border-b border-[#c3c6d1] bg-[#e7e8e9] text-[11px] font-bold uppercase text-slate-700 dark:border-[#43474f] dark:bg-[#282c2e] dark:text-slate-300">
                <tr>
                  <th className="p-3 text-left">Numero</th>
                  <th className="p-3 text-left">Data</th>
                  <th className="p-3 text-left">Tipo</th>
                  <th className="p-3 text-left">Fornecedor / Origem</th>
                  <th className="p-3 text-right">Itens</th>
                  <th className="p-3 text-right">Valor Fornecedor</th>
                  <th className="p-3 text-left">Estado</th>
                  <th className="p-3 text-center">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
                {stockGuideDocuments.slice(0, 50).map((document) => {
                  const isCancelled = document.status === 'CANCELLED' || document.status === 'REVERSED';
                  const isEntry = document.typeCode === 'STOCK_ENTRY_GUIDE';
                  const itemCount = document.stockGuideItems?.length ?? 0;
                  return (
                    <tr key={document.id} className="hover:bg-slate-50 dark:hover:bg-[#282c2e]">
                      <td className="p-3 font-black text-[#003366] dark:text-[#a7c8ff]">{document.externalReference || document.displayNumber}</td>
                      <td className="p-3">{document.date}</td>
                      <td className="p-3">
                        <span className={`rounded px-2 py-0.5 text-[10px] font-extrabold uppercase ${isEntry ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-900'}`}>
                          {isEntry ? 'Entrada' : 'Saida'}
                        </span>
                      </td>
                      <td className="p-3 font-bold">{document.partyName || (isEntry ? 'Sem fornecedor' : 'Saida interna')}</td>
                      <td className="p-3 text-right font-bold">{itemCount}</td>
                      <td className="p-3 text-right font-bold">{formatMZN(document.grandTotal || 0)}</td>
                      <td className="p-3">
                        <span className={`rounded px-2 py-0.5 text-[10px] font-extrabold uppercase ${isCancelled ? 'bg-red-100 text-red-900' : 'bg-emerald-100 text-emerald-900'}`}>
                          {isCancelled ? 'Anulada' : 'Confirmada'}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1">
                          {onOpenDocument && (
                            <button
                              type="button"
                              onClick={() => onOpenDocument(document)}
                              className="rounded bg-[#003366] px-2 py-1 text-[11px] font-bold text-white hover:brightness-110"
                              title="Imprimir guia"
                            >
                              Imprimir
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openGuideForEdit(document)}
                            disabled={isCancelled}
                            className="rounded bg-orange-600 px-2 py-1 text-[11px] font-bold text-white hover:brightness-110 disabled:opacity-40"
                            title="Editar guia"
                          >
                            Editar
                          </button>
                          {canCancelGuide && (
                            <button
                              type="button"
                              onClick={() => {
                                setCancellingGuide(document);
                                setCancelReason('');
                                setError('');
                              }}
                              disabled={isCancelled}
                              className="rounded bg-red-700 px-2 py-1 text-[11px] font-bold text-white hover:brightness-110 disabled:opacity-40"
                              title="Anular guia e reverter stock"
                            >
                              Anular
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      )}

      {/* History of stock movements */}
      <section className={`overflow-hidden rounded-lg border bg-white shadow-sm dark:bg-[#1f2325] ${
        isFullScreen ? 'fixed inset-0 z-50 rounded-none border-none p-6 overflow-auto bg-white dark:bg-[#1f2325]' : ''
      }`}>
        <div className="flex flex-wrap items-center justify-between border-b bg-slate-100 px-4 py-3 dark:bg-slate-800 gap-2">
          <div className="flex items-center space-x-3">
            <h2 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200">
              Histórico de Movimentos de Stock ({historyTotalCount})
            </h2>
            <span className="rounded bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-300">
              Stock Disponível Total: <b>{historyTotalStock} UN</b>
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={exportMovementsToCSV}
              className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold flex items-center space-x-1 uppercase transition-colors"
              title="Descarregar a página atual do histórico em formato Excel/CSV"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              <span>Baixar Excel</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="px-3 py-1.5 rounded bg-[#003366] hover:bg-[#002244] text-white text-xs font-extrabold flex items-center space-x-1 uppercase transition-colors"
              title={isFullScreen ? 'Sair do modo Ecrã Inteiro' : 'Expandir tabela para Ecrã Inteiro'}
            >
              <span className="material-symbols-outlined text-sm">
                {isFullScreen ? 'fullscreen_exit' : 'fullscreen'}
              </span>
              <span>{isFullScreen ? 'Sair Ecrã Inteiro' : 'Ecrã Inteiro'}</span>
            </button>
          </div>
        </div>

        {/* Date & Search Filter Bar */}
        <div className="p-3 bg-slate-50 dark:bg-[#282c2e] border-b flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-1">
              <label className="font-bold text-slate-600 dark:text-slate-300 uppercase text-[11px]">De:</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="p-1 border rounded text-xs font-mono dark:bg-[#1f2325]"
              />
            </div>

            <div className="flex items-center space-x-1">
              <label className="font-bold text-slate-600 dark:text-slate-300 uppercase text-[11px]">Até:</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="p-1 border rounded text-xs font-mono dark:bg-[#1f2325]"
              />
            </div>

            <div className="flex items-center space-x-1">
              <label className="font-bold text-slate-600 dark:text-slate-300 uppercase text-[11px]">Tipo:</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="p-1 border rounded text-xs font-bold dark:bg-[#1f2325]"
              >
                <option value="ALL">Todos os Tipos</option>
                <option value="entrada">Entradas</option>
                <option value="saida">Saídas</option>
              </select>
            </div>

            <div className="flex items-center space-x-1">
              <label className="font-bold text-slate-600 dark:text-slate-300 uppercase text-[11px]">Pesquisar:</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Código, descrição ou guia..."
                className="p-1.5 border rounded text-xs w-64 dark:bg-[#1f2325]"
              />
            </div>

            {(dateFrom || dateTo || typeFilter !== 'ALL' || searchQuery) && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-red-600 hover:underline font-bold text-xs"
              >
                Limpar Filtros
              </button>
            )}
          </div>

          <div className="text-[#737780] font-mono text-[11px]">
            Mostrando <b>{historyMovements.length}</b> de <b>{historyTotalCount}</b> registos
          </div>
        </div>

        {/* Movements Table */}
        {historyError ? (
          <div className="p-8 text-center text-red-600 font-sans text-xs font-bold">{historyError}</div>
        ) : historyLoading && historyMovements.length === 0 ? (
          <div className="p-8 text-center text-slate-500 font-sans text-xs">A carregar histórico de movimentos…</div>
        ) : historyMovements.length === 0 ? (
          <div className="p-8 text-center text-slate-500 font-sans text-xs">
            Nenhum movimento de stock encontrado para os filtros seleccionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead className="bg-[#f3f4f5] dark:bg-[#282c2e] text-[11px] uppercase font-bold text-slate-700 dark:text-slate-300 border-b border-[#c3c6d1] dark:border-[#43474f]">
                <tr>
                  <th className="p-3 text-left">Data</th>
                  <th className="p-3 text-left">Tipo</th>
                  <th className="p-3 text-left">Documento / Guia</th>
                  <th className="p-3 text-left">Artigo (Código & Descrição)</th>
                  <th className="p-3 text-right text-emerald-700 dark:text-emerald-400">Entrada</th>
                  <th className="p-3 text-right text-red-600 dark:text-red-400">Saída</th>
                  <th className="p-3 text-right text-blue-700 dark:text-blue-400">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
                {historyMovements
                  .map((item) => {
                    const matchedArt = articles.find((a) => a.code === item.articleCode);
                    const matchedDoc = documents.find(
                      (d) => (d.id && d.id === item.sourceDocumentId) || (d.displayNumber && item.docRef && item.docRef.includes(d.displayNumber))
                    );
                    let docDisplay = item.docRef || (item.type === 'entrada' ? 'Entrada Directa por Guia' : 'Saída Directa por Guia');
                    if (docDisplay.includes('Migração Pos.zip') || docDisplay.includes('STK-')) {
                      docDisplay = item.type === 'entrada' ? 'Entrada Inicial (Migração POS)' : 'Saída Inicial (Migração POS)';
                    } else {
                      docDisplay = docDisplay
                        .replace(/CUSTOMER_INVOICE/g, 'Factura')
                        .replace(/CASH_SALE/g, 'Venda a Dinheiro')
                        .replace(/CUSTOMER_DELIVERY_NOTE/g, 'Guia de Remessa')
                        .replace(/SUPPLIER_INVOICE/g, 'Factura Fornecedor')
                        .replace(/CUSTOMER_RECEIPT/g, 'Recibo')
                        .replace(/CUSTOMER_CREDIT_NOTE/g, 'Nota de Crédito')
                        .replace(/CREDIT_NOTE/g, 'Nota de Crédito');
                    }
                    const saldo = item.balanceAfter ?? (matchedArt?.stock ?? 0);
                    
                    // Format date only (no time: 04/08/2026)
                    const formattedDate = new Date(item.date).toLocaleDateString('pt-PT', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    });

                    return (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        <td className="p-3 text-slate-600 dark:text-slate-400 font-bold">
                          {formattedDate}
                        </td>
                        <td className="p-3">
                          <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                            item.type === 'entrada'
                              ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
                              : 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-300 border border-red-300'
                          }`}>
                            {item.type}
                          </span>
                        </td>
                        <td className="p-3 font-semibold">
                          {matchedDoc && onOpenDocument ? (
                            <button
                              type="button"
                              onClick={() => onOpenDocument(matchedDoc)}
                              className="text-[#000080] dark:text-yellow-300 font-extrabold hover:underline flex items-center gap-1"
                              title="Clique para consultar este documento"
                            >
                              <span>🔗</span> {docDisplay}
                            </button>
                          ) : (
                            <span className="font-bold text-slate-800 dark:text-slate-200">{docDisplay}</span>
                          )}
                        </td>
                        <td className="p-3 font-bold">
                          {matchedArt ? (
                            <button
                              type="button"
                              onClick={() => setLedgerArticle(matchedArt)}
                              className="text-[#003366] dark:text-[#a7c8ff] hover:underline font-extrabold"
                              title="Clique para abrir o Extracto de Movimentos deste Artigo"
                            >
                              [{item.articleCode}] {item.articleDescription} 📊
                            </button>
                          ) : (
                            <span className="text-[#003366] dark:text-[#a7c8ff]">[{item.articleCode}] {item.articleDescription}</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-black text-sm text-emerald-700 dark:text-emerald-400">
                          {item.type === 'entrada' ? item.quantity : '—'}
                        </td>
                        <td className="p-3 text-right font-black text-sm text-red-600 dark:text-red-400">
                          {item.type === 'saida' ? item.quantity : '—'}
                        </td>
                        <td className="p-3 text-right font-black text-sm text-[#003366] dark:text-[#a7c8ff] bg-blue-50/50 dark:bg-blue-950/20">
                          {saldo}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>

            {/* Pagination Controls */}
            <Pagination
              currentPage={movementsPage}
              totalItems={historyTotalCount}
              pageSize={movementsPageSize}
              onPageChange={setMovementsPage}
              onPageSizeChange={setMovementsPageSize}
              pageSizeOptions={[15, 25, 50, 100]}
            />
          </div>
        )}
      </section>

      {cancellingGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 print:hidden">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-2xl dark:bg-[#1f2325]">
            <div className="mb-3 flex items-center justify-between border-b border-[#c3c6d1] pb-2 dark:border-[#43474f]">
              <h3 className="text-sm font-black uppercase text-[#003366] dark:text-[#a7c8ff]">Anular guia de stock</h3>
              <button
                type="button"
                onClick={() => setCancellingGuide(null)}
                className="text-xl font-black text-slate-500 hover:text-red-700"
              >
                x
              </button>
            </div>
            <p className="mb-3 text-xs font-bold text-slate-700 dark:text-slate-200">
              A guia {cancellingGuide.externalReference || cancellingGuide.displayNumber} sera anulada e o movimento de stock sera revertido.
            </p>
            <label className="text-xs font-bold uppercase text-[#737780]">
              Motivo da anulacao
              <textarea
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                rows={3}
                className="mt-1 w-full rounded border border-[#c3c6d1] p-2 text-sm dark:border-[#43474f] dark:bg-[#282c2e]"
                placeholder="Ex: erro de lancamento, guia duplicada..."
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancellingGuide(null)}
                className="rounded border border-[#c3c6d1] px-4 py-2 text-xs font-bold uppercase dark:border-[#43474f]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmGuideCancellation()}
                disabled={isCancelling}
                className="rounded bg-red-700 px-4 py-2 text-xs font-black uppercase text-white disabled:opacity-50"
              >
                {isCancelling ? 'A anular...' : 'Confirmar anulacao'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extracto Modal */}
      <ArticleLedgerModal
        isOpen={Boolean(ledgerArticle)}
        onClose={() => setLedgerArticle(null)}
        article={ledgerArticle}
        articles={articles}
        movements={movements}
        documents={documents}
        onOpenDocument={onOpenDocument}
        canViewCost={canViewCost}
        onSelectArticleId={(id) => {
          const found = articles.find((a) => a.id === id);
          if (found) setLedgerArticle(found);
        }}
      />
    </div>
  );
};

export { StockMovements as StockMovementsPage };
export default StockMovements;
