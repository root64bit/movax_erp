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
  const [bankReference, setBankReference] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');

  if (!isOpen) return null;

  const plan = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.code === selectedPlan) || DEFAULT_SUBSCRIPTION_PLANS[1];
  const price = cycle === 'ANNUAL' ? Math.round(plan.priceAnnual / 12) : plan.priceMonthly;
  const totalDue = cycle === 'ANNUAL' ? plan.priceAnnual : plan.priceMonthly;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        setError('O ficheiro selecionado é demasiado grande (máximo 10MB).');
        return;
      }
      setReceiptFile(file);
      setError('');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.size > 10 * 1024 * 1024) {
        setError('O ficheiro selecionado é demasiado grande (máximo 10MB).');
        return;
      }
      setReceiptFile(file);
      setError('');
    }
  };

  const handleConfirm = async () => {
    if (paymentMethod === 'M_PESA') {
      const cleanPhone = mpesaNumber.replace(/\D/g, '');
      if (cleanPhone.length < 9) {
        setError('Introduza um número M-Pesa válido (84/85 xxx xxxx).');
        return;
      }
    }

    setProcessing(true);
    setError('');
    try {
      const ref =
        paymentMethod === 'M_PESA'
          ? `MPESA-${mpesaNumber.trim()}`
          : bankReference.trim()
          ? `TRF-BANCO-${bankReference.trim()}`
          : receiptFile
          ? `RECIBO-${receiptFile.name}`
          : 'REF-BANCO';

      await SubscriptionService.upgradePlan(
        selectedPlan,
        cycle,
        paymentMethod,
        ref,
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
      <div className="w-full max-w-lg bg-surface dark:bg-slate-900 border border-outline-variant dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
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
              <span>M-Pesa</span>
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

          {paymentMethod === 'M_PESA' ? (
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
          ) : (
            <div className="space-y-3 pt-1">
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] space-y-1">
                <p className="font-bold text-slate-800 dark:text-slate-200">Coordenadas para Pagamento:</p>
                <p className="text-slate-600 dark:text-slate-400">
                  • <strong>Millennium BIM</strong>: Conta 123456789 | NIB: 0001 0000 1234 5678 9012 3
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  • <strong>BCI</strong>: Conta 987654321 | NIB: 0008 0000 9876 5432 1098 7
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  • <strong>Standard Bank</strong>: Conta 555666777 | NIB: 0003 0000 5556 6677 7012 3
                </p>
                <p className="text-[10px] text-slate-500 italic mt-1">
                  Indique o NUIT da sua empresa como descritivo da transferência.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Nº de Referência / Talão de Depósito (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: TRF-982341 ou Nº do Talão"
                  value={bankReference}
                  onChange={(e) => setBankReference(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Comprovativo de Pagamento Bancário
                </label>
                {receiptFile ? (
                  <div className="flex items-center justify-between p-3 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <span className="material-symbols-outlined text-emerald-600 text-lg">receipt_long</span>
                      <div className="truncate">
                        <p className="font-bold truncate">{receiptFile.name}</p>
                        <p className="text-[10px] text-emerald-700/80 dark:text-emerald-400">
                          {(receiptFile.size / 1024).toFixed(1)} KB • Comprovativo anexado
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReceiptFile(null)}
                      className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                      title="Remover comprovativo"
                    >
                      <span className="material-symbols-outlined text-base">close</span>
                    </button>
                  </div>
                ) : (
                  <label
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`flex flex-col items-center justify-center p-3.5 border-2 border-dashed rounded-2xl cursor-pointer transition-all text-center group ${
                      isDragging
                        ? 'border-primary bg-primary/10'
                        : 'border-slate-300 dark:border-slate-700 hover:border-primary bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100/70'
                    }`}
                  >
                    <span className="material-symbols-outlined text-2xl text-slate-400 group-hover:text-primary transition-colors mb-0.5">
                      upload_file
                    </span>
                    <span className="font-bold text-slate-700 dark:text-slate-200 text-xs group-hover:text-primary transition-colors">
                      Carregar Comprovativo de Pagamento / Recibo do Banco
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">
                      PDF, PNG, JPG ou JPEG (máx. 10MB)
                    </span>
                    <input
                      type="file"
                      accept=".pdf,image/png,image/jpeg,image/jpg"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
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
            {processing
              ? 'A processar…'
              : paymentMethod === 'BANK_TRANSFER'
              ? `Submeter Comprovativo (${totalDue.toLocaleString('pt-MZ')} MT)`
              : `Confirmar Atualização (${totalDue.toLocaleString('pt-MZ')} MT)`}
          </button>
        </div>
      </div>
    </div>
  );
};
