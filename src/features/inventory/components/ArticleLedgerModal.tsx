import React, { useMemo, useEffect, useState } from 'react';
import type { Article, StockMovement, DocumentRecord, SaleInvoice } from '@/shared/types/domain.types';
import { formatMZN } from '@/shared/utils/formatters';
import { InventoryService, type StockExtractResult } from '../services/inventory.service';
import { Pagination } from '@/components/Pagination';

interface ArticleLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: Article | null;
  articles: Article[];
  movements: StockMovement[];
  sales?: SaleInvoice[];
  documents?: DocumentRecord[];
  onSelectArticleId?: (id: string) => void;
  onOpenDocument?: (doc: DocumentRecord) => void;
  canViewCost?: boolean;
}

function formatDocTypeName(code?: string, fallbackName?: string): string {
  if (!code && !fallbackName) return 'Documento';
  const c = (code || fallbackName || '').toUpperCase();
  if (c.includes('CUSTOMER_INVOICE') || c === 'FT' || c === 'INVOICE' || c.includes('FACTURA')) return 'Factura (FT)';
  if (c.includes('CASH_SALE') || c === 'VD' || c.includes('VENDA A DINHEIRO')) return 'Venda a Dinheiro (VD)';
  if (c.includes('CUSTOMER_DELIVERY_NOTE') || c === 'GR' || c.includes('DELIVERY_NOTE') || c.includes('GUIA DE REMESSA')) return 'Guia de Remessa (GR)';
  if (c.includes('SUPPLIER_INVOICE') || c.includes('FACTURA DE FORNECEDOR')) return 'Factura de Fornecedor';
  if (c.includes('CUSTOMER_RECEIPT') || c.includes('PAYMENT') || c === 'RECIBO') return 'Recibo';
  if (c.includes('CREDIT_NOTE') || c === 'NC' || c.includes('NOTA DE CRÉDITO')) return 'Nota de Crédito (NC)';
  return fallbackName || code || 'Documento';
}

function formatDocRefName(docRef?: string): string {
  if (!docRef) return '—';
  let formatted = docRef;
  formatted = formatted.replace(/CUSTOMER_INVOICE/g, 'Factura FT');
  formatted = formatted.replace(/CASH_SALE/g, 'Venda a Dinheiro VD');
  formatted = formatted.replace(/CUSTOMER_DELIVERY_NOTE/g, 'Guia de Remessa GR');
  formatted = formatted.replace(/SUPPLIER_INVOICE/g, 'Factura Fornecedor');
  formatted = formatted.replace(/CUSTOMER_RECEIPT/g, 'Recibo');
  formatted = formatted.replace(/CUSTOMER_CREDIT_NOTE/g, 'Nota de Crédito NC');
  formatted = formatted.replace(/CREDIT_NOTE/g, 'Nota de Crédito NC');
  return formatted;
}

export const ArticleLedgerModal: React.FC<ArticleLedgerModalProps> = ({
  isOpen,
  onClose,
  article,
  articles,
  movements,
  sales = [],
  documents = [],
  onSelectArticleId,
  onOpenDocument,
  canViewCost = true,
}) => {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState<'ALL' | 'ENTRADA' | 'SAIDA'>('ALL');
  const [searchCodeQuery, setSearchCodeQuery] = useState('');
  const [extractPage, setExtractPage] = useState(1);
  const [extractPageSize, setExtractPageSize] = useState(50);

  useEffect(() => {
    if (!isOpen) return;
    if (article) {
      setSearchCodeQuery(article.code);
      setDateFrom('');
      setDateTo('');
      setMovementTypeFilter('ALL');
      setExtractPage(1);
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'F9') {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, article, onClose]);

  const [serverExtract, setServerExtract] = useState<StockExtractResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !article) return;
    let cancelled = false;
    setLoading(true);
    InventoryService.fetchStockMovementExtract(
      article.id,
      dateFrom || undefined,
      dateTo || undefined,
      movementTypeFilter,
      extractPageSize,
      (extractPage - 1) * extractPageSize,
    )
      .then((res) => {
        if (!cancelled) setServerExtract(res);
      })
      .catch(() => {
        if (!cancelled) setServerExtract(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, article, dateFrom, dateTo, movementTypeFilter, extractPage, extractPageSize]);

  useEffect(() => { setExtractPage(1); }, [article?.id, dateFrom, dateTo, movementTypeFilter]);

  // Handle article lookup on Enter
  const handleCodeSearchEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchCodeQuery.trim()) {
      e.preventDefault();
      const clean = searchCodeQuery.trim().toLowerCase();
      const found = articles.find(
        (a) => a.code.toLowerCase() === clean || a.description.toLowerCase().includes(clean)
      );
      if (found && onSelectArticleId) {
        onSelectArticleId(found.id);
      }
    }
  };

  // Filter movements for selected article and date range
  const { articleMovements, initialBalance, totals } = useMemo(() => {
    if (!article) return { articleMovements: [], initialBalance: 0, totals: { entradasQty: 0, saidasQty: 0, entradasVal: 0, saidasVal: 0 } };

    if (serverExtract) {
      const mapped = serverExtract.movements.map((m) => {
        const matchedDoc = documents.find(
          (d) => (m.source_document_id && d.id === m.source_document_id) || d.displayNumber.toLowerCase() === m.doc_ref.toLowerCase()
        );
        return {
          id: m.id,
          rawDate: m.created_at,
          formattedDate: new Date(m.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          formattedTime: new Date(m.created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
          docRef: formatDocRefName(m.doc_ref),
          docType: formatDocTypeName(m.doc_type_code, m.doc_type_name),
          movementType: m.movement_direction,
          entradas: m.quantity_in,
          saidas: m.quantity_out,
          saldo: m.running_balance,
          unitCost: m.unit_cost,
          valor: m.movement_value,
          operator: m.operator_name,
          matchedDoc,
        };
      });

      return {
        articleMovements: mapped,
        initialBalance: serverExtract.opening_balance,
        totals: {
          entradasQty: serverExtract.totals.total_in_qty,
          saidasQty: serverExtract.totals.total_out_qty,
          entradasVal: serverExtract.totals.total_in_val,
          saidasVal: serverExtract.totals.total_out_val,
        },
      };
    }

    // Article matching helper (ID, Code, or Numeric equivalence)
    const isArticleMatch = (mId?: string, mCode?: string) => {
      if (!article) return false;
      if (mId && article.id && mId === article.id) return true;
      if (!mCode) return false;
      const cleanM = mCode.trim().toLowerCase();
      const cleanA = article.code.trim().toLowerCase();
      if (cleanM === cleanA) return true;
      const numM = parseInt(cleanM.replace(/\D/g, ''), 10);
      const numA = parseInt(cleanA.replace(/\D/g, ''), 10);
      if (!isNaN(numM) && !isNaN(numA) && numM === numA) return true;
      return false;
    };

    // Explicit movements matching this article
    const explicitMovs = movements.filter((m) => isArticleMatch(undefined, m.articleCode));

    // Derive additional exit movements from sales if missing from explicit movements
    const derivedSalesMovs: StockMovement[] = [];
    sales.forEach((sale) => {
      if (sale.status === 'Cancelada') return;
      sale.items.forEach((item) => {
        if (isArticleMatch(item.articleId, item.code)) {
          const alreadyExists = explicitMovs.some(
            (em) => em.docRef && sale.docNumber && em.docRef.includes(sale.docNumber)
          );
          if (!alreadyExists) {
            derivedSalesMovs.push({
              id: `sale-mov-${sale.id}-${item.code}`,
              type: 'saida',
              docRef: sale.docNumber,
              date: sale.date,
              articleCode: article.code,
              articleDescription: article.description,
              quantity: item.quantity,
              entityName: sale.clientName || 'Cliente Pontual',
              operator: sale.sellerName || 'Sistema',
              unitCost: item.unitPrice,
            });
          }
        }
      });
    });

    // Fallback: All movements for this specific article from props
    const allArticleMovs = [...explicitMovs, ...derivedSalesMovs].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate Saldo Anterior ao Período (movements strictly before dateFrom)
    let priorBal = 0;
    if (dateFrom) {
      const priorMovs = allArticleMovs.filter((m) => m.date.substring(0, 10) < dateFrom);
      priorBal = priorMovs.reduce((acc, m) => {
        const isEntrada = m.type === 'entrada';
        return acc + (isEntrada ? m.quantity : -m.quantity);
      }, 0);
    }

    // Filter movements within date range
    let inPeriod = allArticleMovs;
    if (dateFrom) {
      inPeriod = inPeriod.filter((m) => m.date.substring(0, 10) >= dateFrom);
    }
    if (dateTo) {
      inPeriod = inPeriod.filter((m) => m.date.substring(0, 10) <= dateTo);
    }
    if (movementTypeFilter !== 'ALL') {
      inPeriod = inPeriod.filter((m) => (movementTypeFilter === 'ENTRADA' ? m.type === 'entrada' : m.type === 'saida'));
    }

    let runningBalance = priorBal;
    let totalEntradasQty = 0;
    let totalSaidasQty = 0;
    let totalEntradasVal = 0;
    let totalSaidasVal = 0;

    const mapped = inPeriod.map((m) => {
      const isEntrada = m.type === 'entrada';
      const entradas = isEntrada ? m.quantity : 0;
      const saidas = isEntrada ? 0 : m.quantity;
      runningBalance = runningBalance + entradas - saidas;

      const unitCost = m.unitCost ?? article.costPrice;
      const valor = unitCost * m.quantity;

      if (isEntrada) {
        totalEntradasQty += entradas;
        totalEntradasVal += valor;
      } else {
        totalSaidasQty += saidas;
        totalSaidasVal += valor;
      }

      // Try matching document record for clickable modal
      const matchedDoc = documents.find(
        (d) => d.displayNumber.toLowerCase() === m.docRef?.toLowerCase() || d.id === m.docRef
      );

      return {
        id: m.id,
        rawDate: m.date,
        formattedDate: new Date(m.date).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        formattedTime: new Date(m.date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
        docRef: m.docRef || '—',
        docType: m.type === 'entrada' ? 'Entrada / Fact. Fornecedor' : 'Saída / Venda / Guia',
        movementType: isEntrada ? 'ENTRADA' : 'SAÍDA',
        entradas,
        saidas,
        saldo: runningBalance,
        unitCost,
        valor,
        operator: m.operator || 'Administrador',
        matchedDoc,
      };
    });

    return {
      articleMovements: mapped,
      initialBalance: priorBal,
      totals: {
        entradasQty: totalEntradasQty,
        saidasQty: totalSaidasQty,
        entradasVal: totalEntradasVal,
        saidasVal: totalSaidasVal,
      },
    };
  }, [article, movements, dateFrom, dateTo, movementTypeFilter, documents, serverExtract, sales]);

  if (!isOpen || !article) return null;

  const currentStockValuation = article.stock * article.costPrice;

  // CSV Export Function
  const exportCsv = () => {
    const headers = ['Data', 'Hora', 'Documento', 'Tipo Documento', 'Movimento', 'Entrada (UN)', 'Saída (UN)', 'Saldo (UN)', 'Custo Unit. (MZN)', 'Valor (MZN)', 'Utilizador'];
    const rows = articleMovements.map((m) => [
      m.formattedDate,
      m.formattedTime,
      `"${m.docRef.replace(/"/g, '""')}"`,
      `"${m.docType}"`,
      m.movementType,
      m.entradas.toFixed(3),
      m.saidas.toFixed(3),
      m.saldo.toFixed(3),
      canViewCost ? (Number(m.unitCost) || 0).toFixed(2) : '0.00',
      canViewCost ? (Number(m.valor) || 0).toFixed(2) : '0.00',
      `"${m.operator}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `extracto-stock-${article.code}-pagina-${extractPage}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const [isFullScreen, setIsFullScreen] = useState(false);

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/75 font-sans ${isFullScreen ? 'p-0' : 'p-4'}`}>
      <div className={`w-full flex flex-col overflow-hidden border border-[#c3c6d1] dark:border-[#43474f] bg-white dark:bg-[#1f2325] shadow-2xl transition-all ${
        isFullScreen ? 'h-full max-h-full rounded-none border-none' : 'max-w-5xl max-h-[92vh] rounded-lg'
      }`}>
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-[#c3c6d1] dark:border-[#43474f] bg-[#001e40] px-5 py-3 text-white">
          <div className="flex items-center space-x-3">
            <span className="material-symbols-outlined text-xl text-amber-400">history_edu</span>
            <h3 className="font-extrabold text-sm uppercase tracking-wider">
              Extracto de Movimentos de Stock — Ficha de Artigo
            </h3>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="text-white hover:text-yellow-300 flex items-center space-x-1 text-xs font-bold uppercase"
              title={isFullScreen ? 'Sair do modo Ecrã Inteiro' : 'Expandir modal para Ecrã Inteiro'}
            >
              <span className="material-symbols-outlined text-lg">
                {isFullScreen ? 'fullscreen_exit' : 'fullscreen'}
              </span>
              <span className="hidden sm:inline">{isFullScreen ? 'Sair Ecrã Inteiro' : 'Ecrã Inteiro'}</span>
            </button>
            <button onClick={onClose} className="text-white hover:text-red-400">
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        </div>

        {/* Article Summary & Filter Bar */}
        <div className="p-4 space-y-4 border-b border-[#c3c6d1] dark:border-[#43474f] bg-[#f3f4f5] dark:bg-[#282c2e]">
          {/* Article Info Cards */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="bg-[#003366] text-white px-2 py-0.5 rounded font-mono font-bold text-xs">
                  {article.code}
                </span>
                <h2 className="text-base font-black text-[#191c1d] dark:text-white uppercase">
                  {article.description}
                </h2>
              </div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Categoria: <b>{article.category || 'Geral'}</b> | Unidade: <b>{article.unit}</b>
              </p>
            </div>

            {/* Valuation Header Badges */}
            <div className="flex items-center space-x-3 font-mono text-xs">
              <div className="bg-white dark:bg-[#1f2325] p-2 rounded border border-[#c3c6d1] dark:border-[#43474f] text-center">
                <span className="text-[10px] text-slate-500 uppercase block">Existência Actual</span>
            <span className="font-extrabold text-sm text-[#006e25]">{(serverExtract?.current_stock ?? article.stock).toFixed(3)} UN</span>
              </div>
              {canViewCost && (
                <>
                  <div className="bg-white dark:bg-[#1f2325] p-2 rounded border border-[#c3c6d1] dark:border-[#43474f] text-center">
                    <span className="text-[10px] text-slate-500 uppercase block">Custo Médio Ponderado</span>
                    <span className="font-bold text-sm text-[#003366] dark:text-[#a7c8ff]">
                      {formatMZN(article.costPrice)}
                    </span>
                  </div>
                  <div className="bg-white dark:bg-[#1f2325] p-2 rounded border border-[#c3c6d1] dark:border-[#43474f] text-center">
                    <span className="text-[10px] text-slate-500 uppercase block">Valor Total em Stock</span>
                    <span className="font-black text-sm text-purple-700 dark:text-purple-300">
                      {formatMZN(currentStockValuation)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Filters Row */}
          <div className="grid grid-cols-12 gap-3 items-end text-xs">
            <div className="col-span-12 md:col-span-3">
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Pesquisar Código + Enter</label>
              <input
                type="text"
                placeholder="Código do Artigo..."
                value={searchCodeQuery}
                onChange={(e) => setSearchCodeQuery(e.target.value)}
                onKeyDown={handleCodeSearchEnter}
                className="w-full bg-white dark:bg-[#1f2325] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 font-mono font-bold"
              />
            </div>

            <div className="col-span-12 md:col-span-2">
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">De:</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full bg-white dark:bg-[#1f2325] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 font-mono text-xs"
              />
            </div>

            <div className="col-span-12 md:col-span-2">
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Até:</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full bg-white dark:bg-[#1f2325] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 font-mono text-xs"
              />
            </div>

            <div className="col-span-12 md:col-span-3">
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Tipo Movimento</label>
              <select
                value={movementTypeFilter}
                onChange={(e) => setMovementTypeFilter(e.target.value as any)}
                className="w-full bg-white dark:bg-[#1f2325] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 text-xs font-bold"
              >
                <option value="ALL">Todos os Movimentos</option>
                <option value="ENTRADA">Apenas Entradas</option>
                <option value="SAIDA">Apenas Saídas</option>
              </select>
            </div>

            <div className="col-span-12 md:col-span-2 flex space-x-2">
              <button
                type="button"
                onClick={() => { setDateFrom(''); setDateTo(''); setMovementTypeFilter('ALL'); }}
                className="w-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 font-bold p-2 rounded text-xs"
              >
                Limpar
              </button>
            </div>
          </div>
        </div>

        {loading && (
          <div className="border-b border-[#c3c6d1] bg-blue-50 px-4 py-2 text-center text-xs font-bold text-[#003366] dark:border-[#43474f] dark:bg-blue-950/30 dark:text-blue-200">
            A carregar movimentos…
          </div>
        )}

        {/* Movements Extract Table */}
        <div className="flex-1 overflow-y-auto p-4">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead className="bg-[#e7e8e9] dark:bg-[#282c2e] text-[#43474f] dark:text-[#c3c6d1] font-bold uppercase sticky top-0 border-b border-[#c3c6d1]">
              <tr>
                <th className="p-2.5">Data / Hora</th>
                <th className="p-2.5">Documento</th>
                <th className="p-2.5">Tipo Operação</th>
                <th className="p-2.5 text-center">Mov.</th>
                <th className="p-2.5 text-right text-green-700">Entrada</th>
                <th className="p-2.5 text-right text-red-700">Saída</th>
                <th className="p-2.5 text-right font-extrabold">Saldo</th>
                {canViewCost && <th className="p-2.5 text-right">Custo Un.</th>}
                {canViewCost && <th className="p-2.5 text-right">Valor Mov.</th>}
                <th className="p-2.5">Utilizador</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
              {/* Initial Balance Row for period filtering */}
              {dateFrom && (
                <tr className="bg-amber-50 dark:bg-amber-950/30 font-bold border-b border-amber-300">
                  <td className="p-2.5 text-amber-800 dark:text-amber-200">—</td>
                  <td className="p-2.5 text-amber-800 dark:text-amber-200" colSpan={2}>
                    SALDO ANTERIOR AO PERÍODO ({dateFrom})
                  </td>
                  <td className="p-2.5 text-center text-amber-800">—</td>
                  <td className="p-2.5 text-right text-amber-800">—</td>
                  <td className="p-2.5 text-right text-amber-800">—</td>
                  <td className="p-2.5 text-right font-black text-amber-900 dark:text-amber-200 text-sm">
                    {initialBalance.toFixed(3)}
                  </td>
                  {canViewCost && <td className="p-2.5 text-right text-amber-800">—</td>}
                  {canViewCost && <td className="p-2.5 text-right text-amber-800">—</td>}
                  <td className="p-2.5 text-amber-800">Sistema</td>
                </tr>
              )}

              {articleMovements.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 font-sans italic">
                    Nenhum movimento encontrado para os critérios seleccionados.
                  </td>
                </tr>
              ) : (
                articleMovements.map((row) => (
                  <tr key={row.id} className="hover:bg-[#f3f4f5] dark:hover:bg-[#282c2e] transition-colors">
                    <td className="p-2.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {row.formattedDate} <span className="text-[10px] text-slate-400">{row.formattedTime}</span>
                    </td>
                    <td className="p-2.5 font-bold">
                      {row.matchedDoc && onOpenDocument ? (
                        <button
                          type="button"
                          onClick={() => onOpenDocument(row.matchedDoc!)}
                          className="text-[#003366] dark:text-[#a7c8ff] hover:underline font-extrabold"
                          title="Clique para consultar o documento original em modo de leitura"
                        >
                          {row.docRef} 🔗
                        </button>
                      ) : (
                        <span className="text-[#003366] dark:text-[#a7c8ff]">{row.docRef}</span>
                      )}
                    </td>
                    <td className="p-2.5 font-sans text-xs text-slate-700 dark:text-slate-300">{row.docType}</td>
                    <td className="p-2.5 text-center">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                          row.movementType === 'ENTRADA'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {row.movementType}
                      </span>
                    </td>
                    <td className="p-2.5 text-right font-extrabold text-[#006e25]">
                      {row.entradas > 0 ? row.entradas.toFixed(3) : '—'}
                    </td>
                    <td className="p-2.5 text-right font-extrabold text-red-600">
                      {row.saidas > 0 ? row.saidas.toFixed(3) : '—'}
                    </td>
                    <td className="p-2.5 text-right font-black text-slate-900 dark:text-white text-sm">
                      {row.saldo.toFixed(3)}
                    </td>
                    {canViewCost && <td className="p-2.5 text-right text-slate-600">{formatMZN(row.unitCost)}</td>}
                    {canViewCost && (
                      <td className="p-2.5 text-right font-bold text-slate-800 dark:text-slate-200">
                        {formatMZN(row.valor)}
                      </td>
                    )}
                    <td className="p-2.5 font-sans text-xs text-slate-500">{row.operator}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <Pagination
            currentPage={extractPage}
            totalItems={serverExtract?.movement_count ?? articleMovements.length}
            pageSize={extractPageSize}
            onPageChange={setExtractPage}
            onPageSizeChange={setExtractPageSize}
            pageSizeOptions={[25, 50, 100, 200]}
          />
        </div>

        {/* Footer Summary & Action Bar */}
        <div className="border-t border-[#c3c6d1] dark:border-[#43474f] p-4 bg-[#f3f4f5] dark:bg-[#282c2e] flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
          <div className="flex flex-wrap items-center space-x-6">
            <span>
              Total Entradas: <b className="text-[#006e25]">{totals.entradasQty.toFixed(3)} UN</b>
              {canViewCost && <span className="text-slate-500"> ({formatMZN(totals.entradasVal)})</span>}
            </span>
            <span>
              Total Saídas: <b className="text-red-600">{totals.saidasQty.toFixed(3)} UN</b>
              {canViewCost && <span className="text-slate-500"> ({formatMZN(totals.saidasVal)})</span>}
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={exportCsv}
              title="Descarregar a página atual do extracto em formato CSV"
              className="px-3 py-1.5 bg-green-700 text-white font-bold rounded hover:bg-green-800 text-xs flex items-center space-x-1"
            >
              <span>📥 Exportar CSV</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-[#003366] text-white font-bold rounded hover:bg-blue-800 text-xs flex items-center space-x-1"
            >
              <span>🖨 Imprimir Extracto (F9)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-white font-bold rounded hover:bg-slate-400 text-xs"
            >
              Fechar (ESC)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
