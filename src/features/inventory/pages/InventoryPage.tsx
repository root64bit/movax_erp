import React, { useState } from 'react';
import type { Article, StockMovement, DocumentRecord, SaleInvoice, ReferenceOption } from '@/shared/types/domain.types';
import { formatMZN } from '@/shared/utils/formatters';
import { ArticleLedgerModal } from '../components/ArticleLedgerModal';
import { Pagination } from '@/components/Pagination';
import { InventoryService } from '../services/inventory.service';

export interface InventoryProps {
  articles: Article[];
  movements?: StockMovement[];
  sales?: SaleInvoice[];
  documents?: DocumentRecord[];
  globalSearch?: string;
  onOpenNewArticleModal?: () => void;
  onOpenNewModal?: () => void;
  onEditArticle?: (article: Article) => void;
  onDeleteArticle?: (article: any) => void;
  onSaveArticle?: (article: any) => Promise<void>;
  onOpenDocument?: (doc: any) => void;
  setActiveTab?: (tab: string) => void;
  canViewCost?: boolean;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canAllowNegative?: boolean;
  canAdjustStock?: boolean;
  warehouseId?: string;
  categories?: ReferenceOption[];
}

export const Inventory: React.FC<InventoryProps> = ({
  articles,
  movements = [],
  sales = [],
  documents = [],
  globalSearch = '',
  onOpenNewArticleModal,
  onOpenNewModal,
  onEditArticle,
  onDeleteArticle,
  onSaveArticle,
  onOpenDocument,
  setActiveTab,
  canViewCost = true,
  canCreate = true,
  canEdit = true,
  canDelete = true,
  canAllowNegative = false,
  canAdjustStock = false,
  warehouseId,
  categories = [],
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [localSearch, setLocalSearch] = useState<string>('');
  const [codeFrom, setCodeFrom] = useState<string>('');
  const [codeTo, setCodeTo] = useState<string>('');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'WITH_STOCK' | 'NO_STOCK' | 'LOW_STOCK'>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState<'CODE' | 'MOST_SOLD' | 'STOCK_ASC' | 'STOCK_DESC'>('CODE');
  const [ledgerArticle, setLedgerArticle] = useState<Article | null>(null);
  const [serverRows, setServerRows] = useState<Article[] | null>(null);
  const [serverTotalCount, setServerTotalCount] = useState(0);
  const [serverTotals, setServerTotals] = useState<{ stockQty: number; stockCostValue: number; stockSaleValue: number; lowStockCount: number; outOfStockCount: number } | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogFallback, setCatalogFallback] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const searchTerm = (globalSearch || localSearch).toLowerCase();

  // Aggregate quantity sold by article code from sales
  const totalSoldByCode = React.useMemo(() => {
    const map = new Map<string, number>();
    sales.forEach((s) => {
      if (s.documentTypeCode === 'CUSTOMER_QUOTATION' || s.status === 'Cancelada') return;
      s.items.forEach((item) => {
        if (!item.code) return;
        const key = item.code.trim().toUpperCase();
        map.set(key, (map.get(key) ?? 0) + item.quantity);
      });
    });
    return map;
  }, [sales]);

  const categoryPills = React.useMemo(() => {
    if (categories.length > 0) {
      return [{ id: 'todos', label: 'Todos' }, ...categories.map((category) => ({
        id: category.name.toLowerCase(),
        label: category.name,
      }))];
    }
    const set = new Set<string>();
    articles.forEach((a) => {
      if (a.category) set.add(a.category.toLowerCase());
    });
    const dynamicList = Array.from(set).map((cat) => ({
      id: cat,
      label: cat.charAt(0).toUpperCase() + cat.slice(1),
    }));
    return [{ id: 'todos', label: 'Todos' }, ...dynamicList];
  }, [articles, categories]);

  const filteredArticles = React.useMemo(() => {
    let list = articles.filter((art) => {
      const matchesCategory = selectedCategory === 'todos' || art.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSearch =
        art.code.toLowerCase().includes(searchTerm) ||
        art.description.toLowerCase().includes(searchTerm) ||
        (art.brand && art.brand.toLowerCase().includes(searchTerm));

      let matchesCodeRange = true;
      if (codeFrom.trim()) {
        matchesCodeRange = matchesCodeRange && art.code.toUpperCase() >= codeFrom.trim().toUpperCase();
      }
      if (codeTo.trim()) {
        matchesCodeRange = matchesCodeRange && art.code.toUpperCase() <= codeTo.trim().toUpperCase();
      }

      let matchesStock = true;
      if (stockFilter === 'WITH_STOCK') {
        matchesStock = art.stock > 0;
      } else if (stockFilter === 'NO_STOCK') {
        matchesStock = art.stock <= 0;
      } else if (stockFilter === 'LOW_STOCK') {
        matchesStock = art.stock <= art.minStock;
      }

      return matchesCategory && matchesSearch && matchesCodeRange && matchesStock;
    });

    const sortedList = [...list];
    if (sortBy === 'MOST_SOLD') {
      sortedList.sort((a, b) => {
        const soldA = totalSoldByCode.get(a.code.trim().toUpperCase()) ?? 0;
        const soldB = totalSoldByCode.get(b.code.trim().toUpperCase()) ?? 0;
        return soldB - soldA;
      });
    } else if (sortBy === 'STOCK_ASC') {
      sortedList.sort((a, b) => a.stock - b.stock);
    } else if (sortBy === 'STOCK_DESC') {
      sortedList.sort((a, b) => b.stock - a.stock);
    }

    return sortedList;
  }, [articles, selectedCategory, searchTerm, codeFrom, codeTo, stockFilter, sortBy, totalSoldByCode]);

  React.useEffect(() => {
    setPage(1);
  }, [selectedCategory, searchTerm, codeFrom, codeTo, stockFilter, sortBy, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredArticles.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedArticles = filteredArticles.slice((safePage - 1) * pageSize, safePage * pageSize);

  React.useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setCatalogLoading(true);
      void InventoryService.fetchProductsPage({
        search: searchTerm,
        category: selectedCategory === 'todos' ? undefined : selectedCategory,
        stockFilter,
        sort: sortBy,
        codeFrom,
        codeTo,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }).then((result) => {
        if (cancelled) return;
        const lastPage = Math.max(1, Math.ceil(result.totalCount / pageSize));
        if (page > lastPage) {
          setPage(lastPage);
          return;
        }
        setServerRows(result.rows);
        setServerTotalCount(result.totalCount);
        setServerTotals(result.totals);
        setCatalogFallback(false);
      }).catch(() => {
        if (cancelled) return;
        setServerRows(null);
        setServerTotals(null);
        setCatalogFallback(true);
      }).finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchTerm, selectedCategory, stockFilter, sortBy, codeFrom, codeTo, page, pageSize]);

  const displayArticles = serverRows ?? pagedArticles;
  const displayTotalCount = serverRows ? serverTotalCount : filteredArticles.length;
  const lowStockCount = serverTotals?.lowStockCount ?? filteredArticles.filter((article) => article.stock <= article.minStock).length;
  const outOfStockCount = serverTotals?.outOfStockCount ?? filteredArticles.filter((article) => article.stock <= 0).length;

  const handleOpenNewArticle = React.useCallback(() => {
    if (onOpenNewArticleModal) {
      onOpenNewArticleModal();
    } else if (onOpenNewModal) {
      onOpenNewModal();
    }
  }, [onOpenNewArticleModal, onOpenNewModal]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' && canCreate) {
        e.preventDefault();
        handleOpenNewArticle();
      } else if (e.key === 'F3' && displayArticles.length > 0 && onEditArticle) {
        e.preventDefault();
        onEditArticle(displayArticles[0]);
      } else if (e.key === 'F4' && displayArticles.length > 0) {
        e.preventDefault();
        setLedgerArticle(displayArticles[0]);
      } else if (e.key === 'F9') {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canCreate, handleOpenNewArticle, displayArticles, onEditArticle]);

  const totalArticlesCount = displayTotalCount;
  const totalStock = serverTotals?.stockQty ?? filteredArticles.reduce((acc, a) => acc + a.stock, 0);
  const totalCostValue = serverTotals?.stockCostValue ?? filteredArticles.reduce((acc, a) => acc + (a.costPrice * a.stock), 0);
  const totalSalesValue = serverTotals?.stockSaleValue ?? filteredArticles.reduce((acc, a) => acc + (a.sellPriceWithIva * a.stock), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
        <div className="movax-kpi-card"><span className="movax-kpi-label">Artigos encontrados</span><span className="movax-kpi-value">{totalArticlesCount.toLocaleString('pt-MZ')}</span><span className="movax-kpi-note">Pesquisa e filtros atuais</span></div>
        <div className="movax-kpi-card"><span className="movax-kpi-label">Unidades em stock</span><span className="movax-kpi-value">{totalStock.toLocaleString('pt-MZ')}</span><span className="movax-kpi-note">Soma das existências</span></div>
        <button type="button" onClick={() => setStockFilter('LOW_STOCK')} className="movax-kpi-card"><span className="movax-kpi-label">Stock baixo</span><span className="movax-kpi-value text-amber-700 dark:text-amber-300">{lowStockCount.toLocaleString('pt-MZ')}</span><span className="movax-kpi-note">Clique para filtrar</span></button>
        <button type="button" onClick={() => setStockFilter('NO_STOCK')} className="movax-kpi-card"><span className="movax-kpi-label">Esgotados</span><span className="movax-kpi-value text-red-700 dark:text-red-300">{outOfStockCount.toLocaleString('pt-MZ')}</span><span className="movax-kpi-note">Precisam de reposição</span></button>
        {canViewCost && <div className="movax-kpi-card"><span className="movax-kpi-label">Valor a custo</span><span className="movax-kpi-value text-[18px]">{formatMZN(totalCostValue)}</span><span className="movax-kpi-note">Valor contabilístico</span></div>}
        <div className="movax-kpi-card"><span className="movax-kpi-label">Valor potencial</span><span className="movax-kpi-value text-[18px] text-emerald-700 dark:text-emerald-300">{formatMZN(totalSalesValue)}</span><span className="movax-kpi-note">Venda c/ IVA do stock</span></div>
      </div>

      {/* Toolbar / Actions — everyday controls first, detailed filters on demand */}
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#34383b] dark:bg-[#1b2023]">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-slate-400">search</span>
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Código, código de barras, descrição ou marca..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-semibold outline-none transition focus:border-[#5377a0] focus:bg-white focus:ring-2 focus:ring-[#5377a0]/15 dark:border-[#34383b] dark:bg-[#202529]"
            />
          </div>

          <select
            aria-label="Categoria"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="min-w-[180px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold dark:border-[#34383b] dark:bg-[#202529]"
          >
            {categoryPills.map((cat) => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
          </select>

          <select
            aria-label="Estado do stock"
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as typeof stockFilter)}
            className="min-w-[180px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold dark:border-[#34383b] dark:bg-[#202529]"
          >
            <option value="ALL">Todo o stock</option>
            <option value="LOW_STOCK">Stock baixo</option>
            <option value="NO_STOCK">Esgotados</option>
            <option value="WITH_STOCK">Com existência</option>
          </select>

          <button type="button" onClick={() => setShowFilters((value) => !value)} className={`flex items-center justify-center gap-2 rounded-xl border px-3 text-xs font-black ${showFilters || codeFrom || codeTo || sortBy !== 'CODE' ? 'border-[#5377a0] bg-[#eef4fb] text-[#315f8f] dark:bg-[#243548] dark:text-[#b5d0ff]' : 'border-slate-200 bg-white text-slate-600 dark:border-[#34383b] dark:bg-[#202529] dark:text-slate-200'}`}>
            <span className="material-symbols-outlined text-[18px]">tune</span>
            Mais filtros
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {canCreate && (
              <button
                type="button"
                onClick={handleOpenNewArticle}
                className="flex items-center gap-2 rounded-xl bg-[#006e25] px-4 text-xs font-black text-white shadow-sm hover:brightness-110"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>Novo artigo
              </button>
            )}
            <button onClick={() => setActiveTab?.('movements')} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50 dark:border-[#34383b] dark:bg-[#202529] dark:text-slate-200"><span className="material-symbols-outlined text-[18px]">swap_horiz</span>Movimentos</button>
          </div>
        </div>

        {showFilters && (
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-3 dark:border-[#34383b] dark:bg-[#202529]">
            <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">Código desde
              <input type="text" value={codeFrom} onChange={(e) => setCodeFrom(e.target.value)} placeholder="Ex.: ART-001" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold uppercase dark:border-[#43474f] dark:bg-[#1b2023]" />
            </label>
            <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">Código até
              <input type="text" value={codeTo} onChange={(e) => setCodeTo(e.target.value)} placeholder="Ex.: ART-999" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold uppercase dark:border-[#43474f] dark:bg-[#1b2023]" />
            </label>
            <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">Ordenar por
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold dark:border-[#43474f] dark:bg-[#1b2023]">
                <option value="CODE">Código</option>
                <option value="MOST_SOLD">Mais vendidos</option>
                <option value="STOCK_ASC">Menor stock primeiro</option>
                <option value="STOCK_DESC">Maior stock primeiro</option>
              </select>
            </label>
            {(codeFrom || codeTo || stockFilter !== 'ALL' || sortBy !== 'CODE' || selectedCategory !== 'todos') && (
              <button type="button" onClick={() => { setCodeFrom(''); setCodeTo(''); setStockFilter('ALL'); setSortBy('CODE'); setSelectedCategory('todos'); }} className="justify-self-start text-xs font-black text-red-700 hover:underline dark:text-red-300">Limpar todos os filtros</button>
            )}
          </div>
        )}
      </div>

      {catalogFallback && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300">
          Catálogo em modo de compatibilidade local. A migration de paginação server-side ainda não está aplicada neste ambiente.
        </div>
      )}

      {/* Data Grid Container */}
      <div className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded overflow-hidden shadow-sm">
        <div className="max-h-[68vh] overflow-auto">
          <table className="erp-table w-full min-w-[1120px] border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-[#e7e8e9] dark:bg-[#282c2e] border-b border-[#c3c6d1] dark:border-[#43474f] text-[#43474f] dark:text-[#c3c6d1] font-bold uppercase">
              <tr>
                <th className="px-3 py-3 border-r border-[#c3c6d1] dark:border-[#43474f]">Código</th>
                <th className="px-3 py-3 border-r border-[#c3c6d1] dark:border-[#43474f]">Descrição do Artigo</th>
                <th className="px-3 py-3 border-r border-[#c3c6d1] dark:border-[#43474f] text-center">Un.</th>
                <th className="px-3 py-3 border-r border-[#c3c6d1] dark:border-[#43474f] text-right">Stock Mín.</th>
                <th className="px-3 py-3 border-r border-[#c3c6d1] dark:border-[#43474f] text-right">Existência</th>
                <th className="px-3 py-3 border-r border-[#c3c6d1] dark:border-[#43474f] text-right text-purple-700 dark:text-purple-300">Qtd. Vendida</th>
                {canViewCost && <th className="px-3 py-3 border-r border-[#c3c6d1] dark:border-[#43474f] text-right">P. Custo</th>}
                {canViewCost && <th className="px-3 py-3 border-r border-[#c3c6d1] dark:border-[#43474f] text-right">Custo c/IVA</th>}
                {canViewCost && <th className="px-3 py-3 border-r border-[#c3c6d1] dark:border-[#43474f] text-right">Valor Total</th>}
                {canViewCost && <th className="px-3 py-3 border-r border-[#c3c6d1] dark:border-[#43474f] text-right">% Margem</th>}
                <th className="px-3 py-3 border-r border-[#c3c6d1] dark:border-[#43474f] text-right">P. Venda</th>
                <th className="px-3 py-3 border-r border-[#c3c6d1] dark:border-[#43474f] text-right">P. c/ IVA</th>
                <th className="px-3 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
              {displayArticles.map((art) => {
                const isCritical = art.stock <= art.minStock;
                return (
                  <tr
                    key={art.id}
                    className={`transition-colors font-mono ${
                      isCritical
                        ? 'bg-[#ffdad6]/20 dark:bg-[#450009]/30 hover:bg-[#ffdad6]/40'
                        : 'hover:bg-[#f3f4f5] dark:hover:bg-[#282c2e]'
                    }`}
                  >
                    <td className="px-3 py-2.5 border-r border-[#c3c6d1] dark:border-[#43474f] font-bold text-[#003366] dark:text-[#a7c8ff]">
                      {art.code}
                    </td>
                    <td className="px-3 py-2.5 border-r border-[#c3c6d1] dark:border-[#43474f] font-sans font-medium text-[#191c1d] dark:text-white">
                      {art.description}
                      {isCritical && (
                        <span className="ml-2 text-[10px] bg-[#ba1a1a] text-white px-1.5 py-0.5 rounded font-bold uppercase">
                          {art.stock === 0 ? 'Esgotado' : 'Crítico'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 border-r border-[#c3c6d1] dark:border-[#43474f] text-center font-bold">
                      {art.unit}
                    </td>
                    <td className="px-3 py-2.5 border-r border-[#c3c6d1] dark:border-[#43474f] text-right text-[#737780]">
                      {art.minStock}
                    </td>
                    <td className="px-3 py-2.5 border-r border-[#c3c6d1] dark:border-[#43474f] text-right font-extrabold text-sm">
                      <span className={isCritical ? 'text-[#ba1a1a]' : 'text-[#006e25]'}>
                        {art.stock}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 border-r border-[#c3c6d1] dark:border-[#43474f] text-right font-extrabold text-purple-700 dark:text-purple-400">
                      {(art.soldQuantity ?? totalSoldByCode.get(art.code.trim().toUpperCase()) ?? 0) || '—'}
                    </td>
                    {canViewCost && <td className="px-3 py-2.5 border-r border-[#c3c6d1] dark:border-[#43474f] text-right">
                      {art.costPrice.toFixed(2)}
                    </td>}
                    {canViewCost && <td className="px-3 py-2.5 border-r border-[#c3c6d1] dark:border-[#43474f] text-right font-mono">
                      {formatMZN(art.costPrice * (1 + (art.taxRate ?? 16) / 100))}
                    </td>}
                    {canViewCost && <td className="px-3 py-2.5 border-r border-[#c3c6d1] dark:border-[#43474f] text-right font-mono font-bold">
                      {formatMZN(art.stock * art.costPrice * (1 + (art.taxRate ?? 16) / 100))}
                    </td>}
                    {canViewCost && <td className="px-3 py-2.5 border-r border-[#c3c6d1] dark:border-[#43474f] text-right text-gray-500">
                      {art.profitMargin}%
                    </td>}
                    <td className="px-3 py-2.5 border-r border-[#c3c6d1] dark:border-[#43474f] text-right">
                      {art.sellPrice.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 border-r border-[#c3c6d1] dark:border-[#43474f] text-right font-bold text-[#003366] dark:text-[#a7c8ff]">
                      {art.sellPriceWithIva.toFixed(2)} MZN
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => setLedgerArticle(art)}
                          className="p-1 text-[#000080] dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded"
                          title="Ver Extracto de Movimentos (Foto 2)"
                        >
                          <span className="material-symbols-outlined text-base">receipt_long</span>
                        </button>
                        {onEditArticle && (
                          <button
                            onClick={() => onEditArticle(art)}
                            className="p-1 text-[#003366] dark:text-[#a7c8ff] hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                            title="Editar Artigo (F3)"
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                          </button>
                        )}
                        {onDeleteArticle && (
                          <button
                            onClick={() => onDeleteArticle(art)}
                            className="p-1 text-[#ba1a1a] hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                            title="Eliminar Artigo"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
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
        <div className="border-t border-slate-200 bg-slate-50/70 px-3 dark:border-[#34383b] dark:bg-[#1b2023]">
          <Pagination
            currentPage={serverRows ? page : safePage}
            totalItems={displayTotalCount}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[15, 25, 50, 100]}
          />
        </div>
      </div>

      {/* Extracto de Movimentos Modal (Foto 2) */}
      <ArticleLedgerModal
        isOpen={Boolean(ledgerArticle)}
        onClose={() => setLedgerArticle(null)}
        article={ledgerArticle}
        articles={articles}
        movements={movements}
        sales={sales}
        documents={documents}
        onOpenDocument={onOpenDocument}
        canViewCost={canViewCost}
        onSelectArticleId={(id) => {
          const found = articles.find((a) => a.id === id);
          if (found) setLedgerArticle(found);
        }}
      />

      {/* Bottom Status Bar */}
      <div className="mt-4 rounded border border-[#c3c6d1] bg-[#e7e8e9] dark:border-[#43474f] dark:bg-[#282c2e] px-4 py-2 text-xs font-mono font-bold flex items-center justify-between">
        <div className="flex items-center space-x-4 text-[#191c1d] dark:text-white">
          <span>ESC=Sair</span>
          <span>TAB=Ord</span>
          <span>Barra=Filtro</span>
          <button type="button" onClick={handleOpenNewArticle} className="rounded bg-[#003366] px-2 py-0.5 text-white font-bold hover:brightness-110">
            F2=Introduzir
          </button>
          {displayArticles.length > 0 && onEditArticle && (
            <button onClick={() => onEditArticle(displayArticles[0])} className="rounded bg-[#003366] px-2 py-0.5 text-white font-bold hover:brightness-110">
              F3=Alterar
            </button>
          )}
          {displayArticles.length > 0 && (
            <button onClick={() => setLedgerArticle(displayArticles[0])} className="rounded bg-[#003366] px-2 py-0.5 text-white font-bold hover:brightness-110">
              F4=Consultar
            </button>
          )}
          <button onClick={() => window.print()} className="rounded bg-[#003366] px-2 py-0.5 text-white font-bold hover:brightness-110">
            F9=Imp
          </button>
        </div>
        <div className="text-[#737780] text-[11px]">
          Resultados: <b className="text-[#191c1d] dark:text-white">{displayTotalCount}</b> · Página: <b className="text-[#191c1d] dark:text-white">{serverRows ? page : safePage}</b>{catalogLoading ? ' · A atualizar…' : ''}
        </div>
      </div>
    </div>
  );
};
export { Inventory as InventoryPage };
export default Inventory;
