import React from 'react';
import type { Article, SaleItem } from '@/shared/types/domain.types';
import type { PosDocumentType, PosDocStatus } from '../types/pos.types';
import type { usePosItemDraft } from '../hooks/usePosItemDraft';
import { formatMZN } from '@/shared/utils/formatters';
import { ArticleSearchSelect } from '@/features/inventory/components/ArticleSearchSelect';
import { calculateDocumentLine } from '@/lib/documentCalculations';
import { getArticlePriceWithIva } from '../utils/posCalculations';

export interface PosCartTableProps {
  documentType: PosDocumentType;
  docStatus: PosDocStatus;
  items: SaleItem[];
  articles: Article[];
  draft: ReturnType<typeof usePosItemDraft>;
  articleSearchLoader: (query: string) => Promise<Article[]>;
  onRemoveItem: (index: number) => void;
}

export const PosCartTable: React.FC<PosCartTableProps> = ({
  documentType,
  docStatus,
  items,
  articles,
  draft,
  articleSearchLoader,
  onRemoveItem,
}) => {
  const isReadOnly = docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY';
  const selectedArticle = draft.findArticle(draft.selectedArticleId);
  const effectiveUnitPrice =
    draft.inputUnitPrice > 0
      ? draft.inputUnitPrice
      : selectedArticle
      ? getArticlePriceWithIva(selectedArticle)
      : 0;

  const previewLine = calculateDocumentLine({
    quantity: draft.inputQty,
    unitPrice: effectiveUnitPrice,
    discountAmount: draft.inputDiscount,
    discountPercent: 0,
    ivaPercent: draft.inputIva,
  });

  return (
    <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded-lg overflow-hidden shadow-sm">
      <div className="bg-[#001e40] text-white px-4 py-2 text-xs font-bold uppercase flex justify-between items-center">
        <span>
          Artigos ·{' '}
          {documentType === 'CASH_SALE'
            ? 'Venda a Dinheiro'
            : documentType === 'CUSTOMER_DELIVERY_NOTE'
            ? 'Guia de Remessa'
            : 'Factura'}
        </span>
        <span>{items.length} artigo(s)</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-[#e7e8e9] dark:bg-[#282c2e] text-[#43474f] dark:text-[#c3c6d1] font-bold uppercase border-b border-[#c3c6d1]">
            <tr>
              <th className="p-3 w-48">Código Artigo</th>
              <th className="p-3">Descrição do Item / Artigo</th>
              <th className="p-3 w-20 text-center">Existência</th>
              <th className="p-3 w-24 text-center">Quant.</th>
              <th className="p-3 w-28 text-right">Preço Unit.</th>
              <th className="p-3 w-24 text-center">Desc. MZN</th>
              <th className="p-3 w-20 text-center">IVA %</th>
              <th className="p-3 w-32 text-right">Total c/ IVA</th>
              <th className="p-3 w-16 text-center print:hidden">Acção</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f] font-mono">
            {!isReadOnly && (
              <tr className="bg-[#0000aa]/10 dark:bg-[#282c2e] border-b-2 border-[#003366] print:hidden">
                <td className="p-2">
                  <ArticleSearchSelect
                    inputId="sale-article-search"
                    articles={articles}
                    selectedArticleId={draft.selectedArticleId}
                    onSelect={draft.handleArticleSelect}
                    loadOptions={articleSearchLoader}
                    onResolveArticle={draft.resolveArticle}
                    onAfterSelect={draft.handleAfterArticleSelect}
                    onEmptyEnter={draft.handleAfterArticleSelect}
                    renderLabel={(a) => `[${a.code}] ${a.description} - ${a.sellPrice.toFixed(2)} MZN (Stock: ${a.stock})`}
                    placeholder="Pesquisar catálogo (opcional)…"
                  />
                </td>
                <td className="p-2">
                  <input
                    ref={draft.customDescriptionInputRef}
                    type="text"
                    placeholder="Escreva a descrição do artigo ou serviço (ex: Alinhamento)..."
                    disabled={docStatus === 'CONFIRMING'}
                    value={draft.customDescription}
                    onChange={(e) => draft.setCustomDescription(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        draft.qtyInputRef.current?.focus();
                        draft.qtyInputRef.current?.select();
                      }
                    }}
                    className="w-full bg-white dark:bg-[#1f2325] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 text-xs font-medium focus-ring"
                  />
                </td>
                <td className="p-2 text-center font-bold text-[#006e25]">
                  {selectedArticle?.stock ?? 0}
                </td>
                <td className="p-2">
                  <input
                    ref={draft.qtyInputRef}
                    type="number"
                    min="1"
                    value={draft.inputQty}
                    onChange={(e) => draft.setInputQty(Number(e.target.value))}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        draft.unitPriceInputRef.current?.focus();
                        draft.unitPriceInputRef.current?.select();
                      }
                    }}
                    className="w-full border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#1f2325] dark:text-white rounded p-1.5 text-center text-xs font-bold bg-yellow-100 text-black focus:ring-2 focus:ring-[#003366]"
                  />
                </td>
                <td className="p-2 text-right font-bold text-gray-700 dark:text-white">
                  <input
                    ref={draft.unitPriceInputRef}
                    type="number"
                    step="0.01"
                    min="0"
                    value={draft.inputUnitPrice || (selectedArticle ? getArticlePriceWithIva(selectedArticle) : 0)}
                    onChange={(e) => draft.setInputUnitPrice(Number(e.target.value))}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        draft.discountInputRef.current?.focus();
                        draft.discountInputRef.current?.select();
                      }
                    }}
                    className="w-full border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#1f2325] dark:text-white rounded p-1.5 text-right text-xs font-bold text-[#001e40] dark:text-white focus:ring-2 focus:ring-[#003366]"
                  />
                </td>
                <td className="p-2">
                  <input
                    ref={draft.discountInputRef}
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.inputDiscount}
                    onChange={(e) => draft.setInputDiscount(Number(e.target.value))}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        draft.ivaInputRef.current?.focus();
                        draft.ivaInputRef.current?.select();
                      }
                    }}
                    className="w-full border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#1f2325] dark:text-white rounded p-1.5 text-center text-xs font-bold text-red-600 focus:ring-2 focus:ring-[#003366]"
                  />
                </td>
                <td className="p-2">
                  <input
                    ref={draft.ivaInputRef}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={draft.inputIva}
                    onChange={(e) => draft.setInputIva(Number(e.target.value))}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        draft.handleAddItem();
                      }
                    }}
                    className="w-full border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#1f2325] dark:text-white rounded p-1.5 text-center text-xs font-bold text-[#003366] focus:ring-2 focus:ring-[#003366]"
                  />
                </td>
                <td className="p-2 text-right font-extrabold text-[#006e25]">
                  {previewLine.totalWithTax.toFixed(2)}
                </td>
                <td className="p-2 text-center">
                  <button
                    type="button"
                    onClick={draft.handleAddItem}
                    className="rounded bg-[#003366] px-3 py-1.5 text-xs font-extrabold text-white hover:bg-blue-800 focus:ring-2 focus:ring-blue-400 uppercase tracking-wider cursor-pointer"
                  >
                    + Add
                  </button>
                </td>
              </tr>
            )}

            {items.map((item, index) => (
              <tr key={`${item.articleId}-${index}`} className="hover:bg-[#f3f4f5] dark:hover:bg-[#282c2e]">
                <td className="p-3 font-mono font-bold text-[#003366] dark:text-[#a7c8ff]">{item.code}</td>
                <td className="p-3 font-sans text-xs">{item.description}</td>
                <td className="p-3 text-center text-slate-500">
                  {draft.findArticle(item.articleId)?.stock ?? '-'}
                </td>
                <td className="p-3 text-center font-bold">{item.quantity}</td>
                <td className="p-3 text-right">{formatMZN(item.unitPrice)}</td>
                <td className="p-3 text-center text-red-600">{formatMZN(item.discountAmount || 0)}</td>
                <td className="p-3 text-center font-bold text-[#003366]">{item.ivaPercent}%</td>
                <td className="p-3 text-right font-bold text-[#006e25]">{formatMZN(item.total)}</td>
                <td className="p-3 text-center print:hidden">
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => onRemoveItem(index)}
                      className="text-red-600 hover:text-red-800 font-bold text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {items.length === 0 && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-slate-400 font-sans italic text-xs">
                  Nenhum artigo inserido. Digite o código do artigo no campo acima e prima Enter para adicionar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
