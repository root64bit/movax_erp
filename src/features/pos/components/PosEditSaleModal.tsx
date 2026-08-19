import React, { useState, useEffect } from 'react';
import type { Article, SaleInvoice, SaleItem } from '@/shared/types/domain.types';
import { formatMZN } from '@/shared/utils/formatters';
import { ArticleSearchSelect } from '@/features/inventory/components/ArticleSearchSelect';
import { calculateDocumentLine, calculateDocumentTotals, recalculateSaleItem, recalculateSaleItems } from '@/lib/documentCalculations';
import { getArticlePriceWithIva } from '../utils/posCalculations';

export interface PosEditSaleModalProps {
  editingSale: SaleInvoice | null;
  articles: Article[];
  articleSearchLoader: (query: string) => Promise<Article[]>;
  onClose: () => void;
  onUpdateDocument?: (
    documentId: string,
    payload: {
      documentDate?: string;
      clientName?: string;
      clientNuit?: string;
      clientAddress?: string;
      grandTotal?: number;
      notes?: string;
      items?: SaleItem[];
      generalDiscount?: number;
      keepAsWalkIn?: boolean;
    }
  ) => Promise<void>;
}

export const PosEditSaleModal: React.FC<PosEditSaleModalProps> = ({
  editingSale,
  articles,
  articleSearchLoader,
  onClose,
  onUpdateDocument,
}) => {
  const [editDocumentDate, setEditDocumentDate] = useState(() => (editingSale?.date || new Date().toISOString()).slice(0, 10));
  const [editClientName, setEditClientName] = useState(() => editingSale?.clientName || '');
  const [editClientNuit, setEditClientNuit] = useState(() => editingSale?.clientNuit || '');
  const [editClientAddress, setEditClientAddress] = useState(() => editingSale?.clientAddress || '');
  const [editGrandTotal, setEditGrandTotal] = useState(() => editingSale?.totalAmount || 0);
  const [editNotes, setEditNotes] = useState(() => editingSale?.notes || '');
  const [editGeneralDiscount, setEditGeneralDiscount] = useState(() => {
    if (!editingSale) return 0;
    const lineDiscount = (editingSale.items || []).reduce((sum, item) => sum + (item.discountAmount || 0), 0);
    return editingSale.generalDiscountAmount ?? Math.max(0, (editingSale.descontoTotal || 0) - lineDiscount);
  });
  const [editKeepAsWalkIn, setEditKeepAsWalkIn] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const [editItems, setEditItems] = useState<SaleItem[]>(() => {
    if (!editingSale) return [];
    let loadedItems: SaleItem[] = editingSale.items && editingSale.items.length > 0 ? JSON.parse(JSON.stringify(editingSale.items)) : [];
    if (loadedItems.length === 0 && (editingSale.totalAmount || 0) > 0) {
      loadedItems = [
        {
          articleId: `custom-${Date.now()}`,
          code: 'DIV',
          description: editingSale.notes || 'Venda Diversa Registada',
          quantity: 1,
          unitPrice: editingSale.totalAmount || 0,
          discountPercent: 0,
          discountAmount: 0,
          ivaPercent: 16,
          total: editingSale.totalAmount || 0,
          lineType: 'MANUAL',
          stockEffectEnabled: false,
        },
      ];
    }
    return recalculateSaleItems(loadedItems);
  });

  useEffect(() => {
    if (!editingSale) return;
    setEditDocumentDate((editingSale.date || new Date().toISOString()).slice(0, 10));
    setEditClientName(editingSale.clientName || '');
    setEditClientNuit(editingSale.clientNuit || '');
    setEditClientAddress(editingSale.clientAddress || '');
    setEditGrandTotal(editingSale.totalAmount || 0);
    setEditNotes(editingSale.notes || '');
    const lineDiscount = (editingSale.items || []).reduce((sum, item) => sum + (item.discountAmount || 0), 0);
    setEditGeneralDiscount(editingSale.generalDiscountAmount ?? Math.max(0, (editingSale.descontoTotal || 0) - lineDiscount));
    setEditKeepAsWalkIn(false);

    let loadedItems: SaleItem[] = editingSale.items && editingSale.items.length > 0 ? JSON.parse(JSON.stringify(editingSale.items)) : [];
    if (loadedItems.length === 0 && (editingSale.totalAmount || 0) > 0) {
      loadedItems = [
        {
          articleId: `custom-${Date.now()}`,
          code: 'DIV',
          description: editingSale.notes || 'Venda Diversa Registada',
          quantity: 1,
          unitPrice: editingSale.totalAmount || 0,
          discountPercent: 0,
          discountAmount: 0,
          ivaPercent: 16,
          total: editingSale.totalAmount || 0,
          lineType: 'MANUAL',
          stockEffectEnabled: false,
        },
      ];
    }
    setEditItems(recalculateSaleItems(loadedItems));
    setEditError('');
  }, [editingSale]);

  useEffect(() => {
    if (editingSale) {
      setEditGrandTotal(calculateDocumentTotals(editItems, editGeneralDiscount).grandTotal);
    }
  }, [editItems, editGeneralDiscount, editingSale]);

  if (!editingSale) return null;

  const appendArticleToEdit = (art: Article) => {
    const priceWithIva = getArticlePriceWithIva(art);
    setEditItems((previous) => {
      const updated = [
        ...previous,
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
        },
      ];
      setEditGrandTotal(calculateDocumentTotals(updated, editGeneralDiscount).grandTotal);
      return updated;
    });
  };

  const handleExecuteSaveEditSale = async () => {
    if (!editingSale || !onUpdateDocument || isSavingEdit) return;
    if (editItems.length === 0) {
      setEditError('O documento deve manter pelo menos um artigo ou serviço.');
      return;
    }
    try {
      setIsSavingEdit(true);
      setEditError('');
      await onUpdateDocument(editingSale.id, {
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
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao gravar as alterações do documento.';
      setEditError(message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 print:hidden">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border bg-white p-6 shadow-2xl dark:bg-[#1f2325] dark:border-[#43474f] space-y-4">
        <div className="flex items-center justify-between border-b pb-3 text-[#003366] dark:text-[#a7c8ff]">
          <div className="flex items-center space-x-2">
            <span className="material-symbols-outlined text-2xl">edit_note</span>
            <h3 className="font-black text-sm uppercase tracking-wide">
              Editar Documento {editingSale.docNumber}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 font-bold cursor-pointer"
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
            Manter como Cliente Pontual (não criar ficha; guardar o nome/NUIT/morada neste documento)
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
                    setEditItems((prev) => [
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
                      },
                    ]);
                  }}
                  className="px-2.5 py-1 bg-[#003366] text-white font-bold rounded text-[11px] hover:bg-blue-900 transition-colors shadow-sm flex items-center gap-1 cursor-pointer"
                >
                  <span>+ Artigo Manual</span>
                </button>
              </div>
              <ArticleSearchSelect
                articles={articles}
                selectedArticleId=""
                onSelect={() => undefined}
                loadOptions={articleSearchLoader}
                onResolveArticle={appendArticleToEdit}
                renderLabel={(a) => `[${a.code}] ${a.description} - ${(a.sellPriceWithIva || a.sellPrice).toFixed(2)} MZN (Stock: ${a.stock})`}
                placeholder="Pesquisar artigo do catálogo..."
                className="w-full"
              />
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
                              setEditItems((prev) => {
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
                              setEditItems((prev) => {
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
                            setEditItems((prev) => {
                              const updated = prev.filter((_, i) => i !== idx);
                              setEditGrandTotal(calculateDocumentTotals(updated, editGeneralDiscount).grandTotal);
                              return updated;
                            });
                          }}
                          className="mt-4 p-1 text-red-600 hover:text-red-800 font-bold hover:bg-red-50 dark:hover:bg-red-900/30 rounded cursor-pointer"
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
                              setEditItems((prev) => {
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
                              setEditItems((prev) => {
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
                              setEditItems((prev) => {
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
                            value={item.ivaPercent ?? 16}
                            onChange={(e) => {
                              const iva = Number(e.target.value);
                              setEditItems((prev) => {
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
            onClick={onClose}
            className="rounded border border-gray-300 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isSavingEdit || !editDocumentDate || !editClientName.trim()}
            onClick={handleExecuteSaveEditSale}
            className="rounded bg-[#003366] px-4 py-2 text-xs font-bold text-white hover:bg-[#002244] disabled:opacity-50 cursor-pointer"
          >
            {isSavingEdit ? 'A guardar…' : 'Gravar Alterações'}
          </button>
        </div>
      </div>
    </div>
  );
};
