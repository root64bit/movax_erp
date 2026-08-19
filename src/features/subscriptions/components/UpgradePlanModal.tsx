import React, { useState } from 'react';
import { SubscriptionService } from '../services/subscription.service';
import { DEFAULT_SUBSCRIPTION_PLANS } from '@/features/landing/services/onboarding.service';
import type { SubscriptionPlanCode } from '@/shared/types/domain.types';

interface UpgradePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlanCode: string;
  onPlanUpgraded: () => Promise<void>;
  targetAddon?: string;
}

export const UpgradePlanModal: React.FC<UpgradePlanModalProps> = ({
  isOpen,
  onClose,
  currentPlanCode,
  onPlanUpgraded,
  targetAddon,
}) => {
  const [cycle, setCycle] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanCode>(
    (currentPlanCode === 'STARTER' ? 'BUSINESS' : currentPlanCode === 'BUSINESS' ? 'PRO' : 'PRO') as SubscriptionPlanCode
  );
  const [paymentMethod, setPaymentMethod] = useState<'M_PESA' | 'BANK_TRANSFER'>('M_PESA');
  const [mpesaNumber, setMpesaNumber] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');

  if (!isOpen) return null;

  const plan = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.code === selectedPlan) || DEFAULT_SUBSCRIPTION_PLANS[1];
  const price = cycle === 'ANNUAL' ? Math.round(plan.priceAnnual / 12) : plan.priceMonthly;
  const totalDue = cycle === 'ANNUAL' ? plan.priceAnnual : plan.priceMonthly;

  const handleConfirm = async () => {
    if (paymentMethod === 'M_PESA' && (!mpesaNumber.trim() || mpesaNumber.replace(/\D/g, '').length < 9)) {
      setError('Introduza um número M-Pesa válido (84/85 xxx xxxx).');
      return;
    }

    setProcessing(true);
    setError('');
    try {
      await SubscriptionService.upgradePlan(
        selectedPlan,
        cycle,
        paymentMethod,
        paymentMethod === 'M_PESA' ? `MPESA-${mpesaNumber.trim()}` : 'REF-BANK'
      );
      setSuccessNotice('Plano atualizado com sucesso!');
      await onPlanUpgraded();
      setTimeout(() => {
        setSuccessNotice('');
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Falha ao atualizar o plano de subscrição.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-surface dark:bg-slate-900 border border-outline-variant dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-outline-variant dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
              {targetAddon ? `Ativar Módulo ${targetAddon}` : 'Alterar / Upgrade de Plano'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Escolha a configuração pretendida para a subscrição da sua empresa.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Cycle Toggle */}
        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 max-w-xs mx-auto border border-slate-200 dark:border-slate-700 text-xs font-bold">
          <button
            type="button"
            onClick={() => setCycle('MONTHLY')}
            className={`flex-1 py-1.5 rounded-lg transition-all ${
              cycle === 'MONTHLY' ? 'bg-primary text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Mensal
          </button>
          <button
            type="button"
            onClick={() => setCycle('ANNUAL')}
            className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 ${
              cycle === 'ANNUAL' ? 'bg-primary text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <span>Anual</span>
            <span className="text-[10px] bg-green-600 text-white px-1.5 rounded-full font-black">-15%</span>
          </button>
        </div>

        {/* Plan Selection */}
        <div className="grid grid-cols-3 gap-2.5">
          {DEFAULT_SUBSCRIPTION_PLANS.filter((p) => p.code !== 'ENTERPRISE').map((p) => {
            const isSelected = selectedPlan === p.code;
            const pPrice = cycle === 'ANNUAL' ? Math.round(p.priceAnnual / 12) : p.priceMonthly;

            return (
              <div
                key={p.code}
                onClick={() => setSelectedPlan(p.code as SubscriptionPlanCode)}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all text-center flex flex-col justify-between ${
                  isSelected
                    ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary'
                    : 'border-outline-variant dark:border-slate-800 hover:border-slate-400'
                }`}
              >
                <div>
                  <span className="font-black text-xs text-slate-900 dark:text-slate-100 block">{p.name}</span>
                  <span className="text-sm font-black text-primary block mt-1">
                    {pPrice.toLocaleString('pt-MZ')} MT
                  </span>
                  <span className="text-[10px] text-slate-500">/mês</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-outline-variant dark:border-slate-800 flex justify-between items-center text-xs">
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">
              Total do Ciclo ({cycle === 'ANNUAL' ? '12 Meses com 15% Desconto' : '1 Mês'})
            </p>
            <p className="text-slate-500 text-[11px] mt-0.5">Renovação automática</p>
          </div>
          <span className="text-lg font-black text-primary">{totalDue.toLocaleString('pt-MZ')} MT</span>
        </div>

        {/* Payment Method */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Método de Liquidação</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPaymentMethod('M_PESA')}
              className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                paymentMethod === 'M_PESA'
                  ? 'border-red-600 bg-red-50 text-red-700 ring-2 ring-red-500/20'
                  : 'border-outline-variant text-slate-600 dark:text-slate-400'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
              <span>M-Pesa (Vodacom)</span>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('BANK_TRANSFER')}
              className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                paymentMethod === 'BANK_TRANSFER'
                  ? 'border-primary bg-primary/5 text-primary ring-2 ring-primary/20'
                  : 'border-outline-variant text-slate-600 dark:text-slate-400'
              }`}
            >
              <span className="material-symbols-outlined text-sm">account_balance</span>
              <span>Transferência Bancária</span>
            </button>
          </div>

          {paymentMethod === 'M_PESA' && (
            <div className="pt-2 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Número de Telemóvel M-Pesa (84/85 xxx xxxx) *
              </label>
              <input
                type="tel"
                placeholder="Ex: 84 123 4567"
                value={mpesaNumber}
                onChange={(e) => setMpesaNumber(e.target.value)}
                className="w-full rounded-xl border border-outline-variant dark:border-slate-800 bg-background px-3.5 py-2.5 text-xs font-medium focus:border-primary focus:outline-none"
              />
            </div>
          )}
        </div>

        {error && <p className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold">{error}</p>}
        {successNotice && <p className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-xl text-xs font-bold">{successNotice}</p>}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="px-4 py-2.5 rounded-xl border border-outline-variant text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={processing}
            onClick={handleConfirm}
            className="px-6 py-2.5 bg-primary hover:bg-primary-container text-white font-black text-xs rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-60"
          >
            {processing ? 'A processar…' : `Confirmar Atualização (${totalDue.toLocaleString('pt-MZ')} MT)`}
          </button>
        </div>
      </div>
    </div>
  );
};
