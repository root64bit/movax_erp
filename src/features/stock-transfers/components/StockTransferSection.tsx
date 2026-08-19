import React from 'react';
import type { AccessScope, Article } from '@/shared/types/domain.types';
import type { GuideLineItem } from '../types/stock-transfer.types';
import { ArticleSearchSelect } from '@/features/inventory/components/ArticleSearchSelect';

export interface StockTransferSectionProps {
  transferFromWarehouseId: string;
  onTransferFromWarehouseChange: (id: string) => void;
  transferToWarehouseId: string;
  onTransferToWarehouseChange: (id: string) => void;
  warehouses: AccessScope[];
  articles: Article[];
  transferArticleId: string;
  onSelectTransferArticle: (id: string) => void;
  resolvedTransferArticle: Article | null;
  onResolveTransferArticle: (art: Article) => void;
  transferArticleLoader: (query: string) => Promise<Article[]>;
  transferQuantityStr: string;
  onTransferQuantityChange: (qty: string) => void;
  transferNotes: string;
  onTransferNotesChange: (notes: string) => void;
  transferItems: GuideLineItem[];
  transferLoading: boolean;
  transferError: string;
  transferSuccess: string;
  onAddTransferItem: () => void;
  onRemoveTransferItem: (index: number) => void;
  onSendTransfer: () => void;
}

export const StockTransferSection: React.FC<StockTransferSectionProps> = ({
  transferFromWarehouseId,
  onTransferFromWarehouseChange,
  transferToWarehouseId,
  onTransferToWarehouseChange,
  warehouses,
  articles,
  transferArticleId,
  onSelectTransferArticle,
  resolvedTransferArticle,
  onResolveTransferArticle,
  transferArticleLoader,
  transferQuantityStr,
  onTransferQuantityChange,
  transferNotes,
  onTransferNotesChange,
  transferItems,
  transferLoading,
  transferError,
  transferSuccess,
  onAddTransferItem,
  onRemoveTransferItem,
  onSendTransfer,
}) => {
  return (
    <section className="rounded-lg border border-[#c3c6d1] bg-white p-4 shadow-sm dark:border-[#43474f] dark:bg-[#1f2325] sm:p-5 space-y-4 print:hidden">
      <div className="flex items-center justify-between border-b pb-2 border-[#c3c6d1] dark:border-[#43474f]">
        <div>
          <h2 className="text-sm font-black text-primary dark:text-blue-200 uppercase">
            Preparar Guia de Transferência
          </h2>
          <p className="text-xs text-slate-500">
            Mover artigos entre armazéns da empresa. O stock sai da origem e fica em trânsito até ser recebido no destino.
          </p>
        </div>
        <span className="text-xs font-bold text-slate-500">
          Linhas preparadas: <b className="text-primary font-mono text-sm">{transferItems.length}</b>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="font-bold text-xs uppercase text-[#737780]">
          Armazém de Origem
          <select
            value={transferFromWarehouseId}
            onChange={(e) => onTransferFromWarehouseChange(e.target.value)}
            className="mt-1 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-2 dark:bg-[#282c2e] font-bold"
          >
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </label>
        <label className="font-bold text-xs uppercase text-[#737780]">
          Armazém de Destino
          <select
            value={transferToWarehouseId}
            onChange={(e) => onTransferToWarehouseChange(e.target.value)}
            className="mt-1 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-2 dark:bg-[#282c2e] font-bold"
          >
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Add Item Row */}
      <div className="bg-slate-50 dark:bg-[#282c2e] p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
        <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Adicionar Artigo à Transferência</div>
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
          <div className="sm:col-span-7">
            <ArticleSearchSelect
              articles={articles}
              selectedArticleId={transferArticleId}
              onSelect={onSelectTransferArticle}
              onResolveArticle={onResolveTransferArticle}
              loadOptions={transferArticleLoader}
              placeholder="Código do Artigo a transferir..."
              className="font-bold"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Quantidade</label>
            <input
              type="number"
              min="0.001"
              step="any"
              value={transferQuantityStr}
              onChange={(e) => onTransferQuantityChange(e.target.value)}
              placeholder="0.00"
              className="w-full rounded border border-gray-300 p-1.5 text-xs font-mono font-bold dark:bg-[#1f2325] dark:border-gray-600 dark:text-white"
            />
          </div>
          <div className="sm:col-span-3">
            <button
              type="button"
              onClick={onAddTransferItem}
              className="w-full py-1.5 px-3 bg-[#003366] text-white font-bold rounded text-xs hover:bg-blue-900 transition-colors shadow-sm flex items-center justify-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">add</span> Adicionar Artigo
            </button>
          </div>
        </div>
      </div>

      {/* Transfer Items Table */}
      {transferItems.length > 0 && (
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-52 overflow-y-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-[#1f2325] text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-2">#</th>
                  <th className="p-2">Código</th>
                  <th className="p-2">Descrição</th>
                  <th className="p-2 text-right">Qtd</th>
                  <th className="p-2 text-right">Stock na Origem</th>
                  <th className="p-2 text-center">Acção</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {transferItems.map((item, idx) => (
                  <tr key={`${item.articleId}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-2 text-slate-400">{idx + 1}</td>
                    <td className="p-2 font-mono font-bold">{item.articleCode}</td>
                    <td className="p-2">{item.articleDescription}</td>
                    <td className="p-2 text-right font-mono font-black text-blue-600 dark:text-blue-400">
                      {item.quantity.toFixed(2)}
                    </td>
                    <td className="p-2 text-right font-mono">{item.currentStock.toFixed(2)}</td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => onRemoveTransferItem(idx)}
                        className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded cursor-pointer"
                        title="Remover artigo"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <label className="font-bold text-xs uppercase text-[#737780]">
          Observações / Motivo da Transferência
          <input
            type="text"
            value={transferNotes}
            onChange={(e) => onTransferNotesChange(e.target.value)}
            placeholder="Ex: Abastecimento de balcão / Pedido de loja"
            className="mt-1 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-2 text-xs dark:bg-[#282c2e]"
          />
        </label>
      </div>

      <div className="flex justify-end border-t pt-3 border-[#c3c6d1] dark:border-[#43474f]">
        <button
          type="button"
          disabled={transferLoading || transferItems.length === 0}
          onClick={onSendTransfer}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-bold rounded shadow hover:bg-blue-700 transition-colors disabled:opacity-50 text-xs uppercase tracking-wider cursor-pointer"
        >
          <span className="material-symbols-outlined text-sm">local_shipping</span>
          {transferLoading ? 'A enviar transferência...' : 'Emitir e Enviar Guia de Transferência'}
        </button>
      </div>

      {transferError && (
        <div className="p-3 bg-rose-50 text-rose-700 rounded border border-rose-200 text-xs font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-base">error</span> {transferError}
        </div>
      )}
      {transferSuccess && (
        <div className="p-3 bg-emerald-50 text-emerald-700 rounded border border-emerald-200 text-xs font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-base">check_circle</span> {transferSuccess}
        </div>
      )}
    </section>
  );
};
