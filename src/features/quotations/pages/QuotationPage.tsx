import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Article, Client, DocumentRecord, SaleInvoice, SaleItem } from '@/shared/types/domain.types';
import { ArticleSearchSelect } from '@/features/inventory/components/ArticleSearchSelect';
import { Pagination } from '@/components/Pagination';
import { formatMZN } from '@/shared/utils/formatters';
import { calculateDocumentLine, calculateDocumentTotals, recalculateSaleItem, recalculateSaleItems } from '@/lib/documentCalculations';
import { InventoryService } from '@/features/inventory/services/inventory.service';

interface QuotationProps {
  articles: Article[];
  clients: Client[];
  sales?: SaleInvoice[];
  documents?: DocumentRecord[];
  onCreateQuotation: (quotation: SaleInvoice) => Promise<SaleInvoice>;
  onOpenPrintModal: (doc: SaleInvoice) => void;
  operatorName: string;
  warehouseId?: string;
  onUpdateDocument?: (documentId: string, payload: { documentDate?: string; clientName?: string; clientNuit?: string; clientAddress?: string; grandTotal?: number; notes?: string; items?: SaleItem[]; generalDiscount?: number; keepAsWalkIn?: boolean }) => Promise<void>;
}

export const Quotation: React.FC<QuotationProps> = ({
  articles,
  clients,
  sales = [],
  documents = [],
  onCreateQuotation,
  onOpenPrintModal,
  operatorName,
  warehouseId,
  onUpdateDocument,
}) => {
  const [docStatus, setDocStatus] = useState<'PREPARATION' | 'CONFIRMED' | 'READ_ONLY'>('PREPARATION');
  const [docNumber, setDocNumber] = useState('A atribuir ao emitir');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [validityDays, setValidityDays] = useState('15');

  // Client Selection
  const [clientCodeInput, setClientCodeInput] = useState('1');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedClientName, setSelectedClientName] = useState('Cliente Pontual');
  const [clientNuit, setClientNuit] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [keepAsWalkIn, setKeepAsWalkIn] = useState(false);

  // Item Entry State
  const [selectedArticleId, setSelectedArticleId] = useState('');
  const [catalogCache, setCatalogCache] = useState<Record<string, Article>>({});
  const findArticle = (id: string) => catalogCache[id] || articles.find((a) => a.id === id);
  const [customDescription, setCustomDescription] = useState('');
  const [inputQty, setInputQty] = useState(1);
  const [inputUnitPrice, setInputUnitPrice] = useState(0);
  const [inputDiscount, setInputDiscount] = useState(0);
  const [inputIva, setInputIva] = useState(16);

  // Items List
  const [items, setItems] = useState<SaleItem[]>([]);
  const [generalDiscount, setGeneralDiscount] = useState(0);
  const [notes, setNotes] = useState('');

  // Processing state & SessionCreatedQuotations
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [confirmedQuotationRecord, setConfirmedQuotationRecord] = useState<SaleInvoice | null>(null);
  const [sessionQuotations, setSessionQuotations] = useState<SaleInvoice[]>([]);

  // Edit Modal State for Quotations History
  const [editingQuotation, setEditingQuotation] = useState<{ id: string; docNumber: string } | null>(null);
  const [editDocumentDate, setEditDocumentDate] = useState('');
  const [editClientName, setEditClientName] = useState('');
  const [editClientNuit, setEditClientNuit] = useState('');
  const [editClientAddress, setEditClientAddress] = useState('');
  const [editGrandTotal, setEditGrandTotal] = useState(0);
  const [editNotes, setEditNotes] = useState('');
  const [editItems, setEditItems] = useState<SaleItem[]>([]);
  const [editGeneralDiscount, setEditGeneralDiscount] = useState(0);
  const [editKeepAsWalkIn, setEditKeepAsWalkIn] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  // Auto-sync editGrandTotal when editItems changes
  useEffect(() => {
    if (editingQuotation) {
      setEditGrandTotal(calculateDocumentTotals(editItems, editGeneralDiscount).grandTotal);
    }
  }, [editItems, editGeneralDiscount, editingQuotation]);

  const handleOpenEditQuotation = (doc: { id: string; docNumber: string; date: string; clientName: string; clientNuit?: string; clientAddress?: string; totalAmount?: number; descontoTotal?: number; generalDiscountAmount?: number; notes?: string; items?: SaleItem[] }) => {
    setEditingQuotation({ id: doc.id, docNumber: doc.docNumber });
    setEditDocumentDate((doc.date || new Date().toISOString()).slice(0, 10));
    setEditClientName(doc.clientName || '');
    setEditClientNuit(doc.clientNuit || '');
    setEditClientAddress(doc.clientAddress || '');
    setEditGrandTotal(doc.totalAmount || 0);
    setEditNotes(doc.notes || '');
    const lineDiscount = (doc.items || []).reduce((sum, item) => sum + (item.discountAmount || 0), 0);
    setEditGeneralDiscount(doc.generalDiscountAmount ?? Math.max(0, (doc.descontoTotal || 0) - lineDiscount));
    setEditKeepAsWalkIn(false);
    
    let loadedItems: SaleItem[] = doc.items && doc.items.length > 0 ? JSON.parse(JSON.stringify(doc.items)) : [];
    if (loadedItems.length === 0 && (doc.totalAmount || 0) > 0) {
      loadedItems = [{
        articleId: `custom-${Date.now()}`,
        code: 'DIV',
        description: 'Artigo / Serviço Geral',
        quantity: 1,
        unitPrice: doc.totalAmount || 0,
        discountPercent: 0,
        discountAmount: 0,
        ivaPercent: 16,
        total: doc.totalAmount || 0,
        lineType: 'MANUAL',
        stockEffectEnabled: false,
      }];
    }
    setEditItems(recalculateSaleItems(loadedItems));
    setEditError('');
  };

  const handleExecuteSaveEditQuotation = async () => {
    if (!editingQuotation || !onUpdateDocument || isSavingEdit) return;
    if (editItems.length === 0) {
      setEditError('A cotação deve manter pelo menos um artigo ou serviço.');
      return;
    }
    try {
      setIsSavingEdit(true);
      setEditError('');
      await onUpdateDocument(editingQuotation.id, {
        documentDate: editDocumentDate,
        clientName: editClientName.trim(),
        clientNuit: editClientNuit.trim(),
        clientAddress: editClientAddress.trim(),
        grandTotal: Number(editGrandTotal),
        notes: editNotes.trim(),
        items: recalculateSaleItems(editItems),
        generalDiscount: editGeneralDiscount,
        keepAsWalkIn: editKeepAsWalkIn,
      });
      setEditingQuotation(null);
    } catch (err: any) {
      setEditError(err?.message || 'Falha ao guardar alterações da cotação.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // History Table Filters & Pagination
  const [historyDateFilter, setHistoryDateFilter] = useState('');
  const [historyNameFilter, setHistoryNameFilter] = useState('');
  const [historyCodeFilter, setHistoryCodeFilter] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(15);

  // Refs for fast Enter key field navigation
  const validityInputRef = useRef<HTMLInputElement>(null);
  const clientCodeInputRef = useRef<HTMLInputElement>(null);
  const clientNameInputRef = useRef<HTMLInputElement>(null);
  const clientNuitInputRef = useRef<HTMLInputElement>(null);
  const clientAddressInputRef = useRef<HTMLInputElement>(null);
  const customDescriptionInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const unitPriceInputRef = useRef<HTMLInputElement>(null);
  const discountInputRef = useRef<HTMLInputElement>(null);

  // Initialize Client Code 1 (Cliente Pontual) on mount
  useEffect(() => {
    if (selectedClientId && selectedClientId !== 'client-pontual') return;
    if (selectedClientName.trim() && !['cliente pontual', 'cliente final'].includes(selectedClientName.trim().toLowerCase())) return;
    const pontual = clients.find(
      (c) => c.number === '1' || c.code === '1' || c.name.toLowerCase().includes('pontual')
    ) || clients[0];

    if (pontual) {
      setSelectedClientId(pontual.id);
      setSelectedClientName('Cliente Pontual');
      setClientCodeInput('1');
    } else {
      setSelectedClientId('client-pontual');
      setSelectedClientName('Cliente Pontual');
      setClientCodeInput('1');
    }
  }, [clients, selectedClientId, selectedClientName]);

  const lookupClientByCode = (query: string) => {
    const clean = query.trim().toLowerCase();
    if (!clean) {
      const hasDetails = selectedClientName.trim() !== ''
        && !['cliente pontual', 'cliente final'].includes(selectedClientName.trim().toLowerCase());
      if (!hasDetails && !clientNuit.trim() && !clientAddress.trim()) lookupClientByCode('1');
      return;
    }

    if (clean === '1' || clean === '01') {
      const pontualInDb = clients.find(
        (c) => c.number === '1' || c.code === '1' || c.name.toLowerCase().includes('pontual')
      ) || clients[0];

      setSelectedClientId(pontualInDb ? pontualInDb.id : 'client-pontual');
      setSelectedClientName('Cliente Pontual');
      setClientCodeInput('1');
      setClientNuit('');
      setClientAddress('');
      setKeepAsWalkIn(false);
      return;
    }

    const found = clients.find(
      (c) =>
        c.number !== '1' &&
        c.code !== '1' &&
        ((c.number && c.number.trim().toLowerCase() === clean) ||
          (c.code && c.code.trim().toLowerCase() === clean) ||
          c.id.toLowerCase() === clean ||
          String(c.number) === clean ||
          c.name.toLowerCase().includes(clean))
    );

    if (found) {
      setSelectedClientId(found.id);
      setSelectedClientName(found.name);
      setClientNuit(found.nuit || '');
      setClientAddress(found.address || '');
      setClientCodeInput(found.number || found.code || query);
      setKeepAsWalkIn(false);
    } else {
      setSelectedClientId('client-pontual');
      setSelectedClientName('Cliente Pontual');
      setClientNuit('');
      setClientAddress('');
    }
  };

  const articleSearchLoader = useMemo(
    () => (query: string) => InventoryService.searchProducts(query, warehouseId, 50),
    [warehouseId],
  );

  const getArticlePriceWithIva = (art: Article): number => {
    if (art.sellPriceWithIva && art.sellPriceWithIva > 0) {
      return art.sellPriceWithIva;
    }
    if (art.sellPrice && art.sellPrice > 0) {
      return Math.round(art.sellPrice * (1 + (art.taxRate ?? 16) / 100) * 100) / 100;
    }
    return 0;
  };

  const handleArticleSelect = (id: string) => {
    setSelectedArticleId(id);
    const art = findArticle(id);
    if (art) {
      setCustomDescription(art.description);
      setInputIva(art.taxRate ?? 16);
      setInputUnitPrice(getArticlePriceWithIva(art));
    }
  };

  const handleAfterArticleSelect = () => {
    setTimeout(() => {
      if (customDescriptionInputRef.current) {
        customDescriptionInputRef.current.focus();
        customDescriptionInputRef.current.select();
      } else if (qtyInputRef.current) {
        qtyInputRef.current.focus();
        qtyInputRef.current.select();
      }
    }, 40);
  };

  const handleAddItem = () => {
    if (docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY') return;

    const art = findArticle(selectedArticleId);
    const finalDesc = customDescription.trim() || art?.description || '';
    if (!finalDesc || inputQty <= 0) return;

    const priceWithIva = inputUnitPrice > 0 ? inputUnitPrice : (art ? getArticlePriceWithIva(art) : 0);
    const newItem = recalculateSaleItem({
      articleId: art?.id || `custom-${Date.now()}`,
      code: art?.code || 'DIV',
      description: finalDesc,
      quantity: inputQty,
      unitPrice: Math.round(priceWithIva * 100) / 100,
      discountPercent: 0,
      discountAmount: Math.max(0, inputDiscount),
      ivaPercent: inputIva,
      total: 0,
      lineType: art ? 'STOCK' : 'SERVICE',
      stockEffectEnabled: false,
    });

    setItems((current) => [...current, newItem]);
    setInputQty(1);
    setInputDiscount(0);
    setSelectedArticleId('');
    setCustomDescription('');
    setInputUnitPrice(0);

    setTimeout(() => {
      const searchInput = document.querySelector<HTMLInputElement>('input[placeholder*="Pesquisar catálogo"]');
      if (searchInput) {
        searchInput.focus();
      }
    }, 40);
  };

  const handleRemoveItem = (index: number) => {
    if (docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY') return;
    setItems((current) => current.filter((_, i) => i !== index));
  };

  const totals = calculateDocumentTotals(items, generalDiscount);
  const descontoGeralValor = totals.generalDiscount;
  const subtotalBruto = totals.grossTotal;
  const descontoLinhas = totals.lineDiscountTotal;
  const subtotalLiquido = totals.netTotal;
  const ivaTotal = totals.taxTotal;
  const totalFinalAmount = totals.grandTotal;

  const handleSaveQuotation = async (shouldPrint = false) => {
    if (docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY') {
      if (shouldPrint && confirmedQuotationRecord) {
        onOpenPrintModal(confirmedQuotationRecord);
      }
      return;
    }

    if (items.length === 0) {
      setSaveError('Adicione pelo menos um artigo para emitir a cotação.');
      return;
    }

    setSaving(true);
    setSaveError('');

    try {
      const quotation: SaleInvoice = {
        id: `cot-${Date.now()}`,
        clientId: selectedClientId,
        documentTypeCode: 'CUSTOMER_QUOTATION',
        docNumber: 'A atribuir ao emitir',
        date,
        clientName: selectedClientName,
        clientNuit,
        clientAddress,
        paymentMethod: 'CASH',
        sellerName: operatorName,
        items: totals.lines,
        subtotalBruto,
        descontoTotal: descontoLinhas + descontoGeralValor,
        subtotalLiquido,
        ivaTotal,
        totalAmount: totalFinalAmount,
        paidAmount: 0,
        pendingAmount: 0,
        status: 'Concluída',
        notes: notes ? `${notes} (Validade: ${validityDays} dias)` : `Proposta válida por ${validityDays} dias`,
        keepAsWalkIn,
      };

      const savedQuotation = await onCreateQuotation(quotation);
      setDocNumber(savedQuotation.docNumber || 'COT-CONFIRMADO');
      setConfirmedQuotationRecord(savedQuotation);
      setDocStatus('CONFIRMED');

      // Add to session list and reset history view to Page 1 immediately
      setSessionQuotations((prev) => [savedQuotation, ...prev]);
      setHistoryPage(1);
      setHistoryNameFilter('');
      setHistoryCodeFilter('');

      if (shouldPrint) {
        onOpenPrintModal(savedQuotation);
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Falha ao emitir cotação.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetForm = () => {
    setItems([]);
    setDocStatus('PREPARATION');
    setDocNumber('A atribuir ao emitir');
    setSaveError('');
    setConfirmedQuotationRecord(null);
    setGeneralDiscount(0);
    setKeepAsWalkIn(false);
    setNotes('');

    const pontualInDb = clients.find(
      (c) => c.number === '1' || c.code === '1' || c.name.toLowerCase().includes('pontual')
    ) || clients[0];

    setSelectedClientId(pontualInDb ? pontualInDb.id : 'client-pontual');
    setSelectedClientName('Cliente Pontual');
    setClientCodeInput('1');
    setClientNuit('');
    setClientAddress('');

    setTimeout(() => {
      document.querySelector<HTMLInputElement>('input[placeholder*="Ex: 1"]')?.focus();
    }, 50);
  };

  // Keyboard Shortcuts: F2 = Emitir, F5 = Novo, F9 = Imprimir
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        void handleSaveQuotation(false);
      } else if (e.key === 'F5') {
        e.preventDefault();
        handleResetForm();
      } else if (e.key === 'F9') {
        e.preventDefault();
        void handleSaveQuotation(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, saving, docStatus, confirmedQuotationRecord, selectedClientId, selectedClientName, date, notes]);

  // Extract all Quotations from sessionQuotations, sales, and documents props
  const quotationHistory = useMemo(() => {
    const list: Array<{
      id: string;
      docNumber: string;
      date: string;
      clientId?: string;
      clientName: string;
      clientNuit: string;
      clientAddress: string;
      totalAmount: number;
      status: string;
      items: SaleItem[];
      sellerName: string;
      notes?: string;
      rawSale?: SaleInvoice;
      rawDoc?: DocumentRecord;
    }> = [];

    const seenIds = new Set<string>();

    // 1. From sessionQuotations (instantly created in this session)
    sessionQuotations.forEach((s) => {
      seenIds.add(s.id);
      seenIds.add(s.docNumber);
      list.push({
        id: s.id,
        docNumber: s.docNumber,
        date: s.date,
        clientId: s.clientId,
        clientName: s.clientName,
        clientNuit: s.clientNuit || '',
        clientAddress: s.clientAddress || '',
        totalAmount: s.totalAmount,
        status: s.status || 'Emitida',
        items: s.items || [],
        sellerName: s.sellerName || operatorName,
        notes: s.notes || '',
        rawSale: s,
      });
    });

    // 2. From sales prop
    sales.forEach((s) => {
      const isCotation =
        s.documentTypeCode === 'CUSTOMER_QUOTATION' ||
        s.documentTypeCode === 'QUOTATION' ||
        s.documentTypeCode === 'COT' ||
        s.docNumber.toUpperCase().startsWith('COT') ||
        s.docNumber.toUpperCase().startsWith('CO/') ||
        s.docNumber.toUpperCase().startsWith('QUO') ||
        s.docNumber.toLowerCase().includes('cot') ||
        (s.notes && (s.notes.toLowerCase().includes('cotação') || s.notes.toLowerCase().includes('cotacao')));

      if (isCotation) {
        if (!seenIds.has(s.id) && !seenIds.has(s.docNumber)) {
          seenIds.add(s.id);
          seenIds.add(s.docNumber);
          list.push({
            id: s.id,
            docNumber: s.docNumber,
            date: s.date,
            clientId: s.clientId,
            clientName: s.clientName,
            clientNuit: s.clientNuit || '',
            clientAddress: s.clientAddress || '',
            totalAmount: s.totalAmount,
            status: s.status || 'Emitida',
            items: s.items || [],
            sellerName: s.sellerName || operatorName,
            notes: s.notes || '',
            rawSale: s,
          });
        }
      }
    });

    // 3. From documents prop
    documents.forEach((d) => {
      const isCotation =
        d.typeCode === 'CUSTOMER_QUOTATION' ||
        d.typeCode === 'QUOTATION' ||
        d.typeCode === 'COT' ||
        d.displayNumber.toUpperCase().startsWith('COT') ||
        d.displayNumber.toUpperCase().startsWith('CO/') ||
        d.displayNumber.toUpperCase().startsWith('QUO') ||
        d.displayNumber.toLowerCase().includes('cot') ||
        (d.typeName && (d.typeName.toLowerCase().includes('cotação') || d.typeName.toLowerCase().includes('cotacao')));

      if (isCotation && !seenIds.has(d.id) && !seenIds.has(d.displayNumber)) {
        const clientObj = clients.find((c) => c.id === d.partyId);
        let name = d.partyName || clientObj?.name || 'Cliente Pontual';
        let nuit = clientObj?.nuit || '';
        let address = clientObj?.address || '';

        if (d.notes && d.notes.includes('[CLIENTE:')) {
          const match = d.notes.match(/\[CLIENTE:\s*([^|]+)\|\s*NUIT:\s*([^|]+)\|\s*MORADA:\s*([^\]]+)\]/);
          if (match) {
            if (match[1].trim() && match[1].trim() !== 'N/A') name = match[1].trim();
            if (match[2].trim() && match[2].trim() !== 'N/A') nuit = match[2].trim();
            if (match[3].trim() && match[3].trim() !== 'N/A') address = match[3].trim();
          }
        }

        const matchingSale = sales.find((s) => s.id === d.id || s.docNumber === d.displayNumber);
        const docItems = matchingSale?.items && matchingSale.items.length > 0 ? matchingSale.items : [];

        list.push({
          id: d.id,
          docNumber: d.displayNumber,
          date: d.date,
          clientId: d.partyId,
          clientName: name,
          clientNuit: nuit,
          clientAddress: address,
          totalAmount: d.grandTotal,
          status: 'Emitida',
          items: docItems,
          sellerName: d.salespersonName || operatorName,
          notes: d.notes || '',
          rawDoc: d,
          rawSale: matchingSale,
        });
      }
    });

    return list.sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      if (timeB !== timeA) return timeB - timeA;
      return b.docNumber.localeCompare(a.docNumber, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [sessionQuotations, sales, documents, clients, operatorName]);

  // Filtered Quotation History by Date, Name/Nuit, or Code/DocNo
  const filteredQuotations = useMemo(() => {
    return quotationHistory.filter((item) => {
      if (historyDateFilter && item.date.substring(0, 10) !== historyDateFilter) {
        return false;
      }
      if (historyNameFilter.trim()) {
        const q = historyNameFilter.trim().toLowerCase();
        const matchName = item.clientName.toLowerCase().includes(q);
        const matchNuit = item.clientNuit.toLowerCase().includes(q);
        if (!matchName && !matchNuit) return false;
      }
      if (historyCodeFilter.trim()) {
        const q = historyCodeFilter.trim().toLowerCase();
        const matchDocNo = item.docNumber.toLowerCase().includes(q);
        const matchItemCode = item.items.some((i) => i.code.toLowerCase().includes(q));
        if (!matchDocNo && !matchItemCode) return false;
      }
      return true;
    });
  }, [quotationHistory, historyDateFilter, historyNameFilter, historyCodeFilter]);

  // Paginated Quotations
  const paginatedQuotations = useMemo(() => {
    const start = (historyPage - 1) * historyPageSize;
    return filteredQuotations.slice(start, start + historyPageSize);
  }, [filteredQuotations, historyPage, historyPageSize]);

  const handlePrintQuotationFromHistory = (item: (typeof quotationHistory)[0]) => {
    const matchingSale = sales.find((s) => s.id === item.id || s.docNumber === item.docNumber);
    const resolvedItems = (item.items && item.items.length > 0) ? item.items : (matchingSale?.items || []);

    if (item.rawSale && item.rawSale.items && item.rawSale.items.length > 0) {
      onOpenPrintModal(item.rawSale);
    } else {
      const saleFormat: SaleInvoice = {
        id: item.id,
        clientId: item.clientId || 'client-pontual',
        documentTypeCode: 'CUSTOMER_QUOTATION',
        docNumber: item.docNumber,
        date: item.date,
        clientName: item.clientName,
        clientNuit: item.clientNuit,
        clientAddress: item.clientAddress,
        paymentMethod: 'CASH',
        sellerName: item.sellerName || operatorName,
        items: resolvedItems,
        subtotalBruto: item.totalAmount,
        descontoTotal: 0,
        subtotalLiquido: item.totalAmount,
        ivaTotal: 0,
        totalAmount: item.totalAmount,
        paidAmount: 0,
        pendingAmount: item.totalAmount,
        status: 'Concluída',
      };
      onOpenPrintModal(saleFormat);
    }
  };

  return (
    <div className="space-y-6 font-sans pb-16">
      {/* Header Banner */}
      <header className="flex flex-wrap items-center justify-between border-b pb-2 border-[#c3c6d1] dark:border-[#43474f] gap-2">
        <div>
          <h2 className="text-xl font-black uppercase text-[#001e40] dark:text-[#a7c8ff] flex items-center gap-2">
            📋 Emissão de Proposta de Cotação
          </h2>
          <p className="text-xs text-[#737780] font-mono">
            Documento de orçamento sem afetação de stock físico. (Pressione F2 para gravar a qualquer momento)
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="rounded bg-blue-100 dark:bg-blue-950 px-3 py-1 text-xs font-bold text-blue-900 dark:text-blue-200 border border-blue-300">
            ℹ️ Cotação (Não altera o stock)
          </span>
          <span className="rounded bg-[#e7e8e9] dark:bg-[#282c2e] px-3 py-1 text-xs font-mono font-bold text-[#003366] dark:text-[#a7c8ff]">
            {docNumber}
          </span>
        </div>
      </header>

      {/* Header Form - Fast Enter key navigation */}
      <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-3 print:p-2 rounded-lg shadow-sm space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-xs">
          {/* Left Column */}
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px]">Data Emissão</label>
                <input
                  type="date"
                  value={date}
                  disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
                  onChange={(e) => setDate(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      validityInputRef.current?.focus();
                      validityInputRef.current?.select();
                    }
                  }}
                  className="w-full bg-white dark:bg-[#282c2e] dark:text-white font-mono border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 text-xs focus-ring disabled:opacity-60"
                />
              </div>
              <div className="col-span-1">
                <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px]">Validade (Dias)</label>
                <input
                  ref={validityInputRef}
                  type="number"
                  min="1"
                  max="180"
                  value={validityDays}
                  disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
                  onChange={(e) => setValidityDays(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      clientCodeInputRef.current?.focus();
                      clientCodeInputRef.current?.select();
                    }
                  }}
                  className="w-full bg-white dark:bg-[#282c2e] dark:text-white font-mono border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 text-xs text-center font-bold"
                />
              </div>
              <div className="col-span-1">
                <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px]">Código Cliente</label>
                <input
                  ref={clientCodeInputRef}
                  type="text"
                  placeholder="Ex: 1"
                  value={clientCodeInput}
                  disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
                  onChange={(e) => setClientCodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      lookupClientByCode(clientCodeInput);
                      clientNameInputRef.current?.focus();
                      clientNameInputRef.current?.select();
                    }
                  }}
                  onBlur={() => lookupClientByCode(clientCodeInput)}
                  className="w-full bg-white dark:bg-[#282c2e] dark:text-white font-mono border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 text-xs focus-ring font-bold disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px]">Nome do Cliente *</label>
              <input
                ref={clientNameInputRef}
                type="text"
                value={selectedClientName}
                disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
                onChange={(e) => setSelectedClientName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    clientNuitInputRef.current?.focus();
                    clientNuitInputRef.current?.select();
                  }
                }}
                placeholder="Nome do Cliente"
                className="w-full bg-white dark:bg-[#282c2e] dark:text-white font-bold border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 text-xs focus-ring disabled:opacity-60"
              />
              <label className="mt-1 flex items-center gap-1.5 text-[10px] text-[#43474f] dark:text-[#c3c6d1]">
                <input
                  type="checkbox"
                  checked={keepAsWalkIn}
                  disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
                  onChange={(e) => setKeepAsWalkIn(e.target.checked)}
                />
                Manter como Cliente Pontual (não criar ficha; dados apenas nesta cotação)
              </label>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px]">NUIT</label>
                <input
                  ref={clientNuitInputRef}
                  type="text"
                  value={clientNuit}
                  disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
                  onChange={(e) => setClientNuit(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      clientAddressInputRef.current?.focus();
                      clientAddressInputRef.current?.select();
                    }
                  }}
                  placeholder="NUIT (opcional)"
                  className="w-full bg-white dark:bg-[#282c2e] dark:text-white font-mono border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 text-xs focus-ring disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px]">Operador</label>
                <input
                  type="text"
                  value={operatorName}
                  disabled
                  className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border rounded p-1.5 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px]">Morada</label>
              <input
                ref={clientAddressInputRef}
                type="text"
                value={clientAddress}
                disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
                onChange={(e) => setClientAddress(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const searchInput = document.querySelector<HTMLInputElement>('input[placeholder*="Pesquisar artigo"]');
                    if (searchInput) {
                      searchInput.focus();
                      searchInput.select();
                    }
                  }
                }}
                placeholder="Morada do Cliente (opcional)"
                className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 text-xs focus-ring disabled:opacity-60"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Item Entry Row - Fast Enter Navigation */}
      <section className="bg-[#0000aa]/5 dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-3 rounded-lg shadow-sm space-y-2 print:hidden">
        <span className="text-[11px] font-bold uppercase text-[#003366] dark:text-[#a7c8ff] block">
          + Inserir Artigo na Cotação (Pressione Enter para mudar de campo)
        </span>

        <div className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-12 md:col-span-3">
            <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[10px]">Do Stock (Opção)</label>
            <ArticleSearchSelect
              articles={articles}
              selectedArticleId={selectedArticleId}
              onSelect={handleArticleSelect}
              loadOptions={articleSearchLoader}
              onResolveArticle={(article) => {
                setCatalogCache((current) => ({ ...current, [article.id]: article }));
                setCustomDescription(article.description);
                setInputIva(article.taxRate ?? 16);
                setInputUnitPrice(getArticlePriceWithIva(article));
              }}
              onAfterSelect={handleAfterArticleSelect}
              searchByCodeOnly={false}
              disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
              placeholder="Pesquisar catálogo…"
            />
          </div>

          <div className="col-span-12 md:col-span-3">
            <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[10px]">Descrição / Serviço *</label>
            <input
              ref={customDescriptionInputRef}
              type="text"
              placeholder="Escreva artigo ou serviço sem stock..."
              disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  qtyInputRef.current?.focus();
                  qtyInputRef.current?.select();
                }
              }}
              className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 text-xs font-medium focus-ring"
            />
          </div>

          <div className="col-span-6 md:col-span-2">
            <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[10px]">Qtd.</label>
            <input
              ref={qtyInputRef}
              type="number"
              min="0.001"
              step="1"
              disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
              value={inputQty}
              onChange={(e) => setInputQty(Math.max(0.001, Number(e.target.value)))}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  unitPriceInputRef.current?.focus();
                  unitPriceInputRef.current?.select();
                }
              }}
              className="w-full bg-yellow-100 dark:bg-[#282c2e] font-bold border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 text-right text-xs"
            />
          </div>

          <div className="col-span-6 md:col-span-2">
            <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[10px]">Preço Un.</label>
            <input
              ref={unitPriceInputRef}
              type="number"
              step="0.01"
              disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
              value={inputUnitPrice || ''}
              onChange={(e) => setInputUnitPrice(Number(e.target.value))}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  discountInputRef.current?.focus();
                  discountInputRef.current?.select();
                }
              }}
              placeholder="0.00"
              className="w-full bg-white dark:bg-[#282c2e] font-mono border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 text-right text-xs"
            />
          </div>

          <div className="col-span-6 md:col-span-1">
            <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[10px]">Desc. MZN</label>
            <input
              ref={discountInputRef}
              type="number"
              min="0"
              step="0.01"
              disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
              value={inputDiscount}
              onChange={(e) => setInputDiscount(Number(e.target.value))}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddItem();
                }
              }}
              className="w-full bg-white dark:bg-[#282c2e] font-mono border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 text-right text-xs"
            />
          </div>

          <div className="col-span-6 md:col-span-2">
            <button
              type="button"
              disabled={!customDescription.trim() || docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
              onClick={handleAddItem}
              className="w-full bg-[#003366] text-white font-bold py-1.5 px-3 rounded text-xs hover:bg-[#002244] disabled:opacity-50 uppercase"
            >
              + Adicionar
            </button>
          </div>
        </div>
      </section>

      {/* Items Table */}
      <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-[#e7e8e9] dark:bg-[#282c2e] text-[#191c1d] dark:text-[#e1e2e4] font-bold uppercase border-b border-[#c3c6d1]">
            <tr>
              <th className="p-2 w-10 text-center">#</th>
              <th className="p-2">Código</th>
              <th className="p-2">Descrição</th>
              <th className="p-2 text-right">Qtd</th>
              <th className="p-2 text-right">Desc. (MZN)</th>
              <th className="p-2 text-right">IVA %</th>
              <th className="p-2 text-right">Total (c/ IVA)</th>
              <th className="p-2 text-center w-12 print:hidden">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
            {items.map((item, index) => (
              <tr key={`${item.articleId}-${index}`} className="hover:bg-slate-50 dark:hover:bg-[#282c2e]">
                <td className="p-2 text-center text-slate-400 font-bold">{index + 1}</td>
                <td className="p-2 font-bold text-[#003366] dark:text-[#a7c8ff]">{item.code}</td>
                <td className="p-2 font-sans font-medium">{item.description}</td>
                <td className="p-2 text-right font-bold">{item.quantity}</td>
                <td className="p-2 text-right">{formatMZN(item.unitPrice)}</td>
                <td className="p-2 text-right text-red-600 font-bold">
                  {item.discountAmount && item.discountAmount > 0
                    ? formatMZN(item.discountAmount)
                    : item.discountPercent > 0
                      ? `${item.discountPercent}%`
                      : '—'}
                </td>
                <td className="p-2 text-right">{item.ivaPercent}%</td>
                <td className="p-2 text-right font-bold text-[#006e25]">{formatMZN(item.total)}</td>
                <td className="p-2 text-center print:hidden">
                  <button
                    type="button"
                    disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
                    onClick={() => handleRemoveItem(index)}
                    className="text-red-600 font-bold hover:underline disabled:opacity-30"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-slate-400 font-sans italic">
                  Nenhum artigo inserido na cotação. Pesquise e adicione artigos acima.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Totals & Notes Section */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Column: Observações */}
        <div className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-3 rounded-lg shadow-sm space-y-2">
          <label className="block font-bold text-[#737780] uppercase text-[11px]">Observações da Cotação</label>
          <textarea
            rows={3}
            value={notes}
            disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Condições comerciais, prazos de entrega, validade da proposta..."
            className="w-full bg-white dark:bg-[#282c2e] border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 text-xs focus-ring"
          />
        </div>

        {/* Right Column: Financial Totals */}
        <div className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-3 rounded-lg shadow-sm space-y-1.5 font-mono text-xs">
          <div className="flex justify-between text-slate-600 dark:text-slate-300">
            <span>Subtotal Bruto:</span>
            <span>{formatMZN(subtotalBruto)}</span>
          </div>

          {(descontoLinhas + descontoGeralValor) > 0 && (
            <div className="flex justify-between text-red-600 font-bold">
              <span>Desconto Total:</span>
              <span>-{formatMZN(descontoLinhas + descontoGeralValor)}</span>
            </div>
          )}

          <div className="flex justify-between text-slate-600 dark:text-slate-300">
            <span>IVA Total (16%):</span>
            <span>{formatMZN(ivaTotal)}</span>
          </div>

          <div className="flex justify-between items-center text-base font-black text-[#006e25] pt-2 border-t border-[#c3c6d1]">
            <span>TOTAL COTAÇÃO:</span>
            <span>{formatMZN(totalFinalAmount)}</span>
          </div>
        </div>
      </section>

      {saveError && (
        <div role="alert" className="p-3 bg-red-100 border border-red-300 rounded text-red-800 font-bold text-xs">
          ⚠️ {saveError}
        </div>
      )}

      {/* SECTION: Histórico de Cotações Emitidas com Paginação */}
      <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-4 rounded-lg shadow-sm space-y-3 print:hidden">
        <div className="flex flex-wrap items-center justify-between border-b border-[#c3c6d1] dark:border-[#43474f] pb-2 gap-2">
          <h3 className="font-bold text-xs uppercase text-[#003366] dark:text-[#a7c8ff] flex items-center gap-1.5">
            <span>📑</span> Histórico de Cotações Emitidas ({filteredQuotations.length})
          </h3>
          {(historyDateFilter || historyNameFilter || historyCodeFilter) && (
            <button
              type="button"
              onClick={() => {
                setHistoryDateFilter('');
                setHistoryNameFilter('');
                setHistoryCodeFilter('');
                setHistoryPage(1);
              }}
              className="text-xs font-bold text-red-600 hover:underline"
            >
              🧹 Limpar Filtros
            </button>
          )}
        </div>

        {/* Filters Bar */}
        <div className="grid grid-cols-12 gap-3 text-xs">
          <div className="col-span-12 sm:col-span-4 md:col-span-3">
            <label className="block font-bold text-[#737780] uppercase mb-1 text-[11px]">Filtrar por Data</label>
            <input
              type="date"
              value={historyDateFilter}
              onChange={(e) => {
                setHistoryDateFilter(e.target.value);
                setHistoryPage(1);
              }}
              className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 text-xs font-mono"
            />
          </div>

          <div className="col-span-12 sm:col-span-4 md:col-span-4">
            <label className="block font-bold text-[#737780] uppercase mb-1 text-[11px]">Filtrar por Nome do Cliente</label>
            <input
              type="text"
              placeholder="Pesquisar por nome de cliente ou NUIT..."
              value={historyNameFilter}
              onChange={(e) => {
                setHistoryNameFilter(e.target.value);
                setHistoryPage(1);
              }}
              className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 text-xs"
            />
          </div>

          <div className="col-span-12 sm:col-span-4 md:col-span-5">
            <label className="block font-bold text-[#737780] uppercase mb-1 text-[11px]">Filtrar por Código / N.º Cotação</label>
            <input
              type="text"
              placeholder="Ex: COT-2026/000001 ou código do artigo..."
              value={historyCodeFilter}
              onChange={(e) => {
                setHistoryCodeFilter(e.target.value);
                setHistoryPage(1);
              }}
              className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 text-xs font-mono"
            />
          </div>
        </div>

        {/* Quotations Table */}
        <div className="overflow-x-auto rounded border border-[#c3c6d1] dark:border-[#43474f]">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead className="bg-[#e7e8e9] dark:bg-[#282c2e] text-[#191c1d] dark:text-[#e1e2e4] font-bold uppercase border-b border-[#c3c6d1]">
              <tr>
                <th className="p-2.5">N.º Cotação</th>
                <th className="p-2.5">Data</th>
                <th className="p-2.5">Cliente</th>
                <th className="p-2.5">Operador</th>
                <th className="p-2.5 text-right">Total (MT)</th>
                <th className="p-2.5 text-center">Estado</th>
                <th className="p-2.5 text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
              {paginatedQuotations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 font-sans italic">
                    Nenhuma cotação encontrada para os filtros aplicados.
                  </td>
                </tr>
              ) : (
                paginatedQuotations.map((item) => (
                  <tr key={item.id} className="hover:bg-[#f3f4f5] dark:hover:bg-[#282c2e] transition-colors">
                    <td className="p-2.5 font-bold text-[#003366] dark:text-[#a7c8ff]">
                      {item.docNumber}
                    </td>
                    <td className="p-2.5 text-slate-600 dark:text-slate-400">
                      {item.date}
                    </td>
                    <td className="p-2.5 font-sans font-semibold">
                      {item.clientName}
                      {item.clientNuit ? <span className="text-slate-400 text-[10px] ml-1.5">(NUIT: {item.clientNuit})</span> : null}
                    </td>
                    <td className="p-2.5 font-sans text-slate-700 dark:text-slate-300 font-medium text-xs">
                      {item.sellerName || operatorName || 'Operador'}
                    </td>
                    <td className="p-2.5 text-right font-black text-[#006e25]">
                      {formatMZN(item.totalAmount)}
                    </td>
                    <td className="p-2.5 text-center font-sans">
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-100 text-blue-900 border border-blue-300 uppercase">
                        {item.status}
                      </span>
                    </td>
                    <td className="p-2.5 text-center flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handlePrintQuotationFromHistory(item)}
                        className="px-2.5 py-1 bg-[#003366] text-white font-bold rounded text-[11px] hover:bg-blue-900 flex items-center gap-1"
                      >
                        <span>🖨</span> Imprimir / Consultar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEditQuotation(item)}
                        className="px-2.5 py-1 bg-amber-600 text-white font-bold rounded text-[11px] hover:bg-amber-700 flex items-center gap-1 transition-colors"
                      >
                        <span>✏️</span> Editar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <Pagination
          currentPage={historyPage}
          totalItems={filteredQuotations.length}
          pageSize={historyPageSize}
          onPageChange={setHistoryPage}
          onPageSizeChange={setHistoryPageSize}
          pageSizeOptions={[15, 25, 50, 100]}
        />
      </section>

      {/* Action Footer Bar */}
      <footer className="fixed bottom-0 left-0 right-0 z-30 bg-[#e7e8e9] dark:bg-[#282c2e] border-t border-[#c3c6d1] dark:border-[#43474f] p-3 shadow-lg flex items-center justify-between print:hidden lg:left-[240px]">
        <div className="flex items-center space-x-3 text-xs font-mono font-bold">
          <button
            type="button"
            onClick={handleResetForm}
            className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white rounded hover:bg-slate-300"
          >
            F5 = Nova Cotação
          </button>
          <span className="text-slate-500">
            Artigos na cotação: <b>{items.length}</b>
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            disabled={saving || items.length === 0}
            onClick={() => void handleSaveQuotation(true)}
            className="px-4 py-2 bg-[#003366] text-white font-bold rounded text-xs uppercase hover:bg-blue-900 disabled:opacity-50"
          >
            🖨 Imprimir Cotação (F9)
          </button>

          <button
            type="button"
            disabled={saving || items.length === 0 || docStatus === 'CONFIRMED'}
            onClick={() => void handleSaveQuotation(false)}
            className="px-5 py-2 bg-[#006e25] text-white font-bold rounded text-xs uppercase hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? 'A guardar…' : 'Emitir Cotação (F2)'}
          </button>
        </div>
      </footer>

      {/* Edit Document Modal */}
      {editingQuotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 print:hidden">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border bg-white p-6 shadow-2xl dark:bg-[#1f2325] dark:border-[#43474f] space-y-4">
            <div className="flex items-center justify-between border-b pb-3 text-[#003366] dark:text-[#a7c8ff]">
              <div className="flex items-center space-x-2">
                <span className="material-symbols-outlined text-2xl">edit_note</span>
                <h3 className="font-black text-sm uppercase tracking-wide">
                  Editar Cotação {editingQuotation.docNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingQuotation(null)}
                className="text-gray-500 hover:text-gray-700 font-bold"
              >
                ✕
              </button>
            </div>

            {editError && (
              <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700 font-semibold">
                {editError}
              </div>
            )}

            <div className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Data de Emissão *
                  </label>
                  <input
                    type="date"
                    value={editDocumentDate}
                    onChange={(e) => setEditDocumentDate(e.target.value)}
                    className="w-full rounded border border-gray-300 p-2 dark:bg-[#282c2e] dark:border-gray-600 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Nome do Cliente / Entidade *
                  </label>
                  <input
                    type="text"
                    value={editClientName}
                    onChange={(e) => setEditClientName(e.target.value)}
                    placeholder="Nome do cliente (ex: AUTO COMPANY)"
                    className="w-full rounded border border-gray-300 p-2 dark:bg-[#282c2e] dark:border-gray-600 dark:text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    NUIT do Cliente
                  </label>
                  <input
                    type="text"
                    value={editClientNuit}
                    onChange={(e) => setEditClientNuit(e.target.value)}
                    placeholder="NUIT (opcional)"
                    className="w-full rounded border border-gray-300 p-2 dark:bg-[#282c2e] dark:border-gray-600 dark:text-white font-mono"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={editKeepAsWalkIn}
                  onChange={(e) => setEditKeepAsWalkIn(e.target.checked)}
                />
                Manter como Cliente Pontual (não criar ficha; guardar os dados apenas nesta cotação)
              </label>

              {/* Tabela de Edição de Artigos / Items & Prices */}
              <div className="space-y-2 border-t border-b py-3 dark:border-gray-700">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block font-black text-[#003366] dark:text-[#a7c8ff] uppercase text-xs">
                      Artigos / Itens da Cotação ({editItems.length})
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setEditItems(prev => [
                          ...prev,
                          {
                            articleId: `custom-${Date.now()}`,
                            code: 'DIV',
                            description: 'Novo Artigo / Serviço',
                            quantity: 1,
                            unitPrice: 0,
                            discountPercent: 0,
                            discountAmount: 0,
                            ivaPercent: 16,
                            total: 0,
                            lineType: 'MANUAL',
                            stockEffectEnabled: false,
                          }
                        ]);
                      }}
                      className="px-2.5 py-1 bg-[#003366] text-white font-bold rounded text-[11px] hover:bg-blue-900 transition-colors shadow-sm flex items-center gap-1"
                    >
                      <span>+ Artigo Manual</span>
                    </button>
                  </div>
                  {articles.length > 0 && (
                    <ArticleSearchSelect
                      articles={articles}
                      selectedArticleId=""
                      onSelect={(articleId) => {
                        const art = findArticle(articleId);
                        if (!art) return;
                        const priceWithIva = (art.sellPriceWithIva && art.sellPriceWithIva > 0)
                          ? art.sellPriceWithIva
                          : (art.sellPrice ? Math.round(art.sellPrice * (1 + (art.taxRate ?? 16) / 100) * 100) / 100 : 0);
                        setEditItems(prev => {
                          const updated = [
                            ...prev,
                            {
                              articleId: art.id,
                              code: art.code,
                              description: art.description,
                              quantity: 1,
                              unitPrice: priceWithIva,
                              discountPercent: 0,
                              discountAmount: 0,
                              ivaPercent: art.taxRate ?? 16,
                              total: priceWithIva,
                              lineType: 'STOCK' as const,
                              stockEffectEnabled: false,
                            }
                          ];
                          setEditGrandTotal(calculateDocumentTotals(updated, editGeneralDiscount).grandTotal);
                          return updated;
                        });
                      }}
                      loadOptions={articleSearchLoader}
                      onResolveArticle={(article) => setCatalogCache((current) => ({ ...current, [article.id]: article }))}
                      renderLabel={(a) => `[${a.code}] ${a.description} - ${(a.sellPriceWithIva || a.sellPrice).toFixed(2)} MZN (Stock: ${a.stock})`}
                      placeholder="Pesquisar artigo do catálogo..."
                      className="w-full"
                    />
                  )}
                </div>

                {editItems.length === 0 ? (
                  <div className="text-center py-3 text-gray-400 italic text-xs border rounded border-dashed">
                    Nenhum artigo na cotação. Pesquise no catálogo ou clique em "+ Artigo Manual".
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                    {editItems.map((item, idx) => {
                      const lineTotal = calculateDocumentLine(item).totalWithTax;
                      return (
                      <div key={idx} className="bg-slate-50 dark:bg-[#282c2e] p-2.5 rounded border border-slate-200 dark:border-gray-700 text-xs space-y-1.5">
                        {/* Row 1: Code + Description + Remove */}
                        <div className="flex items-center gap-2">
                          <div className="w-28">
                            <span className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Código</span>
                            <input
                              type="text"
                              value={item.code || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditItems(prev => {
                                  const updated = [...prev];
                                  updated[idx] = { ...updated[idx], code: val };
                                  return updated;
                                });
                              }}
                              placeholder="Código..."
                              className="w-full rounded border border-gray-300 p-1.5 dark:bg-[#1f2325] dark:border-gray-600 dark:text-white font-mono font-bold text-xs"
                            />
                          </div>
                          <div className="flex-1">
                            <span className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Descrição</span>
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditItems(prev => {
                                  const updated = [...prev];
                                  updated[idx] = { ...updated[idx], description: val };
                                  return updated;
                                });
                              }}
                              placeholder="Descrição do artigo ou serviço..."
                              className="w-full rounded border border-gray-300 p-1.5 dark:bg-[#1f2325] dark:border-gray-600 dark:text-white font-medium text-xs"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setEditItems(prev => {
                                const updated = prev.filter((_, i) => i !== idx);
                                setEditGrandTotal(calculateDocumentTotals(updated, editGeneralDiscount).grandTotal);
                                return updated;
                              });
                            }}
                            className="mt-4 p-1 text-red-600 hover:text-red-800 font-bold hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                            title="Remover Item"
                          >
                            ✕
                          </button>
                        </div>
                        {/* Row 2: quantidade, preço com IVA, desconto em MZN, IVA e total */}
                        <div className="flex items-end gap-2">
                          <div className="w-16">
                            <span className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5 text-center">Qtd</span>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => {
                                const qty = Number(e.target.value);
                                setEditItems(prev => {
                                  const updated = [...prev];
                                  updated[idx] = recalculateSaleItem({ ...updated[idx], quantity: qty });
                                  setEditGrandTotal(calculateDocumentTotals(updated, editGeneralDiscount).grandTotal);
                                  return updated;
                                });
                              }}
                              className="w-full text-center font-bold rounded border border-gray-300 p-1.5 dark:bg-[#1f2325] dark:border-gray-600 dark:text-white text-xs"
                            />
                          </div>
                          <div className="w-28">
                            <span className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5 text-right">Preço c/ IVA</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.unitPrice}
                              onChange={(e) => {
                                const price = Number(e.target.value);
                                setEditItems(prev => {
                                  const updated = [...prev];
                                  updated[idx] = recalculateSaleItem({ ...updated[idx], unitPrice: price });
                                  setEditGrandTotal(calculateDocumentTotals(updated, editGeneralDiscount).grandTotal);
                                  return updated;
                                });
                              }}
                              placeholder="0.00"
                              className="w-full text-right font-bold rounded border border-gray-300 p-1.5 text-[#006e25] dark:bg-[#1f2325] dark:border-gray-600 dark:text-white text-xs font-mono"
                            />
                          </div>
                          <div className="w-16">
                            <span className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5 text-center">Desc. MZN</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.discountAmount || 0}
                              onChange={(e) => {
                                const disc = Number(e.target.value);
                                setEditItems(prev => {
                                  const updated = [...prev];
                                  updated[idx] = recalculateSaleItem({ ...updated[idx], discountAmount: disc, discountPercent: 0 });
                                  setEditGrandTotal(calculateDocumentTotals(updated, editGeneralDiscount).grandTotal);
                                  return updated;
                                });
                              }}
                              className="w-full text-center font-bold rounded border border-gray-300 p-1.5 text-red-600 dark:bg-[#1f2325] dark:border-gray-600 dark:text-red-400 text-xs"
                            />
                          </div>
                          <div className="w-14">
                            <span className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5 text-center">IVA %</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={item.ivaPercent ?? 16}
                              onChange={(e) => {
                                const iva = Number(e.target.value);
                                setEditItems(prev => {
                                  const updated = [...prev];
                                  updated[idx] = { ...updated[idx], ivaPercent: iva };
                                  return updated;
                                });
                              }}
                              className="w-full text-center font-bold rounded border border-gray-300 p-1.5 text-[#003366] dark:bg-[#1f2325] dark:border-gray-600 dark:text-[#a7c8ff] text-xs"
                            />
                          </div>
                          <div className="w-28 text-right font-mono font-black text-[#001e40] dark:text-[#a7c8ff] text-xs pb-0.5">
                            {formatMZN(lineTotal)}
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Morada do Cliente
                  </label>
                  <input
                    type="text"
                    value={editClientAddress}
                    onChange={(e) => setEditClientAddress(e.target.value)}
                    placeholder="Morada (opcional)"
                    className="w-full rounded border border-gray-300 p-2 dark:bg-[#282c2e] dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Desconto Geral (MZN)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editGeneralDiscount}
                    onChange={(e) => setEditGeneralDiscount(Math.max(0, Number(e.target.value)))}
                    className="w-full rounded border border-gray-300 p-2 dark:bg-[#282c2e] dark:border-gray-600 dark:text-white font-mono text-red-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Valor Total da Cotação (MZN) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editGrandTotal}
                    readOnly
                    className="w-full rounded border border-gray-300 p-2 bg-gray-100 dark:bg-[#282c2e] dark:border-gray-600 dark:text-white font-mono font-black text-base text-[#006e25]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Observações / Notas Adicionais
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Adicionar notas adicionais à cotação..."
                  className="w-full rounded border border-gray-300 p-2 dark:bg-[#282c2e] dark:border-gray-600 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 border-t pt-3">
              <button
                type="button"
                onClick={() => setEditingQuotation(null)}
                className="rounded border border-gray-300 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSavingEdit || !editDocumentDate || !editClientName.trim()}
                onClick={handleExecuteSaveEditQuotation}
                className="rounded bg-[#003366] px-4 py-2 text-xs font-bold text-white hover:bg-[#002244] disabled:opacity-50"
              >
                {isSavingEdit ? 'A guardar…' : 'Gravar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export { Quotation as QuotationPage };
export default Quotation;
