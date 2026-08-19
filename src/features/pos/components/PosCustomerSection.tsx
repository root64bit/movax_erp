import React from 'react';
import type { Client, DocumentRecord, ReferenceOption } from '@/shared/types/domain.types';
import type { PosDocumentType, PosDocStatus } from '../types/pos.types';
import { formatMZN } from '@/shared/utils/formatters';
import { SaleBalanceSummary } from './SaleBalanceSummary';

export interface PosCustomerSectionProps {
  documentType: PosDocumentType;
  docStatus: PosDocStatus;
  date: string;
  onDateChange: (date: string) => void;
  dateInputRef: React.RefObject<HTMLInputElement>;
  clientCodeInput: string;
  onClientCodeChange: (code: string) => void;
  onLookupClientByCode: (code: string) => void;
  clientCodeInputRef: React.RefObject<HTMLInputElement>;
  selectedClientId: string;
  selectedClientName: string;
  onClientNameChange: (name: string) => void;
  clientNameInputRef: React.RefObject<HTMLInputElement>;
  clientNameMatches: Client[];
  showClientNameMatches: boolean;
  setShowClientNameMatches: (show: boolean) => void;
  onApplySelectedClient: (client: Client) => void;
  keepAsWalkIn: boolean;
  onKeepAsWalkInChange: (val: boolean) => void;
  clientNuit: string;
  onClientNuitChange: (nuit: string) => void;
  clientNuitInputRef: React.RefObject<HTMLInputElement>;
  clientAddress: string;
  onClientAddressChange: (address: string) => void;
  clientAddressInputRef: React.RefObject<HTMLInputElement>;
  paymentSelection: string;
  onPaymentSelectionChange: (val: string) => void;
  paymentSelectionRef: React.RefObject<HTMLSelectElement>;
  paymentReference: string;
  onPaymentReferenceChange: (val: string) => void;
  paymentTerms: ReferenceOption[];
  paymentMethods: ReferenceOption[];
  selectedPaymentMethod?: ReferenceOption;
  deliveryLocation: string;
  onDeliveryLocationChange: (val: string) => void;
  deliveryLocationRef: React.RefObject<HTMLInputElement>;
  previousBalance: number;
  totalFinalAmount: number;
  newAccumulatedBalance: number;
  documents?: DocumentRecord[];
  showClientInvoices: boolean;
  onCloseClientInvoices: () => void;
}

export const PosCustomerSection: React.FC<PosCustomerSectionProps> = ({
  documentType,
  docStatus,
  date,
  onDateChange,
  dateInputRef,
  clientCodeInput,
  onClientCodeChange,
  onLookupClientByCode,
  clientCodeInputRef,
  selectedClientId,
  selectedClientName,
  onClientNameChange,
  clientNameInputRef,
  clientNameMatches,
  showClientNameMatches,
  setShowClientNameMatches,
  onApplySelectedClient,
  keepAsWalkIn,
  onKeepAsWalkInChange,
  clientNuit,
  onClientNuitChange,
  clientNuitInputRef,
  clientAddress,
  onClientAddressChange,
  clientAddressInputRef,
  paymentSelection,
  onPaymentSelectionChange,
  paymentSelectionRef,
  paymentReference,
  onPaymentReferenceChange,
  paymentTerms,
  paymentMethods,
  selectedPaymentMethod,
  deliveryLocation,
  onDeliveryLocationChange,
  deliveryLocationRef,
  previousBalance,
  totalFinalAmount,
  newAccumulatedBalance,
  documents = [],
  showClientInvoices,
  onCloseClientInvoices,
}) => {
  const isReadOnly = docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY';

  return (
    <>
      <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-3 print:p-2 rounded-lg shadow-sm print:shadow-none space-y-2 print:space-y-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-xs print:text-[10px]">
          {/* Left Column */}
          <div className="space-y-2 print:space-y-1">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px] print:text-[9px]">Data Emissão</label>
                <input
                  ref={dateInputRef}
                  type="date"
                  value={date}
                  disabled={isReadOnly}
                  onChange={(e) => onDateChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      clientCodeInputRef.current?.focus();
                      clientCodeInputRef.current?.select();
                    }
                  }}
                  className="w-full bg-white dark:bg-[#282c2e] dark:text-white font-mono border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 print:p-1 text-xs print:text-[10px] focus-ring disabled:opacity-60"
                />
              </div>
              <div className="col-span-2">
                <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px] print:text-[9px]">Código Cliente</label>
                <input
                  ref={clientCodeInputRef}
                  type="text"
                  placeholder="Ex: 5"
                  value={clientCodeInput}
                  disabled={isReadOnly}
                  onChange={(e) => onClientCodeChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onLookupClientByCode(clientCodeInput);
                      setTimeout(() => {
                        clientNameInputRef.current?.focus();
                        clientNameInputRef.current?.select();
                      }, 0);
                    }
                  }}
                  onBlur={() => onLookupClientByCode(clientCodeInput)}
                  className="w-full bg-white dark:bg-[#282c2e] dark:text-white font-mono border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 print:p-1 text-xs print:text-[10px] focus-ring font-bold disabled:opacity-60"
                />
              </div>
            </div>

            <div className="relative">
              <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px] print:text-[9px]">Nome do Cliente</label>
              <input
                ref={clientNameInputRef}
                type="text"
                value={selectedClientName}
                disabled={isReadOnly}
                onChange={(e) => onClientNameChange(e.target.value)}
                onFocus={() => {
                  if (clientNameMatches.length > 0) setShowClientNameMatches(true);
                }}
                onBlur={() => window.setTimeout(() => setShowClientNameMatches(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (clientNameMatches.length > 0) onApplySelectedClient(clientNameMatches[0]);
                    clientNuitInputRef.current?.focus();
                    clientNuitInputRef.current?.select();
                  } else if (e.key === 'Escape') {
                    setShowClientNameMatches(false);
                  }
                }}
                placeholder="Nome do Cliente"
                className="w-full bg-white dark:bg-[#282c2e] dark:text-white font-bold border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 print:p-1 text-xs print:text-[10px] focus-ring disabled:opacity-60"
              />
              {showClientNameMatches && clientNameMatches.length > 0 && !isReadOnly && (
                <div className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded border border-[#9aa5b5] bg-white shadow-lg dark:border-[#59606a] dark:bg-[#282c2e] print:hidden">
                  <div className="border-b border-slate-200 px-2 py-1 text-[10px] font-bold uppercase text-slate-500 dark:border-slate-600 dark:text-slate-300">
                    Clientes encontrados — Enter seleciona o primeiro
                  </div>
                  {clientNameMatches.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => onApplySelectedClient(client)}
                      className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-2 py-2 text-left text-xs hover:bg-blue-50 last:border-b-0 dark:border-slate-700 dark:hover:bg-slate-700"
                    >
                      <span className="font-bold text-[#003366] dark:text-[#a7c8ff]">{client.name}</span>
                      <span className="shrink-0 font-mono text-[10px] text-slate-600 dark:text-slate-300">
                        Cód. {client.number || client.code || '—'}{client.nuit ? ` · NUIT ${client.nuit}` : ''}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <label className="mt-1 flex items-center gap-1.5 text-[10px] text-[#43474f] dark:text-[#c3c6d1] print:hidden">
                <input
                  type="checkbox"
                  checked={keepAsWalkIn}
                  disabled={isReadOnly}
                  onChange={(e) => onKeepAsWalkInChange(e.target.checked)}
                />
                Manter como Cliente Pontual (não criar ficha; guardar os dados apenas neste documento)
              </label>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-2 print:space-y-1">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px] print:text-[9px]">NUIT</label>
                <input
                  ref={clientNuitInputRef}
                  type="text"
                  value={clientNuit}
                  disabled={isReadOnly}
                  onChange={(e) => onClientNuitChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      clientAddressInputRef.current?.focus();
                      clientAddressInputRef.current?.select();
                    }
                  }}
                  placeholder="NUIT (opcional)"
                  className="w-full bg-white dark:bg-[#282c2e] dark:text-white font-mono border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 print:p-1 text-xs print:text-[10px] focus-ring disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px] print:text-[9px]">Morada</label>
                <input
                  ref={clientAddressInputRef}
                  type="text"
                  value={clientAddress}
                  disabled={isReadOnly}
                  onChange={(e) => onClientAddressChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (documentType === 'CUSTOMER_DELIVERY_NOTE') deliveryLocationRef.current?.focus();
                      else paymentSelectionRef.current?.focus();
                    }
                  }}
                  placeholder="Morada (opcional)"
                  className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 print:p-1 text-xs print:text-[10px] focus-ring disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              {documentType === 'CUSTOMER_INVOICE' && (
                <div>
                  <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px] print:text-[9px]">Condição de Pagamento</label>
                  <select
                    ref={paymentSelectionRef}
                    value={paymentSelection}
                    disabled={isReadOnly}
                    onChange={(e) => onPaymentSelectionChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        document.getElementById('sale-article-search')?.focus();
                      }
                    }}
                    className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 print:p-1 text-xs print:text-[10px] font-bold text-[#003366] disabled:opacity-60"
                  >
                    {paymentTerms.map((term) => (
                      <option key={term.id} value={`TERM:${term.code}`}>
                        {term.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {documentType === 'CASH_SALE' && (
                <div>
                  <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px] print:text-[9px]">Método de Pagamento</label>
                  <select
                    ref={paymentSelectionRef}
                    value={paymentSelection}
                    disabled={isReadOnly}
                    onChange={(e) => onPaymentSelectionChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        document.getElementById('sale-article-search')?.focus();
                      }
                    }}
                    className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 print:p-1 text-xs print:text-[10px] font-bold text-[#006e25] disabled:opacity-60"
                  >
                    {paymentMethods.map((method) => (
                      <option key={method.id} value={`METHOD:${method.code}`}>
                        {method.name}
                      </option>
                    ))}
                  </select>
                  {selectedPaymentMethod?.requiresReference && (
                    <input
                      type="text"
                      value={paymentReference}
                      disabled={isReadOnly}
                      onChange={(event) => onPaymentReferenceChange(event.target.value)}
                      placeholder={`Referência ${selectedPaymentMethod.name}`}
                      className="mt-1.5 w-full rounded border border-[#c3c6d1] bg-white p-1.5 text-xs font-mono dark:border-[#43474f] dark:bg-[#282c2e] dark:text-white"
                    />
                  )}
                </div>
              )}

              {documentType === 'CUSTOMER_DELIVERY_NOTE' && (
                <div>
                  <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px] print:text-[9px]">Local de Entrega / Expedição</label>
                  <input
                    ref={deliveryLocationRef}
                    type="text"
                    value={deliveryLocation}
                    disabled={isReadOnly}
                    onChange={(e) => onDeliveryLocationChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        document.getElementById('sale-article-search')?.focus();
                      }
                    }}
                    placeholder="Ex: Armazém Central ou Destino do Cliente"
                    className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 print:p-1 text-xs print:text-[10px] focus-ring font-mono disabled:opacity-60"
                  />
                </div>
              )}
            </div>
          </div>

          {selectedClientId && documentType !== 'CUSTOMER_DELIVERY_NOTE' && (
            <SaleBalanceSummary
              clientName={selectedClientName}
              previousBalance={previousBalance}
              documentAmount={totalFinalAmount}
              accumulatedBalance={newAccumulatedBalance}
            />
          )}
        </div>
      </section>

      {showClientInvoices && selectedClientId && (
        <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded-lg overflow-hidden shadow-sm p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-xs uppercase text-red-600">
              Documentos Pendentes em Aberto - {selectedClientName}
            </h3>
            <button
              type="button"
              onClick={onCloseClientInvoices}
              className="text-[#737780] hover:text-[#191c1d] dark:hover:text-white font-bold text-xs cursor-pointer"
            >
              ✕ Fechar
            </button>
          </div>
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#e7e8e9] dark:bg-[#282c2e] text-[#43474f] dark:text-[#c3c6d1] font-bold uppercase border-b border-[#c3c6d1]">
              <tr>
                <th className="p-2">Documento</th>
                <th className="p-2">Data</th>
                <th className="p-2">Tipo</th>
                <th className="p-2 text-right">Total</th>
                <th className="p-2 text-right">Pendente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f] font-mono">
              {documents
                .filter((d) => d.partyId === selectedClientId && d.outstandingAmount > 0)
                .map((d) => (
                  <tr key={d.id} className="hover:bg-[#f3f4f5] dark:hover:bg-[#282c2e]">
                    <td className="p-2">{d.displayNumber}</td>
                    <td className="p-2">{d.date}</td>
                    <td className="p-2 font-sans">{d.typeName}</td>
                    <td className="p-2 text-right">{formatMZN(d.grandTotal)}</td>
                    <td className="p-2 text-right font-bold text-red-600">{formatMZN(d.outstandingAmount)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
};
