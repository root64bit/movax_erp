import React from 'react';
import type { PosDocumentType, PosDocStatus } from '../types/pos.types';

export interface PosHeaderProps {
  documentType: PosDocumentType;
  docStatus: PosDocStatus;
  docNumber: string;
  isGuiaOnlyUser: boolean;
  onSelectDocumentType: (type: PosDocumentType) => void;
  onResetForm: () => void;
}

export const PosHeader: React.FC<PosHeaderProps> = ({
  documentType,
  docStatus,
  docNumber,
  isGuiaOnlyUser,
  onSelectDocumentType,
  onResetForm,
}) => {
  return (
    <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-3 rounded-lg shadow-sm flex flex-wrap items-center justify-between gap-3 print:hidden">
      <div className="flex items-center space-x-2">
        <button
          type="button"
          disabled={isGuiaOnlyUser}
          onClick={() => onSelectDocumentType('CUSTOMER_INVOICE')}
          className={`px-4 py-2 rounded-md font-extrabold text-xs uppercase transition-all ${
            isGuiaOnlyUser
              ? 'opacity-40 cursor-not-allowed bg-slate-200 dark:bg-slate-800 text-slate-400'
              : documentType === 'CUSTOMER_INVOICE'
                ? 'bg-[#003366] text-white shadow-md'
                : 'bg-[#f3f4f5] dark:bg-[#282c2e] text-[#737780] hover:text-[#191c1d] dark:hover:text-white'
          }`}
          title={isGuiaOnlyUser ? 'Apenas o Administrador pode emitir Faturas' : ''}
        >
          Factura
        </button>
        <button
          type="button"
          disabled={isGuiaOnlyUser}
          onClick={() => onSelectDocumentType('CASH_SALE')}
          className={`px-4 py-2 rounded-md font-extrabold text-xs uppercase transition-all ${
            isGuiaOnlyUser
              ? 'opacity-40 cursor-not-allowed bg-slate-200 dark:bg-slate-800 text-slate-400'
              : documentType === 'CASH_SALE'
                ? 'bg-[#006e25] text-white shadow-md'
                : 'bg-[#f3f4f5] dark:bg-[#282c2e] text-[#737780] hover:text-[#191c1d] dark:hover:text-white'
          }`}
          title={isGuiaOnlyUser ? 'Apenas o Administrador pode emitir Vendas a Dinheiro' : ''}
        >
          Venda a Dinheiro
        </button>
        <button
          type="button"
          onClick={() => onSelectDocumentType('CUSTOMER_DELIVERY_NOTE')}
          className={`px-4 py-2 rounded-md font-extrabold text-xs uppercase transition-all ${
            documentType === 'CUSTOMER_DELIVERY_NOTE'
              ? 'bg-[#001e40] text-white shadow-md'
              : 'bg-[#f3f4f5] dark:bg-[#282c2e] text-[#737780] hover:text-[#191c1d] dark:hover:text-white'
          }`}
        >
          Guia de Remessa
        </button>
      </div>

      <div className="flex items-center space-x-3 text-xs font-mono">
        <div className="text-right">
          <span className="text-[#737780] block text-[10px] uppercase font-bold">Nº Documento</span>
          <span className="font-bold text-sm text-[#003366] dark:text-[#a7c8ff]">{docNumber}</span>
        </div>
        <div className="h-6 w-px bg-slate-300 dark:bg-slate-700" />
        <span
          className={`px-2.5 py-1 rounded text-[11px] font-extrabold uppercase ${
            docStatus === 'CONFIRMED'
              ? 'bg-green-100 text-green-800 border border-green-300'
              : docStatus === 'READ_ONLY'
              ? 'bg-purple-100 text-purple-800 border border-purple-300'
              : docStatus === 'CONFIRMING'
              ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
              : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}
        >
          {docStatus === 'CONFIRMED'
            ? 'CONFIRMADO'
            : docStatus === 'READ_ONLY'
            ? 'EM CONSULTA (LEITURA)'
            : docStatus === 'CONFIRMING'
            ? 'A CONFIRMAR'
            : 'EM PREPARAÇÃO'}
        </span>
        <button
          type="button"
          onClick={onResetForm}
          className="rounded border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer"
        >
          F5 — Novo
        </button>
      </div>
    </section>
  );
};
