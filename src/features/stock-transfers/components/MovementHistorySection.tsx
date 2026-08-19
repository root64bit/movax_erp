import React from 'react';
import type { Article, StockMovement } from '@/shared/types/domain.types';
import type { StockTypeFilter } from '../types/stock-transfer.types';
import { Pagination } from '@/components/Pagination';

export interface MovementHistorySectionProps {
  historyMovements: StockMovement[];
  historyTotalCount: number;
  historyTotalStock: number;
  historyLoading: boolean;
  historyError: string;
  movementsPage: number;
  onPageChange: (page: number) => void;
  movementsPageSize: number;
  onPageSizeChange?: (size: number) => void;
  dateFrom: string;
  onDateFromChange: (val: string) => void;
  dateTo: string;
  onDateToChange: (val: string) => void;
  typeFilter: StockTypeFilter;
  onTypeFilterChange: (val: StockTypeFilter) => void;
  searchQuery: string;
  onSearchQueryChange: (val: string) => void;
  onClearFilters: () => void;
  onExportCSV: () => void;
  onOpenLedger: (article: Article) => void;
  articles: Article[];
}

export const MovementHistorySection: React.FC<MovementHistorySectionProps> = ({
  historyMovements,
  historyTotalCount,
  historyTotalStock,
  historyLoading,
  historyError,
  movementsPage,
  onPageChange,
  movementsPageSize,
  onPageSizeChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  typeFilter,
  onTypeFilterChange,
  searchQuery,
  onSearchQueryChange,
  onClearFilters,
  onExportCSV,
  onOpenLedger,
  articles,
}) => {
  return (
    <section className="rounded-lg border border-[#c3c6d1] bg-white shadow-sm dark:border-[#43474f] dark:bg-[#1f2325] overflow-hidden">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#282c2e] flex flex-wrap justify-between items-center gap-3">
        <div>
          <h3 className="text-xs font-black uppercase text-slate-700 dark:text-slate-200">
            Histórico Oficial de Movimentos de Stock
          </h3>
          <p className="text-[11px] text-slate-500">
            Registo auditável de todas as entradas, saídas, vendas e guias emitidas no sistema.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center space-x-2 text-xs font-bold">
            <span className="text-slate-500">Total Movimentos:</span>
            <span className="font-mono text-primary dark:text-blue-300 font-black">{historyTotalCount}</span>
          </div>
          <button
            type="button"
            onClick={onExportCSV}
            disabled={historyMovements.length === 0}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold rounded text-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">download</span> Exportar CSV
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1f2325] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 text-xs">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">De</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="w-full rounded border border-gray-300 p-1.5 dark:bg-[#282c2e] dark:border-gray-600 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Até</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="w-full rounded border border-gray-300 p-1.5 dark:bg-[#282c2e] dark:border-gray-600 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Tipo de Movimento</label>
          <select
            value={typeFilter}
            onChange={(e) => onTypeFilterChange(e.target.value as StockTypeFilter)}
            className="w-full rounded border border-gray-300 p-1.5 dark:bg-[#282c2e] dark:border-gray-600 dark:text-white font-bold"
          >
            <option value="ALL">Todos os tipos</option>
            <option value="entrada">Entradas</option>
            <option value="saida">Saídas</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Pesquisar Artigo / Guia</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Filtrar por código ou guia..."
            className="w-full rounded border border-gray-300 p-1.5 dark:bg-[#282c2e] dark:border-gray-600 dark:text-white"
          />
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={onClearFilters}
            className="w-full py-1.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded font-bold transition-colors cursor-pointer"
          >
            Limpar Filtros
          </button>
        </div>
      </div>

      {historyError && (
        <div className="m-3 p-3 bg-rose-50 text-rose-700 rounded border border-rose-200 text-xs font-bold">
          {historyError}
        </div>
      )}

      {/* Movements Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 dark:bg-[#1f2325] text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700 uppercase text-[10px]">
            <tr>
              <th className="p-3">Data / Hora</th>
              <th className="p-3">Tipo</th>
              <th className="p-3">Documento / Ref</th>
              <th className="p-3">Artigo</th>
              <th className="p-3 text-right">Qtd Movimentada</th>
              <th className="p-3 text-right">Saldo Após</th>
              <th className="p-3 text-center">Acção</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {historyLoading ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-400 italic">
                  A carregar movimentos...
                </td>
              </tr>
            ) : historyMovements.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-400 italic">
                  Nenhum movimento encontrado para os critérios seleccionados.
                </td>
              </tr>
            ) : (
              historyMovements.map((mov) => {
                const articleObj = articles.find((a) => a.id === mov.productId || a.code === mov.articleCode);
                const isEntrada = mov.type === 'entrada';

                return (
                  <tr key={mov.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-3 text-slate-500 font-mono">
                      {new Date(mov.date).toLocaleDateString('pt-PT')} {new Date(mov.date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          isEntrada
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                        }`}
                      >
                        {isEntrada ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold">
                      {mov.docRef || (isEntrada ? 'Entrada Directa' : 'Saída Directa')}
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-slate-800 dark:text-slate-200">{mov.articleDescription}</div>
                      <div className="text-[11px] font-mono text-slate-400">{mov.articleCode}</div>
                    </td>
                    <td
                      className={`p-3 text-right font-mono font-black ${
                        isEntrada ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {isEntrada ? `+${mov.quantity.toFixed(2)}` : `-${mov.quantity.toFixed(2)}`}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                      {mov.balanceAfter != null ? mov.balanceAfter.toFixed(2) : '-'}
                    </td>
                    <td className="p-3 text-center">
                      {articleObj ? (
                        <button
                          type="button"
                          onClick={() => onOpenLedger(articleObj)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-[11px] font-bold cursor-pointer"
                          title="Ver extrato de movimentos deste artigo"
                        >
                          Extrato
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[11px]">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#282c2e]">
        <Pagination
          currentPage={movementsPage}
          totalItems={historyTotalCount}
          pageSize={movementsPageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      </div>
    </section>
  );
};
