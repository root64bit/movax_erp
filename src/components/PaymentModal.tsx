import React, { useEffect, useState } from 'react';
import { formatMZN } from '../stitch/stitchConfig';
import type { ReferenceOption } from '../types';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalAmount: number;
  clientName: string;
  partyType?: 'CUSTOMER' | 'SUPPLIER';
  documentNumber?: string;
  onConfirmPayment: (
    paymentMethodCode: string,
    paidAmount: number,
    reference: string,
  ) => Promise<void>;
  paymentMethods: ReferenceOption[];
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  totalAmount,
  clientName,
  partyType = 'CUSTOMER',
  documentNumber,
  onConfirmPayment,
  paymentMethods,
}) => {
  const [method, setMethod] = useState('');
  const [paidInput, setPaidInput] = useState<number>(totalAmount);
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPaidInput(totalAmount);
      setReference('');
      setError('');
      setMethod(paymentMethods[0]?.code ?? '');
    }
  }, [isOpen, totalAmount, paymentMethods[0]?.code]);

  if (!isOpen) return null;

  const changeDue = Math.max(0, paidInput - totalAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedMethod = paymentMethods.find((item) => item.code === method);
    if (!selectedMethod) return;
    if (!Number.isFinite(paidInput) || paidInput <= 0 || paidInput > totalAmount) {
      setError(`O valor deve ser superior a zero e não pode exceder ${formatMZN(totalAmount)}.`);
      return;
    }
    if (selectedMethod.requiresReference && !reference.trim()) {
      setError('Introduza a referência da transferência ou pagamento móvel.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onConfirmPayment(method, paidInput, reference);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Falha ao confirmar pagamento.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1f2325] rounded-lg shadow-2xl w-full max-w-lg overflow-hidden border border-[#c3c6d1] dark:border-[#43474f]">
        <div className="bg-[#001e40] text-white px-6 py-4 flex justify-between items-center">
          <h3 className="font-bold text-lg flex items-center">
            <span className="material-symbols-outlined mr-2">payments</span>
            {partyType === 'CUSTOMER' ? 'Registar Recebimento' : 'Registar Pagamento'}
          </h3>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="bg-[#f3f4f5] dark:bg-[#282c2e] p-4 rounded border border-[#c3c6d1] dark:border-[#43474f] text-center">
            <span className="text-xs uppercase text-[#43474f] dark:text-[#c3c6d1] font-bold tracking-wider block mb-1">
              {partyType === 'CUSTOMER' ? 'Cliente' : 'Fornecedor'}: {clientName || 'Entidade não identificada'}
            </span>
            {documentNumber && <span className="mb-1 block text-xs font-bold text-[#737780]">Documento: {documentNumber}</span>}
            <div className="text-3xl font-extrabold text-[#001e40] dark:text-[#a7c8ff] font-mono">
              {formatMZN(totalAmount)}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#43474f] dark:text-[#c3c6d1] uppercase mb-2">
              Método de Pagamento
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {paymentMethods.map((item) => <button key={item.id} type="button" onClick={() => setMethod(item.code)} className={`p-3 rounded text-xs font-bold border text-center ${method === item.code ? 'border-[#003366] bg-[#003366] text-white' : 'border-[#c3c6d1] dark:border-[#43474f]'}`}>{item.name}</button>)}
            </div>
          </div>

          {paymentMethods.find((item) => item.code === method)?.requiresReference && (
            <div>
              <label className="block text-xs font-bold text-[#43474f] dark:text-[#c3c6d1] uppercase mb-1">
                Referência da Transação
              </label>
              <input
                type="text"
                required
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                className="w-full border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#282c2e] dark:text-white rounded p-3 font-mono focus-ring"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#43474f] dark:text-[#c3c6d1] uppercase mb-1">
              {partyType === 'CUSTOMER' ? 'Valor Recebido (MZN)' : 'Valor Pago (MZN)'}
            </label>
            <input
              type="number"
              step="0.01"
              value={paidInput}
              onChange={(e) => setPaidInput(Number(e.target.value))}
              className="w-full border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#282c2e] dark:text-white rounded p-3 text-lg font-mono text-right font-bold focus-ring"
            />
          </div>

          {partyType === 'CUSTOMER' && !paymentMethods.find((item) => item.code === method)?.requiresReference && changeDue > 0 && (
            <div className="flex justify-between items-center bg-[#80f98b]/20 text-[#007327] p-3 rounded border border-[#006e25]/30">
              <span className="text-xs font-bold uppercase">Troco a Devolver:</span>
              <strong className="text-xl font-mono">{formatMZN(changeDue)}</strong>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded bg-red-50 p-3 text-sm font-bold text-red-700">
              {error}
            </p>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-[#c3c6d1] dark:border-[#43474f]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#ba1a1a] text-white rounded font-bold text-xs uppercase hover:brightness-90 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || paidInput <= 0}
              className="px-6 py-2.5 bg-[#006e25] text-white rounded font-bold text-xs uppercase hover:brightness-110 transition-all shadow-md flex items-center disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="material-symbols-outlined mr-2">check_circle</span>
              {saving ? 'A confirmar…' : partyType === 'CUSTOMER' ? 'Confirmar e Emitir Recibo' : 'Confirmar Pagamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
