import React from 'react';
import type { SaleInvoice } from '@/shared/types/domain.types';
import { formatMZN } from '@/shared/utils/formatters';

interface SaleDocumentHistoryProps {
  documents: SaleInvoice[];
  guideOnly: boolean;
  operatorName: string;
  onPrint: (document: SaleInvoice) => void;
  onEdit: (document: SaleInvoice) => void;
}

export const SaleDocumentHistory:React.FC<SaleDocumentHistoryProps>=({documents,guideOnly,operatorName,onPrint,onEdit})=>(
  <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-4 rounded-lg shadow-sm print:hidden">
    <div className="flex items-center justify-between mb-3 border-b pb-2 dark:border-slate-700">
      <div className="flex items-center space-x-2">
        <span className="material-symbols-outlined text-[#003366] dark:text-[#a7c8ff]">local_shipping</span>
        <h3 className="font-extrabold text-sm text-[#001e40] dark:text-[#a7c8ff] uppercase tracking-wide">
          {guideOnly?'Histórico de Guias de Remessa Emitidas':'Histórico de Documentos Emitidos Recentemente'}
        </h3>
      </div>
      <span className="text-xs text-slate-500 font-mono">Total: {documents.length} documento(s)</span>
    </div>
    {documents.length===0?(
      <div className="p-4 text-center text-xs text-slate-500 font-mono">Nenhuma guia de remessa emitida recentemente.</div>
    ):(
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse font-mono">
          <thead><tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-b dark:border-slate-700 font-bold uppercase">
            <th className="p-2">Nº Documento</th><th className="p-2">Data</th><th className="p-2">Tipo</th>
            <th className="p-2">Cliente</th><th className="p-2 text-right">Valor Total</th><th className="p-2">Operador</th><th className="p-2 text-center">Acção</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {documents.slice(0,15).map((document)=>(
              <tr key={document.id||document.docNumber} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="p-2 font-bold text-[#003366] dark:text-[#a7c8ff]">{document.docNumber}</td>
                <td className="p-2">{document.date}</td>
                <td className="p-2"><span className="inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                  {document.documentTypeCode==='CUSTOMER_DELIVERY_NOTE'||document.docNumber?.startsWith('GR')?'Guia de Remessa':document.documentTypeCode==='CASH_SALE'?'VD':'Factura'}
                </span></td>
                <td className="p-2 font-bold">{document.clientName||'Cliente Pontual'}</td>
                <td className="p-2 text-right font-bold text-[#006e25]">{formatMZN(document.totalAmount)}</td>
                <td className="p-2 text-slate-600 dark:text-slate-400">{document.operatorName||operatorName||'Operador'}</td>
                <td className="p-2 text-center space-x-1">
                  <button type="button" onClick={()=>onPrint(document)} className="inline-flex items-center space-x-1 px-2.5 py-1 bg-[#003366] text-white rounded font-bold text-[11px] hover:bg-[#001e40] transition-all shadow-sm">
                    <span className="material-symbols-outlined text-xs">print</span><span>Imprimir</span>
                  </button>
                  <button type="button" onClick={()=>onEdit(document)} className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-600 text-white rounded font-bold text-[11px] hover:bg-amber-700 transition-all shadow-sm">
                    <span className="material-symbols-outlined text-xs">edit_note</span><span>Editar</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);
