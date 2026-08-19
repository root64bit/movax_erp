import React from 'react';
import { formatMZN } from '@/shared/utils/formatters';

interface SaleBalanceSummaryProps {
  clientName: string;
  previousBalance: number;
  documentAmount: number;
  accumulatedBalance: number;
}

export const SaleBalanceSummary: React.FC<SaleBalanceSummaryProps> = ({
  clientName,previousBalance,documentAmount,accumulatedBalance,
}) => (
  <div className="col-span-1 md:col-span-2 bg-[#003366]/10 p-2 print:p-1 rounded border border-[#003366]/20 flex items-center justify-between text-xs print:text-[10px] font-mono">
    <div>
      <span className="font-bold text-[#001e40] dark:text-white">Cliente Activo: {clientName}</span>
      {previousBalance>0&&(
        <span className="ml-3 text-red-600 font-bold">Saldo Pendente Anterior: {formatMZN(previousBalance)}</span>
      )}
    </div>
    <div className="flex items-center space-x-4">
      <span>Valor Documento: <b>{formatMZN(documentAmount)}</b></span>
      <span className="text-[#006e25] font-extrabold text-sm">Novo Saldo Acumulado: {formatMZN(accumulatedBalance)}</span>
    </div>
  </div>
);
