import React, { useMemo, useState } from 'react';
import type { SaleInvoice, DocumentRecord, Article, Client } from '@/shared/types/domain.types';
import { Pagination } from '@/components/Pagination';
import { formatMZN } from '@/shared/utils/formatters';

export interface ReportsProps {
  permissions?: string[];
  sales?: SaleInvoice[];
  documents?: DocumentRecord[];
  articles?: Article[];
  clients?: Client[];
  suppliers?: import('@/shared/types/domain.types').Supplier[];
  movements?: import('@/shared/types/domain.types').StockMovement[];
  onPrintRecord?: (doc: DocumentRecord) => void;
  canViewCost?: boolean;
  canViewFinancial?: boolean;
  canViewStock?: boolean;
}

export const Reports: React.FC<ReportsProps> = ({
  permissions = [],
  sales = [],
  documents = [],
  articles = [],
  clients = [],
  suppliers = [],
  movements = [],
  onPrintRecord,
  canViewCost = true,
  canViewFinancial = true,
  canViewStock = true,
}) => {
  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [codeFrom, setCodeFrom] = useState('');
  const [codeTo, setCodeTo] = useState('');
  const [articleSearchQuery, setArticleSearchQuery] = useState('');

  // Custom PVR / PVP Calculation Formula Inputs & Column Toggles
  const [customMarginPct, setCustomMarginPct] = useState<number>(25); // Default 25% fixo/customizável
  const [customIvaPct, setCustomIvaPct] = useState<number>(16);      // Default 16% IVA fixo/customizável
  const [showCostColumn, setShowCostColumn] = useState<boolean>(true); // Ver/Esconder coluna Custo
  const [showPvpColumn, setShowPvpColumn] = useState<boolean>(true);  // Ver/Esconder coluna PVP
  const [showPvrColumn, setShowPvrColumn] = useState<boolean>(true);  // Ver/Esconder coluna PVR

  // Pagination
  const [reportsPage, setReportsPage] = useState(1);
  const [reportsPageSize, setReportsPageSize] = useState(25);

  // Clear all filters
  const handleClearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setCodeFrom('');
    setCodeTo('');
    setArticleSearchQuery('');
  };

  // Helper for Code Range matching (supports numeric and alphanumeric ranges)
  const matchCodeRange = (rawCode: string, from: string, to: string): boolean => {
    if (!from && !to) return true;
    const code = rawCode.startsWith('01') ? rawCode.substring(2) : rawCode;
    const cleanCode = code.trim().toLowerCase();
    const cleanFrom = from.startsWith('01') ? from.substring(2).trim().toLowerCase() : from.trim().toLowerCase();
    const cleanTo = to.startsWith('01') ? to.substring(2).trim().toLowerCase() : to.trim().toLowerCase();

    const numCode = parseInt(cleanCode.replace(/\D/g, ''), 10);
    const numFrom = cleanFrom ? parseInt(cleanFrom.replace(/\D/g, ''), 10) : null;
    const numTo = cleanTo ? parseInt(cleanTo.replace(/\D/g, ''), 10) : null;

    if (!isNaN(numCode) && ((numFrom !== null && !isNaN(numFrom)) || (numTo !== null && !isNaN(numTo)))) {
      if (numFrom !== null && !isNaN(numFrom) && numCode < numFrom) return false;
      if (numTo !== null && !isNaN(numTo) && numCode > numTo) return false;
      return true;
    }

    if (cleanFrom && cleanCode < cleanFrom) return false;
    if (cleanTo && cleanCode > cleanTo) return false;
    return true;
  };

  // Filter Sales Documents by Date Range
  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      if (sale.documentTypeCode === 'CUSTOMER_DELIVERY_NOTE') return false;
      if (sale.status === 'Cancelada') return false;

      const saleDateISO = sale.date ? sale.date.substring(0, 10) : '';
      if (dateFrom && saleDateISO < dateFrom) return false;
      if (dateTo && saleDateISO > dateTo) return false;

      return true;
    });
  }, [sales, dateFrom, dateTo]);

  // Aggregate Sales by Article (includes ALL catalog articles, even those without sales)
  const salesByArticle = useMemo(() => {
    // 1. Build map of sales per article code from filteredSales
    const salesMap = new Map<string, { quantity: number; netTotal: number }>();
    filteredSales.forEach((sale) => {
      if (sale.documentTypeCode === 'CUSTOMER_CREDIT_NOTE') return;

      (sale.items || []).forEach((item) => {
        const itemCodeKey = (item.code.startsWith('01') ? item.code.substring(2) : item.code).trim().toLowerCase();
        const existing = salesMap.get(itemCodeKey);
        if (existing) {
          existing.quantity += item.quantity;
          existing.netTotal += item.total;
        } else {
          salesMap.set(itemCodeKey, {
            quantity: item.quantity,
            netTotal: item.total,
          });
        }
      });
    });

    // 2. Map all articles in the catalog
    const articleCodeSet = new Set<string>();
    const result: Array<{
      code: string;
      description: string;
      quantity: number;
      netTotal: number;
      stockRestante: number;
      costPriceWithIva: number;
      costTotalWithIva: number;
      avgPrice: number;
      pvpTotalWithIva: number;
      pvrValue: number;
      pvrTotal: number;
    }> = [];

    articles.forEach((art) => {
      const displayCode = art.code.startsWith('01') ? art.code.substring(2) : art.code;
      const cleanCodeKey = displayCode.trim().toLowerCase();
      articleCodeSet.add(cleanCodeKey);

      // Filter by Code Range
      if (!matchCodeRange(displayCode, codeFrom, codeTo)) return;

      // Filter by Article Search Query
      if (articleSearchQuery.trim()) {
        const q = articleSearchQuery.trim().toLowerCase();
        const matchCode = displayCode.toLowerCase().includes(q);
        const matchDesc = art.description.toLowerCase().includes(q);
        if (!matchCode && !matchDesc) return;
      }

      const salesData = salesMap.get(cleanCodeKey) || { quantity: 0, netTotal: 0 };
      const stockRestante = art.stock || 0;
      const costPrice = art.costPrice || 0;
      const taxRate = art.taxRate ?? 16;
      const costPriceWithIva = costPrice * (1 + taxRate / 100);
      const pvpMedio = art.sellPriceWithIva > 0 ? art.sellPriceWithIva : (salesData.quantity > 0 ? salesData.netTotal / salesData.quantity : 0);
      const pvrValue = (pvpMedio * (1 - (customMarginPct || 0) / 100)) / (1 + (customIvaPct || 0) / 100);

      result.push({
        code: displayCode,
        description: art.description,
        quantity: salesData.quantity,
        netTotal: salesData.netTotal,
        stockRestante,
        costPriceWithIva,
        costTotalWithIva: costPriceWithIva * stockRestante,
        avgPrice: pvpMedio,
        pvpTotalWithIva: pvpMedio * stockRestante,
        pvrValue,
        pvrTotal: pvrValue * stockRestante,
      });
    });

    // 3. Include any items in salesMap that were not in articles list (legacy/custom items)
    salesMap.forEach((salesData, itemCodeKey) => {
      if (articleCodeSet.has(itemCodeKey)) return;

      let itemCode = itemCodeKey;
      let itemDesc = 'Artigo sem descrição';
      for (const sale of filteredSales) {
        const item = (sale.items || []).find((i) => {
          const c = (i.code.startsWith('01') ? i.code.substring(2) : i.code).trim().toLowerCase();
          return c === itemCodeKey;
        });
        if (item) {
          itemCode = item.code.startsWith('01') ? item.code.substring(2) : item.code;
          itemDesc = item.description;
          break;
        }
      }

      if (!matchCodeRange(itemCode, codeFrom, codeTo)) return;

      if (articleSearchQuery.trim()) {
        const q = articleSearchQuery.trim().toLowerCase();
        const matchCode = itemCode.toLowerCase().includes(q);
        const matchDesc = itemDesc.toLowerCase().includes(q);
        if (!matchCode && !matchDesc) return;
      }

      const pvpMedio = salesData.quantity > 0 ? salesData.netTotal / salesData.quantity : 0;
      const pvrValue = (pvpMedio * (1 - (customMarginPct || 0) / 100)) / (1 + (customIvaPct || 0) / 100);

      result.push({
        code: itemCode,
        description: itemDesc,
        quantity: salesData.quantity,
        netTotal: salesData.netTotal,
        stockRestante: 0,
        costPriceWithIva: 0,
        costTotalWithIva: 0,
        avgPrice: pvpMedio,
        pvpTotalWithIva: 0,
        pvrValue,
        pvrTotal: 0,
      });
    });

    return result.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' }));
  }, [filteredSales, articles, codeFrom, codeTo, articleSearchQuery, customMarginPct, customIvaPct]);

  // Total Summary Row Calculations
  const totals = useMemo(() => {
    return salesByArticle.reduce(
      (acc, item) => {
        acc.totalSold += item.quantity;
        acc.totalStock += item.stockRestante;
        acc.totalCostWithIva += item.costTotalWithIva;
        acc.totalPvp += item.pvpTotalWithIva;
        acc.totalPvr += item.pvrTotal;
        return acc;
      },
      { totalSold: 0, totalStock: 0, totalCostWithIva: 0, totalPvp: 0, totalPvr: 0 }
    );
  }, [salesByArticle]);

  // CSV Export Function
  const exportCsv = () => {
    const headers = ['Código', 'Descrição', 'Qtd Vendida', 'Stock Restante'];
    if (canViewCost && showCostColumn) headers.push('Preço Custo c/IVA (MZN)');
    if (showPvpColumn) headers.push('Preço de Venda ao Público Médio (MZN)');
    if (showPvrColumn) headers.push(`PVR (-${customMarginPct}% / IVA ${customIvaPct}%) (MZN)`);

    const rows = salesByArticle.map((a) => {
      const row = [
        a.code,
        `"${a.description.replace(/"/g, '""')}"`,
        a.quantity.toFixed(0),
        a.stockRestante.toFixed(0),
      ];
      if (canViewCost && showCostColumn) row.push(a.costPriceWithIva.toFixed(2));
      if (showPvpColumn) row.push(a.avgPrice.toFixed(2));
      if (showPvrColumn) row.push(a.pvrValue.toFixed(2));

      return row;
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-vendas-por-artigo-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Top Header */}
      <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-4 rounded-lg shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="material-symbols-outlined text-2xl text-[#003366] dark:text-[#a7c8ff]">analytics</span>
            <h2 className="text-lg font-black uppercase text-[#191c1d] dark:text-white">
              Relatório de Vendas por Artigo
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-mono">
            Vendas discriminadas por artigo com intervalo de códigos, preços de custo c/IVA e cálculo de PVR.
          </p>
        </div>
      </section>

      {/* Filter Suite Section */}
      <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-4 rounded-lg shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-[#c3c6d1] dark:border-[#43474f] pb-2">
          <h3 className="font-bold text-xs uppercase text-[#003366] dark:text-[#a7c8ff]">
            Filtros por Data, Código de Artigo e Pesquisa
          </h3>
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-xs font-bold text-red-600 hover:underline"
          >
            🧹 LIMPAR FILTROS
          </button>
        </div>

        <div className="grid grid-cols-12 gap-3 text-xs">
          <div className="col-span-12 sm:col-span-6 md:col-span-2">
            <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Data Inicial</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 font-mono text-xs"
            />
          </div>

          <div className="col-span-12 sm:col-span-6 md:col-span-2">
            <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Data Final</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 font-mono text-xs"
            />
          </div>

          <div className="col-span-12 sm:col-span-6 md:col-span-2">
            <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">De Código (X)</label>
            <input
              type="text"
              placeholder="Ex: 1 ou ART-001"
              value={codeFrom}
              onChange={(e) => setCodeFrom(e.target.value)}
              className="w-full bg-white dark:bg-[#282c2e] dark:text-white font-mono border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 text-xs"
            />
          </div>

          <div className="col-span-12 sm:col-span-6 md:col-span-2">
            <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Até Código (Y)</label>
            <input
              type="text"
              placeholder="Ex: 50 ou ART-050"
              value={codeTo}
              onChange={(e) => setCodeTo(e.target.value)}
              className="w-full bg-white dark:bg-[#282c2e] dark:text-white font-mono border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 text-xs"
            />
          </div>

          <div className="col-span-12 md:col-span-4">
            <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Pesquisar Artigo</label>
            <input
              type="text"
              placeholder="Código ou descrição..."
              value={articleSearchQuery}
              onChange={(e) => setArticleSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-2 text-xs"
            />
          </div>
        </div>

        {/* Custom PVR / PVP Calculation Formula Panel */}
        <div className="bg-[#0000aa]/5 dark:bg-[#282c2e] p-3 rounded-lg border border-[#c3c6d1] dark:border-[#43474f] space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase text-[#003366] dark:text-[#a7c8ff] flex items-center gap-1.5">
              <span>🧮</span> Cálculo Personalizado PVR: <code>[ (PVP - Margem%) / (1 + IVA%) ]</code>
            </span>
            <div className="flex items-center space-x-2">
              {canViewCost && (
                <button
                  type="button"
                  onClick={() => setShowCostColumn(!showCostColumn)}
                  className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1 transition-colors ${
                    showCostColumn
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {showCostColumn ? '👁️ Coluna Custo Visível' : '🙈 Coluna Custo Oculta'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowPvpColumn(!showPvpColumn)}
                className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1 transition-colors ${
                  showPvpColumn
                    ? 'bg-slate-700 text-white hover:bg-slate-800'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                {showPvpColumn ? '👁️ Coluna PVP Visível' : '🙈 Coluna PVP Oculta'}
              </button>
              <button
                type="button"
                onClick={() => setShowPvrColumn(!showPvrColumn)}
                className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1 transition-colors ${
                  showPvrColumn
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                {showPvrColumn ? '👁️ Coluna PVR Visível' : '🙈 Coluna PVR Oculta'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-3 text-xs items-center">
            <div className="col-span-6 sm:col-span-3">
              <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[10px]">Margem % (Fixo 25% / Customizável)</label>
              <input
                type="number"
                step="0.1"
                value={customMarginPct}
                onChange={(e) => setCustomMarginPct(Number(e.target.value))}
                className="w-full bg-white dark:bg-[#1f2325] dark:text-white font-mono border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 text-xs font-bold text-center"
              />
            </div>

            <div className="col-span-6 sm:col-span-3">
              <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[10px]">Taxa IVA % (Fixo 16% / Customizável)</label>
              <input
                type="number"
                step="0.1"
                value={customIvaPct}
                onChange={(e) => setCustomIvaPct(Number(e.target.value))}
                className="w-full bg-white dark:bg-[#1f2325] dark:text-white font-mono border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 text-xs font-bold text-center"
              />
            </div>

            <div className="col-span-12 sm:col-span-6 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
              Exemplo: (100 MT - {customMarginPct}%) / (1 + {customIvaPct}%) ={' '}
              <b className="text-[#006e25] font-black">
                {formatMZN((100 * (1 - (customMarginPct || 0) / 100)) / (1 + (customIvaPct || 0) / 100))}
              </b>
            </div>
          </div>
        </div>
      </section>

      {/* POR ARTIGO TABLE */}
      <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded-lg overflow-hidden shadow-sm">
        <div className="bg-[#001e40] text-white px-4 py-3 text-xs font-bold uppercase flex justify-between items-center">
          <span>Relatório de Vendas Discriminadas por Artigo</span>
          <span>Total de Artigos Distintos: {salesByArticle.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead className="bg-[#e7e8e9] dark:bg-[#282c2e] text-[#43474f] dark:text-[#c3c6d1] font-bold uppercase border-b border-[#c3c6d1]">
              <tr>
                <th className="p-3">Código</th>
                <th className="p-3">Descrição do Artigo</th>
                <th className="p-3 text-center">Qtd Vendida</th>
                <th className="p-3 text-center">Stock Restante</th>
                {canViewCost && showCostColumn && <th className="p-3 text-right">Preço Custo c/IVA</th>}
                {showPvpColumn && <th className="p-3 text-right">Preço de Venda ao Público Médio</th>}
                {showPvrColumn && (
                  <th className="p-3 text-right text-[#003366] dark:text-[#a7c8ff]">
                    PVR (-{customMarginPct}% / IVA {customIvaPct}%)
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
              {salesByArticle.length === 0 ? (
                <tr>
                  <td colSpan={4 + (canViewCost && showCostColumn ? 1 : 0) + (showPvpColumn ? 1 : 0) + (showPvrColumn ? 1 : 0)} className="p-8 text-center text-slate-400 font-sans italic">
                    Nenhum artigo encontrado para o intervalo de códigos ou pesquisa seleccionado.
                  </td>
                </tr>
              ) : (
                salesByArticle
                  .slice((reportsPage - 1) * reportsPageSize, reportsPage * reportsPageSize)
                  .map((art) => {
                    return (
                      <tr key={art.code} className="hover:bg-[#f3f4f5] dark:hover:bg-[#282c2e]">
                        <td className="p-3 font-bold text-[#003366] dark:text-[#a7c8ff]">{art.code}</td>
                        <td className="p-3 font-sans font-semibold text-slate-800 dark:text-white">{art.description}</td>
                        <td className="p-3 text-center font-bold text-slate-700 dark:text-slate-300">{art.quantity.toFixed(0)} UN</td>
                        <td className="p-3 text-center font-extrabold text-emerald-700 dark:text-emerald-400">{art.stockRestante.toFixed(0)} UN</td>
                        {canViewCost && showCostColumn && (
                          <td className="p-3 text-right font-bold text-amber-800 dark:text-amber-300">
                            {formatMZN(art.costPriceWithIva)}
                          </td>
                        )}
                        {showPvpColumn && <td className="p-3 text-right font-bold">{formatMZN(art.avgPrice)}</td>}
                        {showPvrColumn && (
                          <td className="p-3 text-right font-black text-[#006e25]">
                            {formatMZN(art.pvrValue)}
                          </td>
                        )}
                      </tr>
                    );
                  })
              )}
            </tbody>
            {/* TOTALS ROW AT BOTTOM */}
            {salesByArticle.length > 0 && (
              <tfoot className="bg-[#001e40] text-white font-bold border-t-2 border-[#003366]">
                <tr>
                  <td colSpan={2} className="p-3 font-sans uppercase font-black">
                    TOTAL GERAL ({salesByArticle.length} ARTIGOS)
                  </td>
                  <td className="p-3 text-center font-extrabold text-blue-300">
                    {totals.totalSold.toFixed(0)} UN
                  </td>
                  <td className="p-3 text-center font-extrabold text-emerald-300">
                    {totals.totalStock.toFixed(0)} UN
                  </td>
                  {canViewCost && showCostColumn && (
                    <td className="p-3 text-right font-bold text-amber-300">
                      {formatMZN(totals.totalCostWithIva)}
                    </td>
                  )}
                  {showPvpColumn && (
                    <td className="p-3 text-right font-bold text-white">
                      {formatMZN(totals.totalPvp)}
                    </td>
                  )}
                  {showPvrColumn && (
                    <td className="p-3 text-right font-black text-emerald-400">
                      {formatMZN(totals.totalPvr)}
                    </td>
                  )}
                </tr>
              </tfoot>
            )}
          </table>

          {/* Pagination Controls */}
          <Pagination
            currentPage={reportsPage}
            totalItems={salesByArticle.length}
            pageSize={reportsPageSize}
            onPageChange={setReportsPage}
            onPageSizeChange={setReportsPageSize}
            pageSizeOptions={[15, 25, 50, 100]}
          />
        </div>
      </section>

      {/* Footer Action Controls */}
      <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-4 rounded-lg shadow-sm flex items-center justify-between">
        <p className="text-xs text-slate-500 font-mono">
          Mostrando {salesByArticle.length} artigo(s) discriminado(s).
        </p>

        <div className="flex items-center space-x-3">
          {permissions.includes('reports.export') && (
            <button
              type="button"
              onClick={exportCsv}
              className="px-4 py-2 bg-green-700 text-white font-bold rounded text-xs hover:bg-green-800"
            >
              📥 Exportar Relatório CSV
            </button>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 bg-[#003366] text-white font-bold rounded text-xs hover:bg-blue-800"
          >
            🖨 Imprimir Relatório
          </button>
        </div>
      </section>
    </div>
  );
};
export { Reports as ReportsPage };
export default Reports;
