import React from 'react';
import { formatMZN } from '../../stitch/stitchConfig';

interface SaleTotalsSectionProps {
  children?:React.ReactNode;
  generalDiscount:number;
  onGeneralDiscountChange:(value:number)=>void;
  notes:string;
  onNotesChange:(value:string)=>void;
  disabled:boolean;
  appliedGeneralDiscount:number;
  grossTotal:number;
  lineDiscountTotal:number;
  netTotal:number;
  taxTotal:number;
  grandTotal:number;
}

export const SaleTotalsSection:React.FC<SaleTotalsSectionProps>=({
  children,
  generalDiscount,onGeneralDiscountChange,notes,onNotesChange,disabled,appliedGeneralDiscount,
  grossTotal,lineDiscountTotal,netTotal,taxTotal,grandTotal,
})=>(
  <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-3 print:p-2 rounded-lg shadow-sm print:shadow-none space-y-3 print:space-y-1">
    <div className="grid grid-cols-12 gap-3 print:gap-2">
      <div className="col-span-12 md:col-span-6 space-y-2 print:space-y-1 bg-[#f3f4f5] dark:bg-[#282c2e] p-2.5 print:p-1.5 rounded-lg border border-[#c3c6d1] dark:border-[#43474f]">
        <div className="flex items-center space-x-3 text-xs print:text-[10px]">
          <label className="font-bold uppercase text-[#191c1d] dark:text-white">Desconto Geral (MZN):</label>
          <input type="number" min="0" value={generalDiscount} disabled={disabled}
            onChange={(event)=>onGeneralDiscountChange(Number(event.target.value))}
            className="w-24 bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded p-0.5 text-center font-bold text-[#191c1d] dark:text-white disabled:opacity-60" />
          <span className="font-bold text-[#191c1d] dark:text-white">Aplicado: {formatMZN(appliedGeneralDiscount)}</span>
        </div>
        <div>
          <label className="block font-bold uppercase text-[#191c1d] dark:text-white mb-0.5 text-xs print:text-[10px]">Observações / Garantias:</label>
          <textarea value={notes} disabled={disabled} onChange={(event)=>onNotesChange(event.target.value)}
            placeholder="Observações da fatura, garantia ou condições comerciais..."
            className="w-full h-12 print:h-8 bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 print:p-1 text-xs print:text-[10px] text-[#191c1d] dark:text-white focus:outline-none disabled:opacity-60" />
        </div>
      </div>
      <div className="col-span-12 md:col-span-6 grid grid-cols-2 gap-2 print:gap-1.5">
        <div className="border border-[#c3c6d1] dark:border-[#43474f] p-2 print:p-1.5 bg-[#f3f4f5] dark:bg-[#282c2e] text-[11px] print:text-[10px] font-mono space-y-1 rounded-lg">
          <div className="border-b border-[#c3c6d1] dark:border-[#43474f] font-bold flex justify-between text-[#191c1d] dark:text-white uppercase text-[10px] print:text-[9px] pb-0.5"><span>CD</span><span>BASE IVA</span><span>TOTAL IVA</span></div>
          <div className="flex justify-between font-bold text-[#191c1d] dark:text-white"><span>1 (16%)</span><span>{netTotal.toFixed(2)}</span><span>{taxTotal.toFixed(2)}</span></div>
          <div className="flex justify-between text-[#737780]"><span>0 (0%)</span><span>0.00</span><span>0.00</span></div>
        </div>
        <div className="border border-[#c3c6d1] dark:border-[#43474f] p-2.5 print:p-1.5 bg-[#f3f4f5] dark:bg-[#282c2e] text-xs print:text-[10px] font-mono space-y-1 flex flex-col justify-between rounded-lg">
          <div className="flex justify-between text-[#191c1d] dark:text-white"><span className="font-bold">ILIQUIDO:</span><span>{formatMZN(grossTotal)}</span></div>
          <div className="flex justify-between text-red-600"><span>DESCONTOS:</span><span>-{formatMZN(lineDiscountTotal+appliedGeneralDiscount)}</span></div>
          <div className="flex justify-between text-[#191c1d] dark:text-white"><span>IVA:</span><span>{formatMZN(taxTotal)}</span></div>
          <div className="pt-1 border-t border-[#c3c6d1] dark:border-[#43474f] flex justify-between items-center font-black text-[#191c1d] dark:text-white"><span>TOTAL:</span><span className="text-xl print:text-sm text-[#006e25] font-extrabold">{formatMZN(grandTotal)}</span></div>
        </div>
      </div>
    </div>
    {children}
  </section>
);
