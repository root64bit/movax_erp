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
import { ArticleSearchSelect } from '@/features/inventory/components/ArticleSearchSelect';
import { InventoryService } from '@/features/inventory/services/inventory.service';

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
  const [term, setTerm] = useState(paymentTerms.find((item) => !item.requiresImmediatePayment)?.code ?? paymentTerms[0]?.code ?? '');
  const [articleId, setArticleId] = useState('');
  const [catalogCache, setCatalogCache] = useState<Record<string, Article>>({});
  const findArticle = (id: string) => catalogCache[id] || articles.find((a) => a.id === id);
  const [quantityStr, setQuantityStr] = useState('');
  const [unitCostStr, setUnitCostStr] = useState('');
  const [purchaseTaxRate, setPurchaseTaxRate] = useState<number>(articles[0]?.taxRate ?? 16);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [payingId, setPayingId] = useState('');

  const qtyInputRef = useRef<HTMLInputElement>(null);
  const costInputRef = useRef<HTMLInputElement>(null);
  const taxInputRef = useRef<HTMLInputElement>(null);

  // Keep supplierCodeInput in sync when supplierId changes
  useEffect(() => {
    if (supplierId) {
      const found = suppliers.find((s) => s.id === supplierId);
      if (found) {
        setSupplierCodeInput(found.code || found.number || '');
      }
    }
  }, [supplierId, suppliers]);

  const supplierDocuments = useMemo(() => {
    let list = documents.filter((document) => document.typeCode.startsWith('SUPPLIER_'));
    if (dateFilter) {
      list = list.filter((doc) => doc.date.startsWith(dateFilter));
    }
    return list;
  }, [documents, dateFilter]);

  const total = items.reduce((sum, item) => sum + item.total, 0);

  const handleSupplierCodeChange = (query: string) => {
    setSupplierCodeInput(query);
    const clean = query.trim().toLowerCase();
    if (!clean) return;
    const found = suppliers.find(
      (s) => s.code?.toLowerCase() === clean || s.number?.toLowerCase() === clean || s.id.toLowerCase() === clean
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
    setUnitCostStr(article.costPrice ? String(article.costPrice) : '');
    setPurchaseTaxRate(article.taxRate ?? 16);
  };

  const selectArticle = (id: string) => {
    setArticleId(id);
    const target = findArticle(id);
    setUnitCostStr(target?.costPrice ? String(target.costPrice) : '');
    setPurchaseTaxRate(target?.taxRate ?? 16);
  };

  const addItem = () => {
    const article = findArticle(articleId);
    const quantity = Number(quantityStr);
    const unitCost = Number(unitCostStr);
    if (!article || quantity <= 0 || isNaN(quantity) || isNaN(unitCost) || unitCost < 0) return;
    const net = quantity * unitCost;
    setItems((current) => [
      ...current,
      {
        articleId: article.id,
        code: article.code,
        description: article.description,
        quantity,
        unitCost,
        discountPercent: 0,
        taxPercent: purchaseTaxRate,
        total: Math.round(net * (1 + purchaseTaxRate / 100) * 100) / 100,
      },
    ]);
    setQuantityStr('');
    setUnitCostStr('');
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
    const unitCost = Number(unitCostStr);
    const pendingArticle = findArticle(articleId);

    if (pendingArticle && quantity > 0 && !isNaN(quantity) && !isNaN(unitCost) && unitCost >= 0) {
      const net = quantity * unitCost;
      const newItem: PurchaseItem = {
        articleId: pendingArticle.id,
        code: pendingArticle.code,
        description: pendingArticle.description,
        quantity,
        unitCost,
        discountPercent: 0,
        taxPercent: purchaseTaxRate,
        total: Math.round(net * (1 + purchaseTaxRate / 100) * 100) / 100,
      };
      currentItems.push(newItem);
      setItems(currentItems);
      setQuantityStr('');
      setUnitCostStr('');
    }

    if (!supplierId || !supplierReference.trim() || currentItems.length === 0) {
      setError('Selecione o fornecedor, indique a referência e adicione pelo menos um artigo.');
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
      await onPayInvoice(
        document,
        'CASH',
        amountToPay,
        '',
      );
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : 'Falha ao pagar a factura.');
    } finally {
      setPayingId('');
    }
  };

  const handleSectionKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'F2') {
      e.preventDefault();
      if (items.length > 0 && !saving) void saveInvoice();
      return;
    }

    if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      if (target.tagName === 'BUTTON' && !target.classList.contains('add-btn')) return;

      e.preventDefault();
      const section = e.currentTarget;
      const focusable = Array.from(
        section.querySelectorAll<HTMLElement>(
          'input:not([disabled]):not([readonly]), select:not([disabled]), button.add-btn'
        )
      ).filter((el) => el.offsetWidth > 0 && el.offsetHeight > 0);

      const index = focusable.indexOf(target);
      if (index > -1 && index < focusable.length - 1) {
        const nextEl = focusable[index + 1];
        nextEl.focus();
        if (nextEl instanceof HTMLInputElement) {
          nextEl.select?.();
        }
      } else {
        addItem();
      }
    }
  };

  const resetForm = () => {
    setItems([]);
    setSupplierReference('');
    setRequisitionNo('');
    setQuantityStr('');
    setUnitCostStr('');
    setError('');
  };

  // Global Keyboard shortcuts: F2=Gravar, F5/ESC=Novo/Sair, F9=Imprimir
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
        window.print();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, saving, quantityStr, unitCostStr, articleId, supplierId, supplierReference]);

  return (
    <div className="space-y-4 pb-12 font-sans">
      <header className="print:hidden">
        <h2 className="text-2xl font-extrabold text-[#001e40] dark:text-[#a7c8ff]">
          Compras a Fornecedores
        </h2>
        <p className="text-sm text-[#737780]">
          Registo de facturas, entrada automática em stock e contas a pagar.
        </p>
      </header>

      {canCreate && (
        <section
          onKeyDown={handleSectionKeyDown}
          className="space-y-3 rounded-lg border border-[#c3c6d1] bg-white p-4 shadow-sm dark:border-[#43474f] dark:bg-[#1f2325] print:p-2 print:shadow-none print:space-y-1"
        >
          {/* Header form in 2 compact columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-xs print:text-[10px]">
            {/* Column 1 */}
            <div className="space-y-2 print:space-y-1">
              <div className="grid grid-cols-3 gap-2">
                <label className="col-span-1 text-xs print:text-[9px] font-bold uppercase text-[#737780]">
                  Código Fornecedor
                  <input
                    type="text"
                    placeholder="Ex: F001"
                    value={supplierCodeInput}
                    onChange={(e) => handleSupplierCodeChange(e.target.value)}
                    className="mt-0.5 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-1.5 print:p-1 font-mono font-bold dark:bg-[#282c2e]"
                  />
                </label>
                <label className="col-span-2 text-xs print:text-[9px] font-bold uppercase text-[#737780]">
                  Fornecedor
                  <select
                    value={supplierId}
                    onChange={(event) => setSupplierId(event.target.value)}
                    className="mt-0.5 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-1.5 print:p-1 dark:bg-[#282c2e]"
                  >
                    <option value="">Selecionar…</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name} ({supplier.code || supplier.number})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div>
                <label className="text-xs print:text-[9px] font-bold uppercase text-[#737780]">
                  Data
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => {
                      setDate(event.target.value);
                      setDateFilter(event.target.value);
                    }}
                    className="mt-0.5 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-1.5 print:p-1 dark:bg-[#282c2e]"
                  />
                </label>
              </div>
            </div>

            {/* Column 2 */}
            <div className="space-y-2 print:space-y-1">
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs print:text-[9px] font-bold uppercase text-[#737780]">
                  Factura do Fornecedor *
                  <input
                    required
                    value={supplierReference}
                    onChange={(event) => setSupplierReference(event.target.value)}
                    placeholder="Nº Factura Fornecedor"
                    className="mt-0.5 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-1.5 print:p-1 font-mono dark:bg-[#282c2e]"
                  />
                </label>
                <label className="text-xs print:text-[9px] font-bold uppercase text-[#737780]">
                  Guia de Requisição
                  <input
                    value={requisitionNo}
                    onChange={(event) => setRequisitionNo(event.target.value)}
                    placeholder="Nº Requisição"
                    className="mt-0.5 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-1.5 print:p-1 font-mono dark:bg-[#282c2e]"
                  />
                </label>
              </div>

              <div>
                <label className="text-xs print:text-[9px] font-bold uppercase text-[#737780]">
                  Condição de Pagamento
                  <select
                    value={term}
                    onChange={(event) => setTerm(event.target.value)}
                    className="mt-0.5 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-1.5 print:p-1 dark:bg-[#282c2e]"
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
          </div>

          {/* Item entry input row - Hidden in print mode */}
          <div className="grid items-end gap-2 md:grid-cols-[1fr_100px_140px_100px_auto] print:hidden bg-[#0000aa]/5 dark:bg-[#282c2e] p-2 rounded border border-[#c3c6d1] dark:border-[#43474f]">
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
                renderLabel={(a) => `[${a.code}] ${a.description} - Custo: ${a.costPrice.toFixed(2)} MZN`}
                placeholder="Pesquisar artigo…"
                className="mt-1"
              />
            </label>
            <label className="text-xs font-bold uppercase text-[#737780]">
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
                    if (costInputRef.current) {
                      costInputRef.current.focus();
                      costInputRef.current.select();
                    } else {
                      addItem();
                    }
                  }
                }}
                placeholder="Ex: 10"
                className="mt-1 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-1.5 text-right font-bold bg-yellow-100 dark:bg-[#1f2325] text-black dark:text-white"
              />
            </label>
            <label className="text-xs font-bold uppercase text-[#737780]">
              Custo sem IVA
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
                    addItem();
                  }
                }}
                placeholder="Ex: 2500.00"
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
                onChange={(event) => setPurchaseTaxRate(Number(event.target.value))}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addItem();
                  }
                }}
                className="mt-1 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-1.5 text-center font-bold dark:bg-[#282c2e]"
              />
            </label>
            <button
              type="button"
              onClick={addItem}
              className="add-btn rounded bg-[#003366] px-4 py-2 text-xs font-bold uppercase text-white hover:bg-blue-800"
            >
              Adicionar
            </button>
          </div>

          {/* Table of added purchase items */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs print:text-[10px] border-collapse">
              <thead className="bg-[#f3f4f5] text-xs print:text-[9px] uppercase dark:bg-[#282c2e] font-bold border-b border-[#c3c6d1]">
                <tr>
                  <th className="p-2 print:py-1 print:px-1.5 text-left">Artigo</th>
                  <th className="p-2 print:py-1 print:px-1.5 text-right">Qtd.</th>
                  <th className="p-2 print:py-1 print:px-1.5 text-right">Custo</th>
                  <th className="p-2 print:py-1 print:px-1.5 text-right">Total c/ IVA</th>
                  <th className="p-2 print:hidden text-center">Acção</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f] font-mono">
                {items.map((item, index) => (
                  <tr key={`${item.articleId}-${index}`}>
                    <td className="p-2 print:py-1 print:px-1.5 font-sans font-medium">{item.code} — {item.description}</td>
                    <td className="p-2 print:py-1 print:px-1.5 text-right font-bold">{item.quantity}</td>
                    <td className="p-2 print:py-1 print:px-1.5 text-right">{formatMZN(item.unitCost)}</td>
                    <td className="p-2 print:py-1 print:px-1.5 text-right font-bold text-[#006e25]">{formatMZN(item.total)}</td>
                    <td className="p-2 print:hidden text-center">
                      <button onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-red-700 font-bold hover:underline text-xs">
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400 font-sans italic text-xs print:hidden">
                      Nenhum artigo inserido. Seleccione o artigo acima para registar a compra.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm font-bold text-red-700 print:hidden">{error}</p>}

          <div className="flex items-center justify-end gap-4 border-t border-[#c3c6d1] dark:border-[#43474f] pt-2">
            <strong className="font-mono text-xl print:text-base text-[#006e25]">TOTAL COMPRA: {formatMZN(total)}</strong>
            <button
              disabled={saving || (items.length === 0 && (!quantityStr || Number(quantityStr) <= 0))}
              onClick={() => void saveInvoice()}
              className="rounded bg-[#006e25] px-5 py-2.5 text-xs font-bold uppercase text-white disabled:opacity-50 hover:bg-green-700 print:hidden"
            >
              {saving ? 'A confirmar…' : 'Gravar Fatura (F2)'}
            </button>
          </div>
        </section>
      )}

      {!canCreate && <p className="rounded border bg-white p-4 text-sm print:hidden">O seu perfil permite consultar compras, mas não criar ou confirmar facturas.</p>}

      {/* Supplier Document History List - Hidden when printing current purchase */}
      <section className="overflow-hidden rounded-lg border border-[#c3c6d1] bg-white dark:border-[#43474f] dark:bg-[#1f2325] pb-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between border-b p-4 gap-2">
          <h3 className="font-bold text-xs uppercase">Documentos de fornecedor</h3>
          <div className="flex items-center space-x-2 text-xs font-bold">
            <span>Filtrar por Data:</span>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded border p-1 font-normal dark:bg-[#282c2e]"
            />
            {dateFilter && (
              <button onClick={() => setDateFilter('')} className="text-red-600 hover:underline text-xs">Ver Todos</button>
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
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-right">Pendente</th>
                <th className="p-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
              {supplierDocuments.map((document) => (
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
                      <button disabled={payingId === document.id} onClick={() => void payInvoice(document)} className="rounded bg-[#003366] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50 hover:bg-blue-800">
                        {payingId === document.id ? 'A pagar…' : 'Pagar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {supplierDocuments.length === 0 && <p className="p-6 text-center text-sm text-[#737780]">Sem documentos de fornecedor para a data selecionada.</p>}
      </section>

      {/* Bottom Status Bar */}
      <div className="flex flex-col gap-2 rounded border border-[#c3c6d1] bg-[#e7e8e9] px-4 py-2 text-xs font-mono font-bold shadow-sm dark:border-[#43474f] dark:bg-[#282c2e] sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex flex-wrap items-center gap-3 text-[#191c1d] dark:text-white">
          <button
            type="button"
            onClick={resetForm}
            className="rounded border border-slate-300 bg-slate-100 dark:border-slate-600 dark:bg-slate-700 px-2.5 py-1 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer"
            title="Limpar formulário e cancelar entrada atual"
          >
            ESC=Sair
          </button>
          <button
            type="button"
            onClick={() => void saveInvoice()}
            disabled={saving || (items.length === 0 && (!quantityStr || Number(quantityStr) <= 0))}
            className="rounded bg-[#003366] px-3 py-1 text-white hover:bg-blue-800 disabled:opacity-50 transition-colors cursor-pointer"
            title="Gravar factura de compra"
          >
            F2=Gravar
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="rounded border border-slate-300 bg-slate-100 dark:border-slate-600 dark:bg-slate-700 px-2.5 py-1 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer"
            title="Iniciar nova entrada de factura de compra"
          >
            F5=Novo
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded bg-[#003366] px-3 py-1 text-white hover:bg-blue-800 transition-colors cursor-pointer"
            title="Imprimir ecrã"
          >
            F9=Imp
          </button>
        </div>
        <div className="text-[#737780] text-[11px]">
          Fatura de Fornecedor | Itens: <b>{items.length}</b> | Total: <b className="text-[#191c1d] dark:text-white">{formatMZN(total)}</b>
        </div>
      </div>
    </div>
  );
};
export { Purchases as PurchasesPage };
export default Purchases;
