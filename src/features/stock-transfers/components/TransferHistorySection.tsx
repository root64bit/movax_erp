import React from 'react';
import type { StockTransfer } from '@/shared/types/domain.types';
import { TransferStatusBadge } from './TransferStatusBadge';
import { canDispatchTransfer, canReceiveTransfer, canCancelTransfer } from '../utils/stockTransferState';

export interface TransferHistorySectionProps {
  transfers: StockTransfer[];
  transferLoading: boolean;
  onDispatchTransfer: (transfer: StockTransfer) => void;
  onReceiveTransfer: (transfer: StockTransfer) => void;
  onVoidTransfer: (transfer: StockTransfer) => void;
}

export const TransferHistorySection: React.FC<TransferHistorySectionProps> = ({
  transfers,
  transferLoading,
  onDispatchTransfer,
  onReceiveTransfer,
  onVoidTransfer,
}) => {
  return (
    <section className="rounded-lg border border-[#c3c6d1] bg-white shadow-sm dark:border-[#43474f] dark:bg-[#1f2325] overflow-hidden print:hidden">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#282c2e] flex justify-between items-center">
        <div>
          <h3 className="text-xs font-black uppercase text-slate-700 dark:text-slate-200">
            Histórico de Guias de Transferência
          </h3>
          <p className="text-[11px] text-slate-500">
            Acompanhe o estado de envio e recepção de mercadoria entre lojas e armazéns.
          </p>
        </div>
        <span className="text-xs font-bold text-slate-500">
          Total de Guias: <b>{transfers.length}</b>
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-100 dark:bg-[#1f2325] text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700 uppercase text-[10px]">
            <tr>
              <th className="p-3">Nº da Guia</th>
              <th className="p-3">Data</th>
              <th className="p-3">Origem</th>
              <th className="p-3">Destino</th>
              <th className="p-3">Artigos</th>
              <th className="p-3">Estado</th>
              <th className="p-3 text-right">Acções Operacionais</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {transfers.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-400 italic">
                  {transferLoading ? 'A carregar transferências...' : 'Nenhuma transferência registada.'}
                </td>
              </tr>
            ) : (
              transfers.map((transfer) => {
                const canDispatch = canDispatchTransfer(transfer.status);
                const canReceive = canReceiveTransfer(transfer.status);
                const canCancel = canCancelTransfer(transfer.status);

                return (
                  <tr key={transfer.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-bold text-primary dark:text-blue-300">
                      {transfer.transferNumber}
                    </td>
                    <td className="p-3 text-slate-500">
                      {new Date(transfer.transferDate).toLocaleDateString('pt-PT')}
                    </td>
                    <td className="p-3 font-bold">{transfer.fromWarehouseName}</td>
                    <td className="p-3 font-bold">{transfer.toWarehouseName}</td>
                    <td className="p-3">
                      <div className="space-y-0.5 max-w-xs">
                        {transfer.lines.map((line) => (
                          <div key={line.id} className="truncate text-[11px]">
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{line.articleCode}</span> ({line.quantity})
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="p-3">
                      <TransferStatusBadge status={transfer.status} />
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {canDispatch && (
                          <button
                            type="button"
                            disabled={transferLoading}
                            onClick={() => onDispatchTransfer(transfer)}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-[11px] cursor-pointer"
                          >
                            Enviar
                          </button>
                        )}
                        {canReceive && (
                          <button
                            type="button"
                            disabled={transferLoading}
                            onClick={() => onReceiveTransfer(transfer)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[11px] cursor-pointer"
                          >
                            Confirmar Recepção
                          </button>
                        )}
                        {canCancel && (
                          <button
                            type="button"
                            disabled={transferLoading}
                            onClick={() => onVoidTransfer(transfer)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded text-[11px] cursor-pointer"
                          >
                            Anular
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
