import React from 'react';
import type { AccessScope, Article, DocumentRecord, Supplier } from '@/shared/types/domain.types';
import type { GuideLineItem, StockMovementType } from '../types/stock-transfer.types';
import { ArticleSearchSelect } from '@/features/inventory/components/ArticleSearchSelect';
import { formatMZN } from '@/shared/utils/formatters';
import { calculateSupplierCreditTotal, projectStockAfterMovement } from '../utils/stockTransferState';

export interface DirectMovementSectionProps {
  type: StockMovementType;
  onTypeChange: (type: StockMovementType) => void;
  warehouseId: string;
  onWarehouseChange: (id: string) => void;
  warehouses: AccessScope[];
  guideNumber: string;
  onGuideNumberChange: (num: string) => void;
  documentDate: string;
  onDocumentDateChange: (date: string) => void;
  supplierId: string;
  onSupplierChange: (id: string) => void;
  suppliers: Supplier[];
  notes: string;
  onNotesChange: (notes: string) => void;
  operatorName: string;
  canPostEntry: boolean;
  canPostExit: boolean;
  canViewCost?: boolean;
  articles: Article[];
  articleId: string;
  onSelectArticle: (id: string) => void;
  onAfterArticleSelect: () => void;
  resolvedArticle: Article | null;
  onResolveArticle: (art: Article) => void;
  directArticleLoader: (query: string) => Promise<Article[]>;
  quantityStr: string;
  onQuantityChange: (qty: string) => void;
  unitCostStr: string;
  onUnitCostChange: (cost: string) => void;
  priceWithIvaStr: string;
  onPriceWithIvaChange: (price: string) => void;
  article: Article | undefined;
  guideItems: GuideLineItem[];
  editingGuideId: string | null;
  editingDocument: DocumentRecord | undefined;
  saving: boolean;
  error: string;
  success: string;
  lastSavedGuide: DocumentRecord | null;
  guideNumberRef: React.RefObject<HTMLInputElement>;
  notesRef: React.RefObject<HTMLInputElement>;
  qtyInputRef: React.RefObject<HTMLInputElement>;
  costInputRef: React.RefObject<HTMLInputElement>;
  priceInputRef: React.RefObject<HTMLInputElement>;
  onAddItemToGuide: () => void;
  onRemoveItemFromGuide: (index: number) => void;
  onClearGuideForm: () => void;
  onSubmitGuide: () => void;
  onOpenDocument?: (doc: DocumentRecord) => void;
}

export const DirectMovementSection: React.FC<DirectMovementSectionProps> = ({
  type,
  onTypeChange,
  warehouseId,
  onWarehouseChange,
  warehouses,
  guideNumber,
  onGuideNumberChange,
  documentDate,
  onDocumentDateChange,
  supplierId,
  onSupplierChange,
  suppliers,
  notes,
  onNotesChange,
  operatorName,
  canPostEntry,
  canPostExit,
  canViewCost = true,
  articles,
  articleId,
  onSelectArticle,
  onAfterArticleSelect,
  resolvedArticle,
  onResolveArticle,
  directArticleLoader,
  quantityStr,
  onQuantityChange,
  unitCostStr,
  onUnitCostChange,
  priceWithIvaStr,
  onPriceWithIvaChange,
  article,
  guideItems,
  editingGuideId,
  editingDocument,
  saving,
  error,
  success,
  lastSavedGuide,
  guideNumberRef,
  notesRef,
  qtyInputRef,
  costInputRef,
  priceInputRef,
  onAddItemToGuide,
  onRemoveItemFromGuide,
  onClearGuideForm,
  onSubmitGuide,
  onOpenDocument,
}) => {
  const supplierCreditTotal = calculateSupplierCreditTotal(guideItems);

  return (
    <section className="rounded-lg border border-[#c3c6d1] bg-white p-4 shadow-sm dark:border-[#43474f] dark:bg-[#1f2325] sm:p-5 space-y-4 print:hidden">
      <div className="flex flex-wrap items-center justify-between border-b pb-2 border-[#c3c6d1] dark:border-[#43474f] gap-2">
        <h2 className="text-sm font-black text-primary dark:text-blue-200 uppercase flex items-center gap-2">
          {type === 'entrada' ? 'Entrada de stock' : 'Saída de stock'}
        </h2>
        <div className="flex items-center space-x-3">
          <span className="rounded bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-300">
            Artigos carregados: <b>{articles.length}</b>
          </span>
          <span className="text-xs font-bold text-slate-500">
            Linhas preparadas: <b className="text-primary font-mono text-sm">{guideItems.length}</b>
          </span>
        </div>
      </div>

      {/* Header Controls (Operação, Nº da Guia, Observações, Operador) */}
      <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-6">
        <label className="font-bold text-xs uppercase text-[#737780]">
          Operação
          <select
            value={type}
            onChange={(event) => {
              const nextType = event.target.value as StockMovementType;
              onTypeChange(nextType);
              if (nextType === 'saida') onSupplierChange('');
              onUnitCostChange('');
              onPriceWithIvaChange('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                guideNumberRef.current?.focus();
                guideNumberRef.current?.select();
              }
            }}
            className="mt-1 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-2 dark:bg-[#282c2e] font-bold"
          >
            {canPostEntry && <option value="entrada">Entrada direta por Guia</option>}
            {canPostExit && <option value="saida">Saída direta por Guia</option>}
          </select>
        </label>

        <label className="font-bold text-xs uppercase text-[#737780]">
          Número da Guia
          <input
            ref={guideNumberRef}
            type="text"
            value={guideNumber}
            onChange={(event) => onGuideNumberChange(event.target.value)}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                notesRef.current?.focus();
                notesRef.current?.select();
              }
            }}
            placeholder="Ex: GUIA-2026/001"
            className="mt-1 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-2 font-mono uppercase dark:bg-[#282c2e]"
          />
        </label>

        <label className="font-bold text-xs uppercase text-[#737780]">
          Observações / Ref. Externa
          <input
            ref={notesRef}
            type="text"
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            placeholder="Ex: Factura do Fornecedor / Motivo"
            className="mt-1 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-2 dark:bg-[#282c2e]"
          />
        </label>

        <label className="font-bold text-xs uppercase text-[#737780]">
          Operador Responsável
          <input
            type="text"
            value={operatorName}
            disabled
            className="mt-1 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-2 bg-[#f3f4f5] dark:bg-[#1f2325] text-slate-500 font-bold"
          />
        </label>

        <label className="font-bold text-xs uppercase text-[#737780]">
          Armazém de Destino / Origem
          <select
            value={warehouseId}
            onChange={(event) => onWarehouseChange(event.target.value)}
            className="mt-1 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-2 dark:bg-[#282c2e] font-bold"
          >
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </label>

        {type === 'entrada' ? (
          <label className="font-bold text-xs uppercase text-[#737780]">
            Fornecedor
            <select
              value={supplierId}
              onChange={(event) => onSupplierChange(event.target.value)}
              className="mt-1 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-2 dark:bg-[#282c2e]"
            >
              <option value="">Sem fornecedor associado</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="font-bold text-xs uppercase text-[#737780]">
            Data da Guia
            <input
              type="date"
              value={documentDate}
              onChange={(event) => onDocumentDateChange(event.target.value)}
              className="mt-1 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-2 dark:bg-[#282c2e]"
            />
          </label>
        )}
      </div>

      {type === 'entrada' && (
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-6 border-t pt-2 dark:border-slate-800">
          <label className="font-bold text-xs uppercase text-[#737780]">
            Data da Guia
            <input
              type="date"
              value={documentDate}
              onChange={(event) => onDocumentDateChange(event.target.value)}
              className="mt-1 w-full rounded border border-[#c3c6d1] dark:border-[#43474f] p-2 dark:bg-[#282c2e]"
            />
          </label>
        </div>
      )}

      {/* Add Items Input Row */}
      <div className="bg-slate-50 dark:bg-[#282c2e] p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
        <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Adicionar Artigo à Guia</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2 items-end">
          <div className="lg:col-span-4">
            <ArticleSearchSelect
              articles={articles}
              selectedArticleId={articleId}
              onSelect={onSelectArticle}
              onAfterSelect={onAfterArticleSelect}
              onResolveArticle={onResolveArticle}
              loadOptions={directArticleLoader}
              placeholder="Código do Artigo (Ex: PNEU-001)"
              className="font-bold"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Qtd a Movimentar</label>
            <input
              ref={qtyInputRef}
              type="number"
              min="0.001"
              step="any"
              value={quantityStr}
              onChange={(e) => onQuantityChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (type === 'entrada' && canViewCost) {
                    costInputRef.current?.focus();
                    costInputRef.current?.select();
                  } else {
                    onAddItemToGuide();
                  }
                }
              }}
              placeholder="0.00"
              className="w-full rounded border border-gray-300 p-1.5 text-xs font-mono font-bold dark:bg-[#1f2325] dark:border-gray-600 dark:text-white"
            />
          </div>
          {type === 'entrada' && canViewCost && (
            <div className="lg:col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Preço Custo Unit. (MZN)</label>
              <input
                ref={costInputRef}
                type="number"
                min="0"
                step="0.01"
                value={unitCostStr}
                onChange={(e) => onUnitCostChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    priceInputRef.current?.focus();
                    priceInputRef.current?.select();
                  }
                }}
                placeholder={article ? String(article.costPrice || '') : '0.00'}
                className="w-full rounded border border-gray-300 p-1.5 text-xs font-mono dark:bg-[#1f2325] dark:border-gray-600 dark:text-white"
              />
            </div>
          )}
          {type === 'entrada' && (
            <div className="lg:col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">P. Venda c/ IVA (MZN)</label>
              <input
                ref={priceInputRef}
                type="number"
                min="0"
                step="0.01"
                value={priceWithIvaStr}
                onChange={(e) => onPriceWithIvaChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onAddItemToGuide();
                  }
                }}
                placeholder={article ? String(article.sellPriceWithIva || article.sellPrice || '') : '0.00'}
                className="w-full rounded border border-gray-300 p-1.5 text-xs font-mono text-emerald-600 font-bold dark:bg-[#1f2325] dark:border-gray-600 dark:text-emerald-400"
              />
            </div>
          )}
          <div className={`${type === 'entrada' && canViewCost ? 'lg:col-span-2' : type === 'entrada' ? 'lg:col-span-4' : 'lg:col-span-6'}`}>
            <button
              type="button"
              onClick={onAddItemToGuide}
              className="w-full py-1.5 px-3 bg-[#003366] text-white font-bold rounded text-xs hover:bg-blue-900 transition-colors shadow-sm flex items-center justify-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">add</span> Adicionar à Guia
            </button>
          </div>
        </div>
      </div>

      {/* Guide Items Table */}
      {guideItems.length > 0 && (
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
          <div className="bg-slate-100 dark:bg-[#282c2e] p-2 font-bold text-xs uppercase flex justify-between items-center text-slate-700 dark:text-slate-300">
            <span>Artigos incluídos nesta Guia ({guideItems.length}/99)</span>
            {type === 'entrada' && canViewCost && supplierCreditTotal > 0 && (
              <span className="text-emerald-700 dark:text-emerald-400 font-mono text-xs">
                Total de Custo da Guia: <b>{formatMZN(supplierCreditTotal)}</b>
              </span>
            )}
          </div>
          <div className="overflow-x-auto max-h-60 overflow-y-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-[#1f2325] text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-2">#</th>
                  <th className="p-2">Código</th>
                  <th className="p-2">Descrição</th>
                  <th className="p-2 text-right">Qtd</th>
                  {type === 'entrada' && canViewCost && <th className="p-2 text-right">Custo Unit.</th>}
                  {type === 'entrada' && <th className="p-2 text-right">P. Venda c/ IVA</th>}
                  <th className="p-2 text-right">Stock Actual</th>
                  <th className="p-2 text-right">Stock Previsto</th>
                  <th className="p-2 text-center">Acção</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {guideItems.map((item, idx) => {
                  const origQty = editingDocument?.stockGuideItems?.find((orig) => orig.articleId === item.articleId)?.quantity ?? 0;
                  const projStock = projectStockAfterMovement(item.currentStock, type, item.quantity, origQty);

                  return (
                    <tr key={`${item.articleId}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-2 text-slate-400">{idx + 1}</td>
                      <td className="p-2 font-mono font-bold">{item.articleCode}</td>
                      <td className="p-2">{item.articleDescription}</td>
                      <td className="p-2 text-right font-mono font-black text-primary dark:text-blue-300">
                        {item.quantity.toFixed(2)}
                      </td>
                      {type === 'entrada' && canViewCost && (
                        <td className="p-2 text-right font-mono">{item.unitCost ? formatMZN(item.unitCost) : '-'}</td>
                      )}
                      {type === 'entrada' && (
                        <td className="p-2 text-right font-mono text-emerald-600 font-bold">
                          {item.salePriceWithIva ? formatMZN(item.salePriceWithIva) : '-'}
                        </td>
                      )}
                      <td className="p-2 text-right font-mono">{item.currentStock.toFixed(2)}</td>
                      <td
                        className={`p-2 text-right font-mono font-bold ${
                          projStock < 0 ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        {projStock.toFixed(2)}
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => onRemoveItemFromGuide(idx)}
                          className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded cursor-pointer"
                          title="Remover da guia"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation and Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 border-[#c3c6d1] dark:border-[#43474f]">
        <div className="flex items-center gap-2">
          {editingGuideId && (
            <button
              type="button"
              onClick={onClearGuideForm}
              className="px-3 py-2 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded font-bold text-xs cursor-pointer"
            >
              Cancelar Edição
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={saving || (guideItems.length === 0 && !articleId)}
            onClick={onSubmitGuide}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#003366] text-white font-bold rounded shadow hover:bg-blue-900 transition-colors disabled:opacity-50 text-xs uppercase tracking-wider cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">save</span>
            {saving
              ? 'A gravar guia...'
              : editingGuideId
              ? 'Atualizar Guia'
              : 'Gravar e Confirmar Guia (F2)'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 text-rose-700 rounded border border-rose-200 text-xs font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-base">error</span> {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-emerald-50 text-emerald-700 rounded border border-emerald-200 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">check_circle</span> {success}
          </div>
          {lastSavedGuide && onOpenDocument && (
            <button
              type="button"
              onClick={() => onOpenDocument(lastSavedGuide)}
              className="px-3 py-1 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700 font-bold"
            >
              Imprimir Guia
            </button>
          )}
        </div>
      )}
    </section>
  );
};
