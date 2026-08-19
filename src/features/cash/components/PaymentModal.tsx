import React, { useEffect, useState } from 'react';
import { formatMZN } from '@/shared/utils/formatters';
import { MpesaService, normalizeMsisdn, validateMsisdn, generateMpesaRef } from '@/integrations/mpesa';
import type { ReferenceOption, DocumentRecord } from '@/shared/types/domain.types';

export interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  document?: DocumentRecord | null;
  totalAmount?: number;
  clientName?: string;
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
  document,
  totalAmount,
  clientName,
  partyType = 'CUSTOMER',
  documentNumber,
  onConfirmPayment,
  paymentMethods,
}) => {
  const effectiveAmount = totalAmount ?? (document?.outstandingAmount || document?.grandTotal || 0);
  const effectiveClientName = clientName || document?.partyName || 'Cliente';
  const effectiveDocNumber = documentNumber || document?.displayNumber || '';

  const [method, setMethod] = useState(paymentMethods[0]?.code || 'CASH');
  const [paidInput, setPaidInput] = useState<number>(effectiveAmount);
  const [reference, setReference] = useState('');
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [mpesaTriggering, setMpesaTriggering] = useState(false);
  const [mpesaPushSuccess, setMpesaPushSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPaidInput(effectiveAmount);
      setMethod(paymentMethods[0]?.code || 'CASH');
      setReference('');
      setMpesaPhone('');
      setMpesaPushSuccess(null);
      setError('');
    }
  }, [isOpen, effectiveAmount, paymentMethods]);

  const handleTriggerMpesaPush = async () => {
    const normalized = normalizeMsisdn(mpesaPhone);
    if (!validateMsisdn(normalized)) {
      setError('Número M-Pesa inválido. Insira um número de Moçambique (ex: 84 123 4567).');
      return;
    }
    if (paidInput <= 0) {
      setError('O valor a liquidar deve ser superior a zero.');
      return;
    }

    setMpesaTriggering(true);
    setError('');
    try {
      const res = await MpesaService.initiateC2BPayment({
        amount: paidInput,
        msisdn: normalized,
        reference: generateMpesaRef('POS'),
        thirdPartyRef: generateMpesaRef('MS'),
      });

      if (res.success) {
        const txId = res.transactionId || 'M-PESA-OK';
        setReference(txId);
        setMpesaPushSuccess(`Pedido USSD confirmado no telemóvel! Comprovativo: ${txId}`);
      }
    } catch (err: any) {
      setError(err.message || 'Falha ao processar pedido M-Pesa.');
    } finally {
      setMpesaTriggering(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paidInput <= 0) {
      setError('O valor liquidado deve ser superior a zero.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onConfirmPayment(method, paidInput, reference.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || 'Falha ao registar liquidação.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface dark:bg-slate-900 border border-outline-variant dark:border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-outline-variant dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100">Registo de Liquidação</h3>
            <p className="text-xs text-slate-500 mt-0.5">{effectiveClientName} • {effectiveDocNumber}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 font-bold rounded-xl">{error}</div>}

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Método de Pagamento</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full rounded-xl border border-outline-variant bg-background px-3.5 py-2.5 font-bold focus:border-primary focus:outline-none"
            >
              {paymentMethods.length > 0 ? (
                paymentMethods.map((pm) => (
                  <option key={pm.code} value={pm.code}>{pm.name}</option>
                ))
              ) : (
                <>
                  <option value="CASH">Dinheiro (Numerário)</option>
                  <option value="MPESA">M-Pesa</option>
                  <option value="POS">POS / Cartão</option>
                  <option value="BANK_TRANSFER">Transferência Bancária</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Valor a Liquidar (MZN) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={effectiveAmount}
              required
              value={paidInput}
              onChange={(e) => setPaidInput(Number(e.target.value))}
              className="w-full rounded-xl border border-primary bg-background px-3.5 py-2.5 font-black text-sm text-primary focus:border-primary focus:outline-none"
            />
            <p className="text-[11px] text-slate-500 mt-1">Saldo pendente: {formatMZN(effectiveAmount)}</p>
          </div>

          {method === 'MPESA' && (
            <div className="p-3.5 bg-red-50/70 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-2xl space-y-2.5 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-red-700 dark:text-red-300 uppercase flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                  M-Pesa Express (Push USSD)
                </span>
                <span className="text-[10px] text-slate-500">Vodacom Moçambique</span>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    +258
                  </span>
                  <input
                    type="tel"
                    placeholder="84 123 4567"
                    value={mpesaPhone}
                    onChange={(e) => setMpesaPhone(e.target.value)}
                    className="w-full rounded-xl border border-red-300 dark:border-red-800 bg-background pl-12 pr-3 py-2 text-xs font-bold font-mono focus:border-red-600 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleTriggerMpesaPush}
                  disabled={mpesaTriggering || !mpesaPhone.trim()}
                  className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
                >
                  {mpesaTriggering ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>A enviar...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">phonelink_ring</span>
                      <span>Disparar USSD</span>
                    </>
                  )}
                </button>
              </div>
              {mpesaPushSuccess && (
                <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">verified</span>
                  <span>{mpesaPushSuccess}</span>
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Referência / Nº de Comprovativo</label>
            <input
              type="text"
              placeholder="Ex: MP24011234 ou Talão POS"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full rounded-xl border border-outline-variant bg-background px-3.5 py-2.5 font-medium focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-outline-variant font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-primary hover:bg-primary-container text-white font-black rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-60"
            >
              {saving ? 'A registar…' : `Confirmar Liquidação (${formatMZN(paidInput)})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
