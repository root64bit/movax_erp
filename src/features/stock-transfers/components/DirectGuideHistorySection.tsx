import React from 'react';
import type { DocumentRecord } from '@/shared/types/domain.types';
import { formatMZN } from '@/shared/utils/formatters';

export interface DirectGuideHistorySectionProps {
  stockGuideDocuments: DocumentRecord[];
  lastSavedGuide: DocumentRecord | null;
  canCancelGuide: boolean;
  onOpenDocument?: (doc: DocumentRecord) => void;
  onEditGuide: (doc: DocumentRecord) => void;
  onCancelGuide: (doc: DocumentRecord) => void;
}

export const DirectGuideHistorySection: React.FC<DirectGuideHistorySectionProps> = ({
  stockGuideDocuments,
  lastSavedGuide,
  canCancelGuide,
  onOpenDocument,
  onEditGuide,
  onCancelGuide,
}) => {
  return (
    <section className="overflow-hidden rounded-lg border border-[#c3c6d1] bg-white shadow-sm dark:border-[#43474f] dark:bg-[#1f2325] print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#c3c6d1] bg-slate-100 px-4 py-3 dark:border-[#43474f] dark:bg-slate-800">
        <h2 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200">
          Guias de Entrada / Saída de Stock ({stockGuideDocuments.length})
        </h2>
        {lastSavedGuide && onOpenDocument && (
          <button
            type="button"
            onClick={() => onOpenDocument(lastSavedGuide)}
            className="rounded bg-[#003366] px-3 py-1.5 text-xs font-extrabold uppercase text-white hover:brightness-110 cursor-pointer"
          >
            Imprimir última guia
          </button>
        )}
      </div>

      {stockGuideDocuments.length === 0 ? (
        <div className="p-6 text-center text-xs font-bold text-slate-500">
          Nenhuma guia de entrada ou saída registada.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead className="border-b border-[#c3c6d1] bg-[#e7e8e9] text-[11px] font-bold uppercase text-slate-700 dark:border-[#43474f] dark:bg-[#282c2e] dark:text-slate-300">
              <tr>
                <th className="p-3 text-left">Número</th>
                <th className="p-3 text-left">Data</th>
                <th className="p-3 text-left">Tipo</th>
                <th className="p-3 text-left">Fornecedor / Origem</th>
                <th className="p-3 text-right">Itens</th>
                <th className="p-3 text-right">Valor Fornecedor</th>
                <th className="p-3 text-left">Estado</th>
                <th className="p-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
              {stockGuideDocuments.slice(0, 50).map((document) => {
                const isCancelled = document.status === 'CANCELLED' || document.status === 'REVERSED';
                const isEntry = document.typeCode === 'STOCK_ENTRY_GUIDE';
                const itemCount = document.stockGuideItems?.length ?? 0;

                return (
                  <tr key={document.id} className="hover:bg-slate-50 dark:hover:bg-[#282c2e]">
                    <td className="p-3 font-black text-[#003366] dark:text-[#a7c8ff]">
                      {document.externalReference || document.displayNumber}
                    </td>
                    <td className="p-3">{document.date}</td>
                    <td className="p-3">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                          isEntry ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-900'
                        }`}
                      >
                        {isEntry ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td className="p-3 font-bold">
                      {document.partyName || (isEntry ? 'Sem fornecedor' : 'Saída interna')}
                    </td>
                    <td className="p-3 text-right font-bold">{itemCount}</td>
                    <td className="p-3 text-right font-bold">{formatMZN(document.grandTotal || 0)}</td>
                    <td className="p-3">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                          isCancelled ? 'bg-red-100 text-red-900' : 'bg-emerald-100 text-emerald-900'
                        }`}
                      >
                        {isCancelled ? 'Anulada' : 'Confirmada'}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1">
                        {onOpenDocument && (
                          <button
                            type="button"
                            onClick={() => onOpenDocument(document)}
                            className="rounded bg-[#003366] px-2 py-1 text-[11px] font-bold text-white hover:brightness-110 cursor-pointer"
                            title="Imprimir guia"
                          >
                            Imprimir
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onEditGuide(document)}
                          disabled={isCancelled}
                          className="rounded bg-orange-600 px-2 py-1 text-[11px] font-bold text-white hover:brightness-110 disabled:opacity-40 cursor-pointer"
                          title="Editar guia"
                        >
                          Editar
                        </button>
                        {canCancelGuide && (
                          <button
                            type="button"
                            onClick={() => onCancelGuide(document)}
                            disabled={isCancelled}
                            className="rounded bg-red-700 px-2 py-1 text-[11px] font-bold text-white hover:brightness-110 disabled:opacity-40 cursor-pointer"
                            title="Anular guia e reverter stock"
                          >
                            Anular
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
      )}
    </section>
  );
};
