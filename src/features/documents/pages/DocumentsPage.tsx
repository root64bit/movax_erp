import { useEffect, useMemo, useState } from 'react';
import type { Article, DocumentRecord, SaleInvoice, SaleItem } from '@/shared/types/domain.types';
import { formatMZN } from '@/shared/utils/formatters';
import { Pagination } from '@/components/Pagination';
import { calculateOffset } from '@/shared/utils/pagination';
import { DocumentsService } from '../services/documents.service';
import { ArticleSearchSelect } from '@/features/inventory/components/ArticleSearchSelect';
import { requireSupabase } from '@/integrations/supabase/client';
import { calculateDocumentLine, calculateDocumentTotals, recalculateSaleItem, recalculateSaleItems } from '@/lib/documentCalculations';

interface DocumentsProps {
  documents: DocumentRecord[];
  sales: SaleInvoice[];
  articles?: Article[];
  onPrint: (sale: SaleInvoice) => void;
  onPrintRecord: (document: DocumentRecord) => void;
  canCancelAdvice?: boolean;
  onCancelAdvice?: (documentId: string, reason: string) => Promise<void>;
  canCancelDocument?: boolean;
  onCancelDocument?: (documentId: string, reason: string) => Promise<void>;
  onUpdateDocument?: (documentId: string, payload: { documentDate?: string; clientName?: string; clientNuit?: string; clientAddress?: string; grandTotal?: number; notes?: string; items?: SaleItem[]; generalDiscount?: number; keepAsWalkIn?: boolean }) => Promise<void>;
  permissions?: string[];
}

export function Documents({
  documents,
  sales,
  articles = [],
  onPrint,
  onPrintRecord,
  canCancelAdvice,
  onCancelAdvice,
  canCancelDocument,
  onCancelDocument,
  onUpdateDocument,
  permissions = [],
}: DocumentsProps) {
  const isCashier = permissions.length > 0 && !permissions.includes('settings.manage') && !permissions.includes('products.view');

  const [search, setSearch] = useState('');
  const [partyType, setPartyType] = useState<'ALL' | 'CUSTOMER' | 'SUPPLIER'>('ALL');
  const [status, setStatus] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Cancel Modal State
  const [cancellingDoc, setCancellingDoc] = useState<DocumentRecord | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);
  const [cancelError, setCancelError] = useState('');

  // Edit Modal State
  const [editingDoc, setEditingDoc] = useState<DocumentRecord | null>(null);
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
  const [editingDateOnlyDoc, setEditingDateOnlyDoc] = useState<DocumentRecord | null>(null);
  const [editDateOnlyValue, setEditDateOnlyValue] = useState('');
  const [editDateOnlyError, setEditDateOnlyError] = useState('');
  const [isSavingDateOnly, setIsSavingDateOnly] = useState(false);

  // Auto-sync editGrandTotal when editItems changes
  useEffect(() => {
    if (editingDoc) {
      setEditGrandTotal(calculateDocumentTotals(editItems, editGeneralDiscount).grandTotal);
    }
  }, [editItems, editGeneralDiscount, editingDoc]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [serverDocuments, setServerDocuments] = useState<DocumentRecord[]>([]);
  const [serverDocumentsTotal, setServerDocumentsTotal] = useState(0);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // 300ms Debounce on text search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadDocuments = async () => {
    try {
      setLoadingDocuments(true);
      const offset = calculateOffset(page, pageSize);
      const res = await DocumentsService.fetchDocumentsPage({
        limit: pageSize,
        offset,
        search: debouncedSearch || undefined,
        partyType: partyType !== 'ALL' ? partyType : undefined,
        status: status !== 'ALL' ? status : undefined,
        typeCode: typeFilter !== 'ALL' ? typeFilter : undefined,
        isCashier,
      });
      setServerDocuments(res.rows);
      setServerDocumentsTotal(res.totalCount);
    } catch {
      // Graceful fallback to passed documents prop if offline or testing
      const term = (debouncedSearch || '').toLowerCase();
      const fallbackList = (documents || []).filter((d) => {
        const matches =
          !term ||
          d.displayNumber.toLowerCase().includes(term) ||
          d.partyName.toLowerCase().includes(term) ||
          (d.partyCode && d.partyCode.toLowerCase().includes(term)) ||
          d.typeName.toLowerCase().includes(term);
        return (
          matches &&
          (partyType === 'ALL' || d.partyType === partyType) &&
          (status === 'ALL' || d.status === status) &&
          (typeFilter === 'ALL' || d.typeName === typeFilter || d.typeCode === typeFilter)
        );
      });
      setServerDocuments(fallbackList.slice(0, pageSize));
      setServerDocumentsTotal(fallbackList.length);
    } finally {
      setLoadingDocuments(false);
    }
  };

  useEffect(() => {
    void loadDocuments();
  }, [debouncedSearch, partyType, status, typeFilter, page, pageSize, isCashier]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, partyType, status, typeFilter, pageSize]);

  const handleExecuteCancel = async () => {
    if (!cancellingDoc || !cancelReason.trim() || isSubmittingCancel) return;
    try {
      setIsSubmittingCancel(true);
      setCancelError('');
      const isAdvice = cancellingDoc.typeCode === 'CUSTOMER_CREDIT_NOTE' || cancellingDoc.typeCode === 'SUPPLIER_CREDIT_ADVICE';
      if (isAdvice) {
        if (!onCancelAdvice) return;
        await onCancelAdvice(cancellingDoc.id, cancelReason.trim());
      } else {
        if (!onCancelDocument) return;
        await onCancelDocument(cancellingDoc.id, cancelReason.trim());
      }
      setCancellingDoc(null);
      setCancelReason('');
    } catch (err: any) {
      setCancelError(err?.message || 'Falha ao cancelar a nota de crédito.');
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  const handleOpenEdit = async (doc: DocumentRecord) => {
    // Try to find matching sale with items - use multiple strategies
    let printable = sales.find((s) => s.id === doc.id);
    if (!printable) {
      printable = sales.find((s) => s.docNumber === doc.displayNumber);
    }
    if (!printable) {
      // Fallback: partial match
      printable = sales.find((s) => s.docNumber?.includes(doc.displayNumber) || doc.displayNumber?.includes(s.docNumber));
    }
    console.log('📝 handleOpenEdit:', { docId: doc.id, displayNumber: doc.displayNumber, foundSale: !!printable, itemCount: printable?.items?.length ?? 0 });

    const gTotal = doc.grandTotal || printable?.totalAmount || 0;
    let loadedItems: SaleItem[] = printable?.items && printable.items.length > 0 ? JSON.parse(JSON.stringify(printable.items)) : [];

    // If loadedItems is empty, fetch document_lines directly from Supabase
    if (loadedItems.length === 0) {
      try {
        const client = requireSupabase();
        const { data: dbLines } = await client
          .from('document_lines')
          .select('*')
          .eq('document_id', doc.id);

        if (dbLines && dbLines.length > 0) {
          loadedItems = dbLines.map((line: any) => {
            const qty = Number(line.quantity) || 1;
            const tot = Number(line.total_amount) || 0;
            const discountAmount = Number(line.discount_amount) || 0;
            const disc = Number(line.discount_percentage) || 0;
            const taxRate = Number(line.tax_rate_snapshot) || 16;
            const priceWithIva = (tot > 0 && qty > 0)
              ? Math.round(((tot + discountAmount) / qty) * 100) / 100
              : Math.round(Number(line.unit_price) * (1 + taxRate / 100) * 100) / 100;

            return {
              articleId: line.product_id ?? line.id,
              code: line.product_code_snapshot ?? 'DIV',
              description: line.description_snapshot || 'Artigo / Serviço',
              quantity: qty,
              unitPrice: priceWithIva,
              discountPercent: disc,
              discountAmount,
              ivaPercent: taxRate,
              total: tot > 0 ? tot : calculateDocumentLine({ quantity: qty, unitPrice: priceWithIva, discountAmount, discountPercent: disc, ivaPercent: taxRate }).totalWithTax,
              lineType: line.product_id ? 'STOCK' : 'MANUAL',
              stockEffectEnabled: Boolean(line.stock_effect_enabled),
            };
          });
        }
      } catch (err) {
        console.error('Error fetching lines directly:', err);
      }
    }

    // Final fallback: if STILL empty, create 1 editable item row so editItems is NEVER empty!
    if (loadedItems.length === 0) {
      loadedItems = [{
        articleId: `custom-${Date.now()}`,
        code: 'DIV',
        description: 'Artigo / Serviço Geral',
        quantity: 1,
        unitPrice: gTotal,
        discountPercent: 0,
        discountAmount: 0,
        ivaPercent: 16,
        total: gTotal,
        lineType: 'MANUAL',
        stockEffectEnabled: false,
      }];
    }

    // Populate all modal state BEFORE opening modal
    setEditClientName(printable?.clientName || doc.partyName || '');
    setEditDocumentDate((printable?.date || doc.date || new Date().toISOString()).slice(0, 10));
    setEditClientNuit(printable?.clientNuit || '');
    setEditClientAddress(printable?.clientAddress || '');
    setEditNotes(printable?.notes || '');
    const lineDiscount = loadedItems.reduce((sum, item) => sum + (item.discountAmount || 0), 0);
    setEditGeneralDiscount(printable?.generalDiscountAmount ?? Math.max(0, (printable?.descontoTotal || 0) - lineDiscount));
    setEditKeepAsWalkIn(false);
    setEditError('');
    setEditItems(recalculateSaleItems(loadedItems));

    const calculatedGrand = loadedItems.reduce((acc, it) => acc + (it.total || 0), 0);
    setEditGrandTotal(calculatedGrand > 0 ? Math.round(calculatedGrand * 100) / 100 : gTotal);

    // Open modal LAST when all data is ready
    setEditingDoc(doc);
  };

  const handleExecuteSaveEdit = async () => {
    if (!editingDoc || !onUpdateDocument || isSavingEdit) return;
    if (editItems.length === 0) {
      setEditError('O documento deve manter pelo menos um artigo ou serviço.');
      return;
    }
    try {
      setIsSavingEdit(true);
      setEditError('');
      await onUpdateDocument(editingDoc.id, {
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
      setEditingDoc(null);
    } catch (err: any) {
      setEditError(err?.message || 'Falha ao guardar alterações do documento.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleSaveDateOnly = async () => {
    if (!editingDateOnlyDoc || !editDateOnlyValue || !onUpdateDocument || isSavingDateOnly) return;
    try {
      setIsSavingDateOnly(true);
      setEditDateOnlyError('');
      await onUpdateDocument(editingDateOnlyDoc.id, { documentDate: editDateOnlyValue });
      setEditingDateOnlyDoc(null);
    } catch (err: any) {
      setEditDateOnlyError(err?.message || 'Falha ao alterar a data do documento.');
    } finally {
      setIsSavingDateOnly(false);
    }
  };

  return (
    <div className="space-y-5 font-sans">
      <section className="rounded border border-[#c3c6d1] bg-white p-4 shadow-sm dark:border-[#43474f] dark:bg-[#1f2325]">
        <div className="grid gap-3 md:grid-cols-5">
          <label className="md:col-span-2">
            <span className="mb-1 block text-xs font-bold uppercase text-[#737780]">
              Pesquisar documentos
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Número, cliente, fornecedor ou tipo"
              className="w-full rounded border border-[#c3c6d1] bg-white p-2 text-sm dark:border-[#43474f] dark:bg-[#282c2e]"
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-bold uppercase text-[#737780]">Entidade</span>
            <select
              value={partyType}
              onChange={(e) => setPartyType(e.target.value as any)}
              className="w-full rounded border border-[#c3c6d1] bg-white p-2 text-sm dark:border-[#43474f] dark:bg-[#282c2e]"
            >
              <option value="ALL">Todas</option>
              <option value="CUSTOMER">Clientes</option>
              <option value="SUPPLIER">Fornecedores</option>
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-bold uppercase text-[#737780]">Estado</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded border border-[#c3c6d1] bg-white p-2 text-sm dark:border-[#43474f] dark:bg-[#282c2e]"
            >
              <option value="ALL">Todos os estados</option>
              <option value="CONFIRMED">Confirmado</option>
              <option value="PAID">Pago</option>
              <option value="PARTIALLY_PAID">Parcialmente Pago</option>
              <option value="CANCELLED">Cancelado</option>
              <option value="REVERSED">Anulado</option>
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-bold uppercase text-[#737780]">Tipo de Documento</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full rounded border border-[#c3c6d1] bg-white p-2 text-sm dark:border-[#43474f] dark:bg-[#282c2e]"
            >
              {isCashier ? (
                <>
                  <option value="ALL">Todas (Guia de Remessa & Cotações)</option>
                  <option value="CUSTOMER_DELIVERY_NOTE">Guia de Remessa</option>
                  <option value="CUSTOMER_QUOTATION">Cotação</option>
                </>
              ) : (
                <>
                  <option value="ALL">Todos os tipos</option>
                  <option value="CUSTOMER_INVOICE">Factura a Cliente</option>
                  <option value="CASH_SALE">Venda a Dinheiro</option>
                  <option value="CUSTOMER_DELIVERY_NOTE">Guia de Remessa</option>
                  <option value="CUSTOMER_QUOTATION">Cotação</option>
                  <option value="CUSTOMER_CREDIT_NOTE">Nota de Crédito a Cliente</option>
                  <option value="SUPPLIER_INVOICE">Factura de Fornecedor</option>
                  <option value="SUPPLIER_CREDIT_ADVICE">Nota de Crédito de Fornecedor</option>
                </>
              )}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded border border-[#c3c6d1] bg-white shadow-sm dark:border-[#43474f] dark:bg-[#1f2325]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#e7e8e9] font-bold uppercase text-[#191c1d] dark:bg-[#282c2e] dark:text-[#e1e2e4]">
              <tr>
                <th className="p-3">Nº Documento</th>
                <th className="p-3">Data</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Entidade</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-right">Pago</th>
                <th className="p-3 text-right">Pendente</th>
                <th className="p-3 text-center">Estado</th>
                <th className="p-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
              {loadingDocuments ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-sm text-[#737780]">
                    A carregar documentos...
                  </td>
                </tr>
              ) : (
                serverDocuments.map((document) => {
                  const printable = sales.find((sale) => sale.id === document.id);
                  const isAdviceDoc = document.typeCode === 'CUSTOMER_CREDIT_NOTE' || document.typeCode === 'SUPPLIER_CREDIT_ADVICE';
                  const canCancelThisDoc = canCancelAdvice && isAdviceDoc && document.status === 'CONFIRMED';
                  const isOperationalSalesDoc = ['CUSTOMER_INVOICE','CASH_SALE','CUSTOMER_DELIVERY_NOTE','CUSTOMER_QUOTATION','QUOTATION','COT'].includes(document.typeCode);
                  const canAdminCancelThisDoc = canCancelDocument && isOperationalSalesDoc && ['CONFIRMED','PAID','PARTIALLY_PAID','OVERDUE'].includes(document.status);
                  const formattedDate = document.date ? document.date.substring(0, 10) : '—';

                  return (
                    <tr key={document.id} className="hover:bg-[#f3f4f5] dark:hover:bg-[#282c2e]">
                      <td className="p-3 font-mono font-bold text-[#003366] dark:text-[#a7c8ff]">
                        {document.displayNumber}
                      </td>
                      <td className="p-3 font-mono text-slate-700 dark:text-slate-300">
                        {formattedDate}
                      </td>
                      <td className="p-3 font-bold">
                        {document.typeCode === 'CUSTOMER_INVOICE'
                          ? 'Factura (FT)'
                          : document.typeCode === 'CASH_SALE'
                          ? 'Venda a Dinheiro (VD)'
                          : document.typeCode === 'CUSTOMER_DELIVERY_NOTE'
                          ? 'Guia de Remessa (GR)'
                          : document.typeCode === 'CUSTOMER_QUOTATION' || document.typeCode === 'QUOTATION' || document.typeCode === 'COT'
                          ? 'Cotação'
                          : document.typeCode === 'SUPPLIER_INVOICE'
                          ? 'Factura de Fornecedor'
                          : document.typeCode === 'CUSTOMER_CREDIT_NOTE'
                          ? 'Nota de Crédito (NC)'
                          : document.typeName || document.typeCode}
                      </td>
                      <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                        {document.partyName || 'Cliente Pontual'}
                      </td>
                      <td className="p-3 text-right font-mono font-bold">{formatMZN(document.grandTotal)}</td>
                      <td className="p-3 text-right font-mono text-[#006e25]">{formatMZN(document.paidAmount)}</td>
                      <td className="p-3 text-right font-mono font-bold text-[#ba1a1a]">{formatMZN(document.outstandingAmount)}</td>
                      <td className="p-3 text-center">
                        <span
                          className={`rounded px-2 py-1 text-[10px] font-black ${
                            ['CONFIRMED', 'PAID'].includes(document.status)
                              ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'
                              : document.status === 'PARTIALLY_PAID'
                              ? 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-300'
                              : ['CANCELLED', 'REVERSED'].includes(document.status)
                              ? 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-300'
                              : 'bg-[#e7e8e9] text-[#43474f] dark:bg-[#333739] dark:text-[#c3c6d1]'
                          }`}
                        >
                          {document.status === 'CONFIRMED' || document.status === 'PAID'
                            ? 'Emitido / Liquidado'
                            : document.status === 'PARTIALLY_PAID'
                            ? 'Parcialmente Pago'
                            : document.status === 'CANCELLED' || document.status === 'REVERSED'
                            ? 'Anulado'
                            : document.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex min-w-[168px] flex-wrap items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => printable ? onPrint(printable) : onPrintRecord(document)}
                            className="inline-flex h-8 min-w-[78px] items-center justify-center rounded bg-[#003366] px-3 font-bold text-white text-[11px] hover:bg-[#002244]"
                          >
                            Imprimir
                          </button>

                          {!['CANCELLED','REVERSED'].includes(document.status) && isOperationalSalesDoc && (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(document)}
                              className="inline-flex h-8 min-w-[78px] items-center justify-center rounded bg-amber-600 px-3 font-bold text-white text-[11px] hover:bg-amber-700 transition-colors"
                            >
                              Editar
                            </button>
                          )}

                          {!['CANCELLED','REVERSED'].includes(document.status) && !isOperationalSalesDoc && onUpdateDocument && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingDateOnlyDoc(document);
                                setEditDateOnlyValue((document.date || new Date().toISOString()).slice(0,10));
                                setEditDateOnlyError('');
                              }}
                              className="inline-flex h-8 min-w-[78px] items-center justify-center rounded bg-amber-600 px-3 font-bold text-white text-[11px] hover:bg-amber-700 transition-colors"
                            >
                              Editar Data
                            </button>
                          )}

                          {canCancelThisDoc && (
                            <button
                              type="button"
                              onClick={() => {
                                setCancellingDoc(document);
                                setCancelReason('');
                                setCancelError('');
                              }}
                              className="inline-flex h-8 min-w-[78px] items-center justify-center rounded bg-red-700 px-3 font-bold text-white text-[11px] hover:bg-red-800"
                            >
                              Cancelar
                            </button>
                          )}
                          {canAdminCancelThisDoc && (
                            <button
                              type="button"
                              onClick={() => {
                                setCancellingDoc(document);
                                setCancelReason('');
                                setCancelError('');
                              }}
                              className="inline-flex h-8 min-w-[78px] items-center justify-center rounded bg-red-700 px-3 font-bold text-white text-[11px] hover:bg-red-800"
                            >
                              Anular
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
              {!loadingDocuments && serverDocuments.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-sm text-[#737780]">
                    Nenhum documento corresponde aos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-[#c3c6d1] bg-slate-50/70 px-3 dark:border-[#43474f] dark:bg-[#1b2023]">
          <Pagination
            currentPage={page}
            totalItems={serverDocumentsTotal}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[15, 25, 50, 100]}
          />
        </div>
      </section>

      {/* Cancellation Modal */}
      {cancellingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-lg border bg-white p-6 shadow-2xl dark:bg-[#1f2325] dark:border-[#43474f] space-y-4">
            <div className="flex items-center space-x-2 border-b pb-3 text-red-700 dark:text-red-400">
              <span className="material-symbols-outlined text-2xl">cancel</span>
              <h3 className="font-black text-sm uppercase tracking-wide">
                Anular Documento {cancellingDoc.displayNumber}
              </h3>
            </div>

            {cancelError && (
              <div className="p-3 rounded bg-red-100 border border-red-300 text-red-800 font-bold text-xs">
                ⚠️ {cancelError}
              </div>
            )}

            <div className="space-y-2 text-xs font-mono bg-slate-50 dark:bg-[#282c2e] p-3 rounded border">
              <div>Documento: <b>{cancellingDoc.displayNumber}</b></div>
              <div>Entidade: <b>{cancellingDoc.partyName}</b></div>
              <div>Total: <b>{formatMZN(cancellingDoc.grandTotal)}</b></div>
              <div className="text-red-700 dark:text-red-300">O número e o histórico serão preservados. Se houver stock, será devolvido automaticamente.</div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                Motivo Obrigatório de Cancelamento *
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ex: Emissão por lapso, erro de cálculo..."
                className="w-full rounded border p-2 text-xs font-sans dark:bg-[#282c2e]"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                disabled={isSubmittingCancel}
                onClick={() => setCancellingDoc(null)}
                className="px-4 py-2 rounded border font-bold text-xs uppercase hover:bg-slate-100 dark:hover:bg-[#282c2e]"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={!cancelReason.trim() || isSubmittingCancel}
                onClick={handleExecuteCancel}
                className="px-4 py-2 rounded bg-red-700 hover:bg-red-800 text-white font-black text-xs uppercase shadow disabled:opacity-50"
              >
                {isSubmittingCancel ? 'A Reverter...' : 'Confirmar Anulação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingDateOnlyDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-lg border bg-white p-6 shadow-2xl dark:bg-[#1f2325] dark:border-[#43474f] space-y-4">
            <h3 className="border-b pb-3 font-black text-sm uppercase text-[#003366] dark:text-[#a7c8ff]">
              Alterar Data — {editingDateOnlyDoc.displayNumber}
            </h3>
            {editDateOnlyError && <div role="alert" className="rounded bg-red-50 p-3 text-xs font-bold text-red-700">{editDateOnlyError}</div>}
            <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
              Data de Emissão *
              <input type="date" value={editDateOnlyValue} onChange={(event) => setEditDateOnlyValue(event.target.value)} className="mt-1 w-full rounded border p-2 font-mono dark:bg-[#282c2e]" />
            </label>
            <p className="text-xs text-slate-600 dark:text-slate-300">O número do documento e o histórico de auditoria serão mantidos.</p>
            <div className="flex justify-end gap-2 border-t pt-3">
              <button type="button" disabled={isSavingDateOnly} onClick={() => setEditingDateOnlyDoc(null)} className="rounded border px-4 py-2 text-xs font-bold">Cancelar</button>
              <button type="button" disabled={isSavingDateOnly || !editDateOnlyValue} onClick={() => void handleSaveDateOnly()} className="rounded bg-[#003366] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
                {isSavingDateOnly ? 'A guardar…' : 'Gravar Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Document Modal */}
      {editingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border bg-white p-6 shadow-2xl dark:bg-[#1f2325] dark:border-[#43474f] space-y-4">
            <div className="flex items-center justify-between border-b pb-3 text-[#003366] dark:text-[#a7c8ff]">
              <div className="flex items-center space-x-2">
                <span className="material-symbols-outlined text-2xl">edit_note</span>
                <h3 className="font-black text-sm uppercase tracking-wide">
                  Editar Documento {editingDoc.displayNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingDoc(null)}
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
                Manter como Cliente Pontual (não criar ficha; guardar os dados apenas neste documento)
              </label>

              {/* Tabela de Edição de Artigos / Items & Prices */}
              <div className="space-y-2 border-t border-b py-3 dark:border-gray-700">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block font-black text-[#003366] dark:text-[#a7c8ff] uppercase text-xs">
                      Artigos / Itens do Documento ({editItems.length})
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
                        const art = articles.find(a => a.id === articleId);
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
                              stockEffectEnabled: true,
                            }
                          ];
                          setEditGrandTotal(calculateDocumentTotals(updated, editGeneralDiscount).grandTotal);
                          return updated;
                        });
                      }}
                      renderLabel={(a) => `[${a.code}] ${a.description} - ${(a.sellPriceWithIva || a.sellPrice).toFixed(2)} MZN (Stock: ${a.stock})`}
                      placeholder="🔍 Pesquisar artigo do catálogo..."
                      className="w-full"
                    />
                  )}
                </div>

                {editItems.length === 0 ? (
                  <div className="text-center py-3 text-gray-400 italic text-xs border rounded border-dashed">
                    Nenhum artigo no documento. Pesquise no catálogo ou clique em "+ Artigo Manual".
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
                              value={item.ivaPercent || 16}
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                    Valor Total do Documento (MZN) *
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
                  placeholder="Adicionar notas adicionais ao documento..."
                  className="w-full rounded border border-gray-300 p-2 dark:bg-[#282c2e] dark:border-gray-600 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 border-t pt-3">
              <button
                type="button"
                onClick={() => setEditingDoc(null)}
                className="rounded border border-gray-300 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSavingEdit || !editDocumentDate || !editClientName.trim() || editItems.length === 0}
                onClick={handleExecuteSaveEdit}
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
}
export { Documents as DocumentsPage };
export default Documents;
