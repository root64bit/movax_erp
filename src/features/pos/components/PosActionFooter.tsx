import React from 'react';
import type { SaleInvoice } from '@/shared/types/domain.types';
import type { PosDocumentType, PosDocStatus } from '../types/pos.types';
import { formatMZN } from '@/shared/utils/formatters';
import { SaleTotalsSection } from './SaleTotalsSection';

export interface PosActionFooterProps {
  documentType: PosDocumentType;
  docStatus: PosDocStatus;
  generalDiscount: number;
  onGeneralDiscountChange: (discount: number) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  appliedGeneralDiscount: number;
  grossTotal: number;
  lineDiscountTotal: number;
  netTotal: number;
  taxTotal: number;
  grandTotal: number;
  selectedClientName: string;
  itemCount: number;
  saving: boolean;
  saveError: string;
  confirmedSaleRecord: SaleInvoice | null;
  onAdjust: () => void;
  onResetForm: () => void;
  onSaveAndConfirm: (shouldPrint?: boolean) => Promise<void>;
  onF2Action: () => void;
  onOpenPrintModal: (sale: SaleInvoice) => void;
  setSaveError: (err: string) => void;
  setDocStatus: (status: PosDocStatus) => void;
}

export const PosActionFooter: React.FC<PosActionFooterProps> = ({
  documentType,
  docStatus,
  generalDiscount,
  onGeneralDiscountChange,
  notes,
  onNotesChange,
  appliedGeneralDiscount,
  grossTotal,
  lineDiscountTotal,
  netTotal,
  taxTotal,
  grandTotal,
  selectedClientName,
  itemCount,
  saving,
  saveError,
  confirmedSaleRecord,
  onAdjust,
  onResetForm,
  onSaveAndConfirm,
  onF2Action,
  onOpenPrintModal,
  setSaveError,
  setDocStatus,
}) => {
  const isReadOnly = docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY';

  return (
    <>
      <SaleTotalsSection
        generalDiscount={generalDiscount}
        onGeneralDiscountChange={onGeneralDiscountChange}
        notes={notes}
        onNotesChange={onNotesChange}
        disabled={isReadOnly}
        appliedGeneralDiscount={appliedGeneralDiscount}
        grossTotal={grossTotal}
        lineDiscountTotal={lineDiscountTotal}
        netTotal={netTotal}
        taxTotal={taxTotal}
        grandTotal={grandTotal}
      >
        {docStatus === 'CONFIRMING' && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 p-4 rounded-lg flex flex-wrap items-center justify-between gap-4 shadow-md font-sans print:hidden">
            <div>
              <h4 className="font-black text-amber-900 dark:text-amber-200 text-sm uppercase">
                Confirmar Emissão de{' '}
                {documentType === 'CASH_SALE'
                  ? 'Venda a Dinheiro'
                  : documentType === 'CUSTOMER_DELIVERY_NOTE'
                  ? 'Guia de Remessa'
                  : 'Factura'}
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Cliente: <b>{selectedClientName}</b> | Linhas: <b>{itemCount}</b> | Total Final:{' '}
                <b>{formatMZN(grandTotal)}</b>
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={onAdjust}
                className="px-3 py-1.5 border border-amber-600 text-amber-900 dark:text-amber-200 rounded font-bold text-xs uppercase hover:bg-amber-100 dark:hover:bg-amber-900 cursor-pointer"
              >
                F3 — Ajustar (ESC)
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void onSaveAndConfirm(false)}
                className="px-5 py-2 bg-[#006e25] text-white rounded font-black text-xs uppercase hover:bg-green-700 shadow-md cursor-pointer"
              >
                {saving ? 'A gravar…' : 'Confirmar (F2 / Enter)'}
              </button>
            </div>
          </div>
        )}

        {docStatus === 'CONFIRMED' && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-400 dark:border-emerald-700 p-3 rounded-lg flex flex-wrap items-center justify-between gap-3 shadow-xs font-sans print:hidden">
            <div className="flex items-center space-x-2">
              <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-lg">check_circle</span>
              <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                Documento gravado com sucesso! Prima <b>F2</b> ou <b>F5</b> para criar uma nova factura.
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onResetForm}
                className="px-3 py-1.5 bg-[#006e25] text-white rounded font-bold text-xs uppercase hover:bg-green-700 shadow-xs cursor-pointer"
              >
                + Nova Factura (F2)
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center pt-2 border-t border-[#c3c6d1] dark:border-[#43474f] print:hidden">
          {saveError && (
            <p role="alert" className="rounded bg-red-100 p-2 text-xs font-bold text-red-800 print:hidden">
              {saveError}
            </p>
          )}

          <div className="flex items-center space-x-3 ml-auto">
            {isReadOnly ? (
              <>
                <button
                  type="button"
                  onClick={onResetForm}
                  className="px-5 py-2 bg-[#006e25] text-white rounded font-black text-xs uppercase hover:brightness-110 shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">add_circle</span>
                  <span>Nova Factura (F2 / F5)</span>
                </button>
                {confirmedSaleRecord && (
                  <button
                    type="button"
                    onClick={() => onOpenPrintModal(confirmedSaleRecord)}
                    className="px-5 py-2 bg-[#003366] text-white rounded font-bold text-xs uppercase hover:bg-blue-800 shadow-sm cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">print</span>
                    <span>Imprimir documento (F9)</span>
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onResetForm}
                  className="px-4 py-2 bg-[#ba1a1a] text-white rounded font-bold text-xs uppercase hover:bg-red-800 cursor-pointer"
                >
                  Novo (F5)
                </button>
                <button
                  type="button"
                  disabled={saving || itemCount === 0}
                  onClick={() => {
                    if (docStatus === 'CONFIRMING') {
                      void onSaveAndConfirm(true);
                    } else {
                      setDocStatus('CONFIRMING');
                    }
                  }}
                  className="px-4 py-2 bg-[#003366] text-white rounded font-bold text-xs uppercase hover:brightness-110 disabled:opacity-50 cursor-pointer"
                >
                  Confirmar e imprimir (F9)
                </button>
                <button
                  type="button"
                  disabled={saving || itemCount === 0}
                  onClick={onF2Action}
                  className="px-6 py-2 bg-[#006e25] text-white rounded font-black text-xs uppercase hover:brightness-110 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'A gravar…' : docStatus === 'CONFIRMING' ? 'Confirmar (F2)' : 'Gravar (F2)'}
                </button>
              </>
            )}
          </div>
        </div>
      </SaleTotalsSection>

      <div className="flex flex-col gap-2 rounded border-t border-[#c3c6d1] bg-[#e7e8e9] px-3 py-2 text-xs font-mono font-bold text-[#191c1d] shadow-sm dark:border-[#43474f] dark:bg-[#282c2e] dark:text-white sm:flex-row sm:items-center sm:justify-between sm:px-6 print:hidden">
        <div className="flex flex-wrap items-center gap-3 sm:gap-6">
          <span>ESC=Sair</span>
          <button type="button" onClick={onF2Action} className="hover:underline cursor-pointer">
            <span className="bg-[#003366] text-white px-2 py-0.5 rounded">
              {isReadOnly ? 'F2=Novo' : docStatus === 'CONFIRMING' ? 'F2=Confirmar' : 'F2=Gravar'}
            </span>
          </button>
          <button type="button" onClick={onAdjust} className="hover:underline cursor-pointer">
            <span>F3=Ajustar</span>
          </button>
          <button type="button" onClick={onResetForm} className="hover:underline cursor-pointer">
            <span>F5=Novo</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (isReadOnly && confirmedSaleRecord) {
                onOpenPrintModal(confirmedSaleRecord);
              } else {
                setSaveError('Confirme primeiro o documento com F2 antes de imprimir com F9.');
              }
            }}
            className="hover:underline cursor-pointer"
          >
            <span className="bg-[#003366] text-white px-2 py-0.5 rounded">F9=Imp</span>
          </button>
        </div>
        <div className="text-[11px]">
          Tipo Activo: <b className="uppercase text-[#006e25]">{documentType}</b> | Estado: <b>{docStatus}</b> | Cliente: <b>{selectedClientName || 'Nenhum'}</b>
        </div>
      </div>
    </>
  );
};
