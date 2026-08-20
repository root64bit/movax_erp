import { useState, useRef, useMemo, useCallback } from 'react';
import type { Article, DocumentRecord, StockGuideInput, Supplier, AccessScope } from '@/shared/types/domain.types';
import type { GuideLineItem, StockMovementType } from '../types/stock-transfer.types';

export interface UseDirectStockMovementProps {
  articles: Article[];
  suppliers: Supplier[];
  warehouses: AccessScope[];
  documents?: DocumentRecord[];
  initialDraft?: {
    guideNumber?: string;
    warehouseId?: string;
    items?: GuideLineItem[];
    documentDate?: string;
    type?: StockMovementType;
    supplierId?: string;
    notes?: string;
    editingGuideId?: string | null;
  };
  canPostEntry: boolean;
  canPostExit: boolean;
  canAllowNegative: boolean;
  onSaveGuide: (guide: StockGuideInput) => Promise<string>;
  onSuccessCallback?: () => void;
}

export function useDirectStockMovement({
  articles,
  suppliers,
  warehouses,
  documents = [],
  initialDraft,
  canPostEntry,
  canPostExit,
  canAllowNegative,
  onSaveGuide,
  onSuccessCallback,
}: UseDirectStockMovementProps) {
  const [type, setType] = useState<StockMovementType>(() => initialDraft?.type || (canPostEntry ? 'entrada' : 'saida'));
  const [warehouseId, setWarehouseId] = useState(() => initialDraft?.warehouseId || warehouses[0]?.id || '');
  const [articleId, setArticleId] = useState('');
  const [resolvedArticle, setResolvedArticle] = useState<Article | null>(null);
  const [quantityStr, setQuantityStr] = useState('');
  const [guideNumber, setGuideNumber] = useState(() => initialDraft?.guideNumber || '');
  const [documentDate, setDocumentDate] = useState(() => initialDraft?.documentDate || new Date().toISOString().slice(0, 10));
  const [supplierId, setSupplierId] = useState(() => initialDraft?.supplierId || '');
  const [unitCostStr, setUnitCostStr] = useState('');
  const [priceWithIvaStr, setPriceWithIvaStr] = useState('');
  const [notes, setNotes] = useState(() => initialDraft?.notes || '');
  
  const [guideItems, setGuideItems] = useState<GuideLineItem[]>(() => initialDraft?.items || []);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingGuideId, setEditingGuideId] = useState<string | null>(() => initialDraft?.editingGuideId || null);
  const [lastSavedGuide, setLastSavedGuide] = useState<DocumentRecord | null>(null);

  const guideNumberRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const costInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);

  const article = useMemo(
    () => resolvedArticle?.id === articleId ? resolvedArticle : articles.find((item) => item.id === articleId),
    [articles, articleId, resolvedArticle]
  );

  const stockGuideDocuments = useMemo(() => documents
    .filter((document) => document.typeCode === 'STOCK_ENTRY_GUIDE' || document.typeCode === 'STOCK_EXIT_GUIDE')
    .sort((left, right) => {
      const dateDifference = new Date(right.date).getTime() - new Date(left.date).getTime();
      return dateDifference || (right.createdAt || '').localeCompare(left.createdAt || '');
    }), [documents]);

  const editingDocument = useMemo(
    () => stockGuideDocuments.find((document) => document.id === editingGuideId),
    [stockGuideDocuments, editingGuideId]
  );

  const handleSelectArticle = useCallback((id: string) => {
    setArticleId(id);
    setUnitCostStr('');
    setPriceWithIvaStr('');
  }, []);

  const handleAfterArticleSelect = useCallback(() => {
    setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 40);
  }, []);

  const addItemToGuide = useCallback(() => {
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
  }, [guideItems.length, article, quantityStr, unitCostStr, priceWithIvaStr, type, canAllowNegative]);

  const removeItemFromGuide = useCallback((index: number) => {
    setGuideItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearGuideForm = useCallback(() => {
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
  }, []);

  const openGuideForEdit = useCallback((document: DocumentRecord) => {
    setEditingGuideId(document.id);
    setType(document.typeCode === 'STOCK_ENTRY_GUIDE' ? 'entrada' : 'saida');
    setGuideNumber(document.externalReference || document.displayNumber);
    setDocumentDate(document.date.slice(0, 10));
    setWarehouseId(document.warehouseId || warehouses[0]?.id || '');
    setSupplierId(document.typeCode === 'STOCK_ENTRY_GUIDE' ? document.partyId || '' : '');
    setNotes(document.notes || '');
    setGuideItems((document.stockGuideItems || []).map((item) => ({
      ...item,
      currentStock: articles.find((art) => art.id === item.articleId)?.stock ?? item.currentStock,
    })));
    setError('');
    setSuccess('');
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [articles, warehouses]);

  const submitGuide = useCallback(async () => {
    let currentGuideItems = [...guideItems];

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

    if (savingRef.current) {
      return;
    }

    savingRef.current = true;
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
      clearGuideForm();
      onSuccessCallback?.();
      setSuccess(`Guia ${printable.displayNumber} com ${currentGuideItems.length} artigo(s) gravada. O movimento já aparece no histórico abaixo.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao registar movimento de stock.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [
    guideItems,
    article,
    quantityStr,
    unitCostStr,
    priceWithIvaStr,
    warehouseId,
    guideNumber,
    documentDate,
    type,
    canAllowNegative,
    editingGuideId,
    supplierId,
    suppliers,
    notes,
    onSaveGuide,
    clearGuideForm,
    onSuccessCallback,
  ]);

  return {
    type,
    setType,
    warehouseId,
    setWarehouseId,
    articleId,
    setArticleId,
    resolvedArticle,
    setResolvedArticle,
    quantityStr,
    setQuantityStr,
    guideNumber,
    setGuideNumber,
    documentDate,
    setDocumentDate,
    supplierId,
    setSupplierId,
    unitCostStr,
    setUnitCostStr,
    priceWithIvaStr,
    setPriceWithIvaStr,
    notes,
    setNotes,
    guideItems,
    setGuideItems,
    saving,
    savingRef,
    error,
    setError,
    success,
    setSuccess,
    editingGuideId,
    editingDocument,
    stockGuideDocuments,
    lastSavedGuide,
    setLastSavedGuide,
    article,
    guideNumberRef,
    notesRef,
    qtyInputRef,
    costInputRef,
    priceInputRef,
    handleSelectArticle,
    handleAfterArticleSelect,
    addItemToGuide,
    removeItemFromGuide,
    clearGuideForm,
    openGuideForEdit,
    submitGuide,
  };
}
