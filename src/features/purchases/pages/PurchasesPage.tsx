import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  Article,
  DocumentRecord,
  PurchaseInvoiceInput,
  PurchaseItem,
  Supplier,
  ReferenceOption,
} from '@/shared/types/domain.types';
import { formatMZN } from '@/shared/utils/formatters';
import { Pagination } from '@/components/Pagination';
import { ArticleSearchSelect } from '@/features/inventory/components/ArticleSearchSelect';
import { InventoryService } from '@/features/inventory/services/inventory.service';
import { exportToExcel, exportToWord, exportToPdf } from '@/shared/utils/export.utils';

export interface PurchasesProps {
  articles: Article[];
  suppliers: Supplier[];
  documents: DocumentRecord[];
  canCreate: boolean;
  canPay: boolean;
  warehouseId?: string;
  onCreateInvoice: (invoice: PurchaseInvoiceInput) => Promise<DocumentRecord>;
  onPayInvoice: (
    document: DocumentRecord,
    method: 'CASH' | 'BANK_TRANSFER',
    amount: number,
    reference: string,
  ) => Promise<void>;
  paymentTerms: ReferenceOption[];
  paymentMethods?: ReferenceOption[];
  onOpenNewSupplier?: () => void;
  onOpenDocument?: (doc: any) => void;
}

const DEFAULT_RATES: Record<string, number> = {
  MZN: 1.0,
  USD: 63.85,
  ZAR: 3.65,
  EUR: 70.2,
};

export const Purchases: React.FC<PurchasesProps> = ({
  articles,
  suppliers,
  documents,
  canCreate,
  canPay,
  warehouseId,
  onCreateInvoice,
  onPayInvoice,
  paymentTerms,
  paymentMethods = [],
  onOpenNewSupplier,
  onOpenDocument,
}) => {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '');
  const [supplierCodeInput, setSupplierCodeInput] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dateFilter, setDateFilter] = useState('');
  const [supplierReference, setSupplierReference] = useState('');
  const [requisitionNo, setRequisitionNo] = useState('');
  const [term, setTerm] = useState(
    paymentTerms.find((item) => !item.requiresImmediatePayment)?.code ?? paymentTerms[0]?.code ?? '',
  );

  // Multicurrency state
  const [currency, setCurrency] = useState<'MZN' | 'USD' | 'ZAR' | 'EUR'>('MZN');
  const [exchangeRate, setExchangeRate] = useState<number>(1.0);

  // Article selection & line item state
  const [articleId, setArticleId] = useState('');
  const [catalogCache, setCatalogCache] = useState<Record<string, Article>>({});
  const findArticle = (id: string) => catalogCache[id] || articles.find((a) => a.id === id);
  const [quantityStr, setQuantityStr] = useState('');
  const [unitCostStr, setUnitCostStr] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [serialNumbersStr, setSerialNumbersStr] = useState('');
  const [showAdvancedTracking, setShowAdvancedTracking] = useState(false);
  const [purchaseTaxRate, setPurchaseTaxRate] = useState<number>(articles[0]?.taxRate ?? 16);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [payingId, setPayingId] = useState('');

  const qtyInputRef = useRef<HTMLInputElement>(null);
  const costInputRef = useRef<HTMLInputElement>(null);
  const taxInputRef = useRef<HTMLInputElement>(null);

  // Auto set default rate when currency changes
  const handleCurrencyChange = (newCur: 'MZN' | 'USD' | 'ZAR' | 'EUR') => {
    setCurrency(newCur);
    setExchangeRate(DEFAULT_RATES[newCur] || 1.0);
  };

  // Keep supplierCodeInput in sync when supplierId changes
  useEffect(() => {
    if (supplierId) {
      const found = suppliers.find((s) => s.id === supplierId);
      if (found) {
        setSupplierCodeInput(found.code || found.number || '');
      }
    }
  }, [supplierId, suppliers]);

  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(25);

  const supplierDocuments = useMemo(() => {
    let list = documents.filter((document) => document.typeCode.startsWith('SUPPLIER_'));
    if (dateFilter) {
      list = list.filter((doc) => doc.date.startsWith(dateFilter));
    }
    return list;
  }, [documents, dateFilter]);

  useEffect(() => {
    setHistoryPage(1);
  }, [dateFilter, historyPageSize]);

  const totalHistoryPages = Math.max(1, Math.ceil(supplierDocuments.length / historyPageSize));
  const safeHistoryPage = Math.min(historyPage, totalHistoryPages);
  const pagedSupplierDocuments = useMemo(
    () => supplierDocuments.slice((safeHistoryPage - 1) * historyPageSize, safeHistoryPage * historyPageSize),
    [supplierDocuments, safeHistoryPage, historyPageSize]
  );

  // Totals in MZN and Foreign Currency
  const totalMzn = items.reduce((sum, item) => sum + item.total, 0);
  const totalForeign = currency !== 'MZN' && exchangeRate > 0 ? totalMzn / exchangeRate : totalMzn;

  const handleSupplierCodeChange = (query: string) => {
    setSupplierCodeInput(query);
    const clean = query.trim().toLowerCase();
    if (!clean) return;
    const found = suppliers.find(
      (s) => s.code?.toLowerCase() === clean || s.number?.toLowerCase() === clean || s.id.toLowerCase() === clean,
    );
    if (found) {
      setSupplierId(found.id);
    }
  };

  const articleSearchLoader = useMemo(
    () => (query: string) => InventoryService.searchProducts(query, warehouseId, 50),
    [warehouseId],
  );

  const resolveArticle = (article: Article) => {
    setCatalogCache((current) => ({ ...current, [article.id]: article }));
    const baseCost = article.costPrice || 0;
    const foreignCost = currency !== 'MZN' && exchangeRate > 0 ? baseCost / exchangeRate : baseCost;
    setUnitCostStr(foreignCost ? foreignCost.toFixed(2) : '');
    setPurchaseTaxRate(article.taxRate ?? 16);
  };

  const selectArticle = (id: string) => {
    setArticleId(id);
    const target = findArticle(id);
    const baseCost = target?.costPrice || 0;
    const foreignCost = currency !== 'MZN' && exchangeRate > 0 ? baseCost / exchangeRate : baseCost;
    setUnitCostStr(foreignCost ? foreignCost.toFixed(2) : '');
    setPurchaseTaxRate(target?.taxRate ?? 16);
  };

  const addItem = () => {
    const article = findArticle(articleId);
    const quantity = Number(quantityStr);
    const rawCost = Number(unitCostStr);
    if (!article || quantity <= 0 || isNaN(quantity) || isNaN(rawCost) || rawCost < 0) return;

    // Convert to MZN unit cost
    const rate = currency === 'MZN' ? 1.0 : exchangeRate > 0 ? exchangeRate : 1.0;
    const unitCostMzn = currency === 'MZN' ? rawCost : rawCost * rate;
    const netMzn = quantity * unitCostMzn;
    const totalWithTaxMzn = Math.round(netMzn * (1 + purchaseTaxRate / 100) * 100) / 100;

    const serials = serialNumbersStr
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    setItems((current) => [
      ...current,
      {
        articleId: article.id,
        code: article.code,
        description: article.description,
        quantity,
        unitCost: unitCostMzn,
        unitCostForeign: currency !== 'MZN' ? rawCost : undefined,
        currency,
        exchangeRate: rate,
        lotNumber: lotNumber.trim() || undefined,
        expirationDate: expirationDate || undefined,
        serialNumbers: serials.length > 0 ? serials : undefined,
        discountPercent: 0,
        taxPercent: purchaseTaxRate,
        total: totalWithTaxMzn,
      },
    ]);

    setQuantityStr('');
    setUnitCostStr('');
    setLotNumber('');
    setExpirationDate('');
    setSerialNumbersStr('');
    setArticleId('');

    setTimeout(() => {
      const searchInput = document.querySelector<HTMLInputElement>('input[placeholder*="Pesquisar artigo"]');
      if (searchInput) {
        searchInput.focus();
        searchInput.select?.();
      }
    }, 40);
  };

  const saveInvoice = async () => {
    let currentItems = [...items];
    const quantity = Number(quantityStr);
    const rawCost = Number(unitCostStr);
    const pendingArticle = findArticle(articleId);

    if (pendingArticle && quantity > 0 && !isNaN(quantity) && !isNaN(rawCost) && rawCost >= 0) {
      const rate = currency === 'MZN' ? 1.0 : exchangeRate > 0 ? exchangeRate : 1.0;
      const unitCostMzn = currency === 'MZN' ? rawCost : rawCost * rate;
      const netMzn = quantity * unitCostMzn;
      const totalWithTaxMzn = Math.round(netMzn * (1 + purchaseTaxRate / 100) * 100) / 100;

      const serials = serialNumbersStr
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      const newItem: PurchaseItem = {
        articleId: pendingArticle.id,
        code: pendingArticle.code,
        description: pendingArticle.description,
        quantity,
        unitCost: unitCostMzn,
        unitCostForeign: currency !== 'MZN' ? rawCost : undefined,
        currency,
        exchangeRate: rate,
        lotNumber: lotNumber.trim() || undefined,
        expirationDate: expirationDate || undefined,
        serialNumbers: serials.length > 0 ? serials : undefined,
        discountPercent: 0,
        taxPercent: purchaseTaxRate,
        total: totalWithTaxMzn,
      };
      currentItems.push(newItem);
      setItems(currentItems);
      setQuantityStr('');
      setUnitCostStr('');
      setLotNumber('');
      setExpirationDate('');
      setSerialNumbersStr('');
    }

    if (!supplierId || !supplierReference.trim() || currentItems.length === 0) {
      setError('Selecione o fornecedor, indique a referência da fatura e adicione pelo menos um artigo.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onCreateInvoice({
        supplierId,
        date,
        supplierInvoiceNumber: requisitionNo ? `${supplierReference} (Req: ${requisitionNo})` : supplierReference,
        paymentTermCode: term,
        currency,
        exchangeRate: currency !== 'MZN' ? exchangeRate : 1.0,
        foreignTotal: currency !== 'MZN' ? totalForeign : undefined,
        items: currentItems,
      });
      setItems([]);
      setSupplierReference('');
      setRequisitionNo('');
      setQuantityStr('');
      setUnitCostStr('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Falha ao confirmar a compra.');
    } finally {
      setSaving(false);
    }
  };

  const payInvoice = async (document: DocumentRecord) => {
    const amountToPay = document.outstandingAmount;
    if (amountToPay <= 0) return;

    setPayingId(document.id);
    setError('');
    try {
      await onPayInvoice(document, 'CASH', amountToPay, '');
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : 'Falha ao pagar a factura.');
    } finally {
      setPayingId('');
    }
  };

  // Export supplier documents to Excel, Word, and PDF
  const handleExportExcel = () => {
    exportToExcel(
      {
        title: 'Histórico de Compras a Fornecedores',
        date: new Date().toLocaleDateString('pt-MZ'),
        headers: ['Documento', 'Fornecedor', 'Estado', 'Total (MZN)', 'Pendente (MZN)'],
        rows: supplierDocuments.map((d) => [
          d.displayNumber,
          d.partyName,
          d.status,
          d.grandTotal.toFixed(2),
          d.outstandingAmount.toFixed(2),
        ]),
        totals: [
          {
            label: 'Total Faturado',
            value: supplierDocuments.reduce((s, d) => s + d.grandTotal, 0).toFixed(2),
          },
          {
            label: 'Total Pendente',
            value: supplierDocuments.reduce((s, d) => s + d.outstandingAmount, 0).toFixed(2),
          },
        ],
      },
      'compras_fornecedores',
    );
  };

  const handleExportWord = () => {
    exportToWord(
      {
        title: 'Relatório de Compras a Fornecedores',
        date: new Date().toLocaleDateString('pt-MZ'),
        headers: ['Documento', 'Fornecedor', 'Estado', 'Total (MZN)', 'Pendente (MZN)'],
        rows: supplierDocuments.map((d) => [
          d.displayNumber,
          d.partyName,
          d.status,
          d.grandTotal.toFixed(2),
          d.outstandingAmount.toFixed(2),
        ]),
        totals: [
          {
            label: 'Total Faturado',
            value: supplierDocuments.reduce((s, d) => s + d.grandTotal, 0).toFixed(2),
          },
        ],
      },
      'compras_fornecedores',
    );
  };

  const handleExportPdf = () => {
    exportToPdf({
      title: 'Mapa de Compras & Facturas de Fornecedor',
      date: new Date().toLocaleDateString('pt-MZ'),
      headers: ['Nº Documento', 'Fornecedor', 'Estado', 'Total (MZN)', 'Pendente (MZN)'],
      rows: supplierDocuments.map((d) => [
        d.displayNumber,
        d.partyName,
        d.status,
        d.grandTotal.toFixed(2),
        d.outstandingAmount.toFixed(2),
      ]),
      totals: [
        {
          label: 'Total Compras',
          value: supplierDocuments.reduce((s, d) => s + d.grandTotal, 0).toFixed(2),
        },
        {
          label: 'Saldo Devedor a Fornecedores',
          value: supplierDocuments.reduce((s, d) => s + d.outstandingAmount, 0).toFixed(2),
        },
      ],
    });
  };

  const resetForm = () => {
    setItems([]);
    setSupplierReference('');
    setRequisitionNo('');
    setQuantityStr('');
    setUnitCostStr('');
    setLotNumber('');
    setExpirationDate('');
    setSerialNumbersStr('');
    setError('');
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        void saveInvoice();
      } else if (e.key === 'F5' || e.key === 'Escape') {
        e.preventDefault();
        resetForm();
      } else if (e.key === 'F9') {
        e.preventDefault();
        handleExportPdf();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, saving, quantityStr, unitCostStr, articleId, supplierId, supplierReference, currency, exchangeRate]);

  return (
    <div className="space-y-4 pb-12 font-sans">
      <header className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-extrabold text-[#001e40] dark:text-[#a7c8ff]">Compras a Fornecedores</h2>
          <p className="text-sm text-[#737780]">
            Faturação multimoeda, cálculo automático de custos e controlo de lotes/séries.
          </p>
        </div>

        {/* Multicurrency & Export Quick Bar */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 text-xs font-bold hover:bg-emerald-100 transition-colors cursor-pointer"
            title="Exportar listagem para Excel (.csv/.xlsx)"
          >
            <span className="material-symbols-outlined text-sm">table_view</span>
            <span>Excel</span>
          </button>
          <button
            type="button"
            onClick={handleExportWord}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-300 bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800 text-xs font-bold hover:bg-blue-100 transition-colors cursor-pointer"
            title="Exportar proposta para Word (.doc)"
          >
            <span className="material-symbols-outlined text-sm">description</span>
            <span>Word</span>
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-300 bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800 text-xs font-bold hover:bg-red-100 transition-colors cursor-pointer"
            title="Imprimir ou Guardar em PDF"
          >
            <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
            <span>PDF</span>
          </button>
        </div>
      </header>

      {canCreate && (
        <section className="space-y-3 rounded-lg border border-[#c3c6d1] bg-white p-4 shadow-sm dark:border-[#43474f] dark:bg-[#1f2325] print:p-2">
          {/* Header row with Supplier, Dates, and Multicurrency */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {/* Supplier & Code */}
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <label className="col-span-1 font-bold uppercase text-[#737780]">
                  Cód. Forn.
                  <input
                    type="text"
                    placeholder="Ex: FOR-001"
                    value={supplierCodeInput}
                    onChange={(e) => handleSupplierCodeChange(e.target.value)}
                    className="mt-0.5 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-1.5 font-mono font-bold dark:bg-[#282c2e]"
                  />
                </label>
                <label className="col-span-2 font-bold uppercase text-[#737780]">
                  Fornecedor *
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="mt-0.5 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-1.5 dark:bg-[#282c2e]"
                  >
                    <option value="">Selecionar Fornecedor…</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name} ({supplier.code || supplier.number})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div>
                <label className="font-bold uppercase text-[#737780]">
                  Data da Fatura
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      setDateFilter(e.target.value);
                    }}
                    className="mt-0.5 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-1.5 dark:bg-[#282c2e]"
                  />
                </label>
              </div>
            </div>

            {/* Invoicing Numbers & Terms */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <label className="font-bold uppercase text-[#737780]">
                  Nº Factura Fornecedor *
                  <input
                    required
                    value={supplierReference}
                    onChange={(e) => setSupplierReference(e.target.value)}
                    placeholder="Ex: FT 2026/9981"
                    className="mt-0.5 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-1.5 font-mono font-bold dark:bg-[#282c2e]"
                  />
                </label>
                <label className="font-bold uppercase text-[#737780]">
                  Nº Guia / Requisição
                  <input
                    value={requisitionNo}
                    onChange={(e) => setRequisitionNo(e.target.value)}
                    placeholder="Ex: REQ-045"
                    className="mt-0.5 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-1.5 font-mono dark:bg-[#282c2e]"
                  />
                </label>
              </div>

              <div>
                <label className="font-bold uppercase text-[#737780]">
                  Condição de Pagamento
                  <select
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    className="mt-0.5 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-1.5 dark:bg-[#282c2e]"
                  >
                    {paymentTerms.map((item) => (
                      <option key={item.id} value={item.code}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {/* MULTICURRENCY SETTINGS */}
            <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-black text-xs text-blue-900 dark:text-blue-200 uppercase flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">currency_exchange</span>
                  Moeda & Câmbio
                </span>
                <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300">Conversão em MZN</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="font-bold uppercase text-[10px] text-slate-600 dark:text-slate-400">
                  Moeda Fatura
                  <select
                    value={currency}
                    onChange={(e) => handleCurrencyChange(e.target.value as any)}
                    className="mt-0.5 w-full rounded border border-blue-300 dark:border-blue-700 p-1.5 font-bold bg-white dark:bg-[#282c2e]"
                  >
                    <option value="MZN">MZN (Metical)</option>
                    <option value="USD">USD (Dólar)</option>
                    <option value="ZAR">ZAR (Rand)</option>
                    <option value="EUR">EUR (Euro)</option>
                  </select>
                </label>

                <label className="font-bold uppercase text-[10px] text-slate-600 dark:text-slate-400">
                  Câmbio Manual ({currency} → MZN)
                  <input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    disabled={currency === 'MZN'}
                    value={currency === 'MZN' ? 1.0 : exchangeRate}
                    onChange={(e) => setExchangeRate(Number(e.target.value))}
                    className="mt-0.5 w-full rounded border border-blue-300 dark:border-blue-700 p-1.5 font-mono font-bold text-right bg-white dark:bg-[#282c2e] disabled:opacity-60"
                  />
                </label>
              </div>

              {currency !== 'MZN' && (
                <p className="text-[11px] text-blue-900 dark:text-blue-300 font-medium">
                  Taxa: 1 {currency} = <b>{exchangeRate.toFixed(4)} MZN</b>
                </p>
              )}
            </div>
          </div>

          {/* ITEM ENTRY ROW */}
          <div className="bg-[#0000aa]/5 dark:bg-[#282c2e] p-3 rounded-xl border border-[#c3c6d1] dark:border-[#43474f] space-y-2">
            <div className="grid items-end gap-2 md:grid-cols-[1fr_90px_130px_90px_auto]">
              <label className="text-xs font-bold uppercase text-[#737780]">
                Artigo
                <ArticleSearchSelect
                  articles={articles}
                  selectedArticleId={articleId}
                  onSelect={selectArticle}
                  loadOptions={articleSearchLoader}
                  onResolveArticle={resolveArticle}
                  onAfterSelect={() => {
                    setTimeout(() => {
                      qtyInputRef.current?.focus();
                      qtyInputRef.current?.select();
                    }, 40);
                  }}
                  renderLabel={(a) => `[${a.code}] ${a.description} - Custo PMP: ${a.costPrice.toFixed(2)} MZN`}
                  placeholder="Pesquisar artigo…"
                  className="mt-1"
                />
              </label>

              <label className="text-xs font-bold uppercase text-[#737780]">
                Qtd.
                <input
                  ref={qtyInputRef}
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={quantityStr}
                  onChange={(e) => setQuantityStr(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder="Ex: 10"
                  className="mt-1 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-1.5 text-right font-bold bg-yellow-50 dark:bg-[#1f2325]"
                />
              </label>

              <label className="text-xs font-bold uppercase text-[#737780]">
                Custo ({currency})
                <input
                  ref={costInputRef}
                  type="number"
                  min="0"
                  step="0.01"
                  value={unitCostStr}
                  onChange={(e) => setUnitCostStr(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder={`Custo em ${currency}`}
                  className="mt-1 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-1.5 text-right font-mono font-bold dark:bg-[#282c2e]"
                />
              </label>

              <label className="text-xs font-bold uppercase text-[#737780]">
                IVA %
                <input
                  ref={taxInputRef}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={purchaseTaxRate}
                  onChange={(e) => setPurchaseTaxRate(Number(e.target.value))}
                  className="mt-1 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-1.5 text-center font-bold dark:bg-[#282c2e]"
                />
              </label>

              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowAdvancedTracking(!showAdvancedTracking)}
                  className={`p-2 rounded border text-xs font-bold transition-colors cursor-pointer ${
                    showAdvancedTracking
                      ? 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300'
                      : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200'
                  }`}
                  title="Rastreabilidade avançada: Lote, Validade e Números de Série"
                >
                  <span className="material-symbols-outlined text-sm block">qr_code_2</span>
                </button>
                <button
                  type="button"
                  onClick={addItem}
                  className="rounded bg-[#003366] px-4 py-2 text-xs font-bold uppercase text-white hover:bg-blue-800 cursor-pointer"
                >
                  Adicionar
                </button>
              </div>
            </div>

            {/* LOT & SERIAL NUMBERS DRAWER */}
            {showAdvancedTracking && (
              <div className="p-3 bg-purple-50/70 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs animate-fadeIn">
                <label className="font-bold text-purple-900 dark:text-purple-200">
                  Nº do Lote (Batch)
                  <input
                    type="text"
                    value={lotNumber}
                    onChange={(e) => setLotNumber(e.target.value)}
                    placeholder="Ex: LOT-2026-08"
                    className="mt-0.5 w-full rounded border border-purple-300 dark:border-purple-700 p-1.5 bg-white dark:bg-[#282c2e] font-mono"
                  />
                </label>
                <label className="font-bold text-purple-900 dark:text-purple-200">
                  Data de Validade (Expiry)
                  <input
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    className="mt-0.5 w-full rounded border border-purple-300 dark:border-purple-700 p-1.5 bg-white dark:bg-[#282c2e]"
                  />
                </label>
                <label className="font-bold text-purple-900 dark:text-purple-200">
                  Números de Série (Separados por vírgula)
                  <input
                    type="text"
                    value={serialNumbersStr}
                    onChange={(e) => setSerialNumbersStr(e.target.value)}
                    placeholder="Ex: SN001, SN002, SN003"
                    className="mt-0.5 w-full rounded border border-purple-300 dark:border-purple-700 p-1.5 bg-white dark:bg-[#282c2e] font-mono text-[11px]"
                  />
                </label>
              </div>
            )}
          </div>

          {/* TABLE OF ADDED PURCHASE ITEMS */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-[#f3f4f5] uppercase dark:bg-[#282c2e] font-bold border-b border-[#c3c6d1]">
                <tr>
                  <th className="p-2 text-left">Artigo</th>
                  <th className="p-2 text-center">Lote / Validade</th>
                  <th className="p-2 text-right">Qtd.</th>
                  {currency !== 'MZN' && <th className="p-2 text-right">Custo ({currency})</th>}
                  <th className="p-2 text-right">Custo (MZN)</th>
                  <th className="p-2 text-right">Total c/ IVA (MZN)</th>
                  <th className="p-2 text-center">Acção</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f] font-mono">
                {items.map((item, index) => (
                  <tr key={`${item.articleId}-${index}`}>
                    <td className="p-2 font-sans font-medium">
                      {item.code} — {item.description}
                      {item.serialNumbers && item.serialNumbers.length > 0 && (
                        <span className="block text-[10px] text-purple-700 dark:text-purple-300 font-mono">
                          Séries: {item.serialNumbers.join(', ')}
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-center font-sans text-[11px] text-slate-500">
                      {item.lotNumber ? (
                        <span>
                          {item.lotNumber} {item.expirationDate ? `(Val: ${item.expirationDate})` : ''}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="p-2 text-right font-bold">{item.quantity}</td>
                    {currency !== 'MZN' && (
                      <td className="p-2 text-right text-blue-700 dark:text-blue-300">
                        {item.unitCostForeign ? `${item.unitCostForeign.toFixed(2)} ${currency}` : '—'}
                      </td>
                    )}
                    <td className="p-2 text-right">{formatMZN(item.unitCost)}</td>
                    <td className="p-2 text-right font-bold text-[#006e25]">{formatMZN(item.total)}</td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => setItems((current) => current.filter((_, idx) => idx !== index))}
                        className="text-red-700 font-bold hover:underline cursor-pointer"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={currency !== 'MZN' ? 7 : 6} className="p-6 text-center text-slate-400 font-sans italic text-xs">
                      Nenhum artigo inserido. Selecione um artigo acima para registar a compra.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#c3c6d1] dark:border-[#43474f] pt-3">
            <div className="text-xs space-y-0.5">
              {currency !== 'MZN' && (
                <div className="text-blue-800 dark:text-blue-300 font-bold">
                  Total Moeda Estrangeira: <b>{totalForeign.toFixed(2)} {currency}</b> (Taxa: {exchangeRate.toFixed(4)})
                </div>
              )}
              <strong className="font-mono text-xl text-[#006e25]">TOTAL CONVERTIDO: {formatMZN(totalMzn)}</strong>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
              >
                Limpar (ESC)
              </button>
              <button
                type="button"
                disabled={saving || (items.length === 0 && (!quantityStr || Number(quantityStr) <= 0))}
                onClick={() => void saveInvoice()}
                className="rounded bg-[#006e25] px-6 py-2.5 text-xs font-bold uppercase text-white disabled:opacity-50 hover:bg-green-700 shadow-md cursor-pointer"
              >
                {saving ? 'A confirmar…' : 'Gravar Fatura (F2)'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* SUPPLIER DOCUMENTS HISTORY TABLE */}
      <section className="overflow-hidden rounded-lg border border-[#c3c6d1] bg-white dark:border-[#43474f] dark:bg-[#1f2325] pb-4">
        <div className="flex flex-wrap items-center justify-between border-b p-4 gap-2">
          <h3 className="font-bold text-xs uppercase">Documentos de Fornecedores & Histórico</h3>
          <div className="flex items-center space-x-2 text-xs font-bold">
            <span>Filtrar por Data:</span>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded border p-1 font-normal dark:bg-[#282c2e]"
            />
            {dateFilter && (
              <button onClick={() => setDateFilter('')} className="text-red-600 hover:underline text-xs cursor-pointer">
                Ver Todos
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#f3f4f5] text-xs uppercase dark:bg-[#282c2e]">
              <tr>
                <th className="p-3 text-left">Documento</th>
                <th className="p-3 text-left">Fornecedor</th>
                <th className="p-3 text-left">Estado</th>
                <th className="p-3 text-right">Total (MZN)</th>
                <th className="p-3 text-right">Pendente (MZN)</th>
                <th className="p-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
              {pagedSupplierDocuments.map((document) => (
                <tr key={document.id} className="hover:bg-[#f3f4f5] dark:hover:bg-[#282c2e]">
                  <td className="p-3 font-mono font-bold text-[#003366] dark:text-[#a7c8ff]">{document.displayNumber}</td>
                  <td className="p-3">{document.partyName}</td>
                  <td className="p-3">
                    <span className="rounded bg-[#e7e8e9] px-2 py-1 text-[10px] font-black">{document.status}</span>
                  </td>
                  <td className="p-3 text-right font-mono font-bold">{formatMZN(document.grandTotal)}</td>
                  <td className="p-3 text-right font-mono font-bold text-red-600">{formatMZN(document.outstandingAmount)}</td>
                  <td className="p-3 text-right">
                    {canPay && document.outstandingAmount > 0 && (
                      <button
                        disabled={payingId === document.id}
                        onClick={() => void payInvoice(document)}
                        className="rounded bg-[#003366] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50 hover:bg-blue-800 cursor-pointer"
                      >
                        {payingId === document.id ? 'A pagar…' : 'Pagar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pagedSupplierDocuments.length === 0 && (
          <p className="p-6 text-center text-sm text-[#737780]">Sem documentos de fornecedor para a data selecionada.</p>
        )}
        <div className="border-t border-[#c3c6d1] bg-slate-50/70 px-3 dark:border-[#43474f] dark:bg-[#1b2023] mt-2">
          <Pagination
            currentPage={safeHistoryPage}
            totalItems={supplierDocuments.length}
            pageSize={historyPageSize}
            onPageChange={setHistoryPage}
            onPageSizeChange={setHistoryPageSize}
            pageSizeOptions={[15, 25, 50, 100]}
          />
        </div>
      </section>
    </div>
  );
};

export { Purchases as PurchasesPage };
export default Purchases;
