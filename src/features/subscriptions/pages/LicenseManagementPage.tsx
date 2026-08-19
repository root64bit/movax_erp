import React, { useState, useEffect } from 'react';
import {
  SubscriptionService,
  AVAILABLE_ADDONS_CATALOG,
} from '../services/subscription.service';
import { UpgradePlanModal } from '../components/UpgradePlanModal';
import type { LicenseOverview } from '@/shared/types/domain.types';

export const LicenseManagementPage: React.FC = () => {
  const [overview, setOverview] = useState<LicenseOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [targetAddon, setTargetAddon] = useState<string | undefined>();
  const [togglingAddon, setTogglingAddon] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await SubscriptionService.fetchLicenseOverview();
      setOverview(data);
    } catch (err) {
      console.error('Failed to load license overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleToggleAddon = async (addonCode: string, currentActive: boolean) => {
    setTogglingAddon(addonCode);
    try {
      await SubscriptionService.toggleAddon(addonCode, !currentActive);
      setActionNotice(`Módulo ${addonCode} ${!currentActive ? 'ativado' : 'desativado'} com sucesso.`);
      await loadData();
      setTimeout(() => setActionNotice(''), 3000);
    } catch (err: any) {
      alert(err.message || 'Falha ao atualizar módulo.');
    } finally {
      setTogglingAddon(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
        <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
        <span>A carregar detalhes da subscrição e licença SaaS…</span>
      </div>
    );
  }

  const sub = overview?.subscription;
  const plan = overview?.plan;
  const usage = overview?.usage;
  const addons = overview?.addons || [];
  const invoices = overview?.invoices || [];

  const daysRemaining = sub?.currentPeriodEnd
    ? Math.max(
        0,
        Math.ceil(
          (new Date(sub.currentPeriodEnd).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        )
      )
    : 30;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner Notice */}
      {actionNotice && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-base">check_circle</span>
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Plan Header Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-surface dark:bg-slate-900 rounded-3xl border border-outline-variant dark:border-slate-800 p-6 sm:p-8 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Plano Ativo</span>
            <div className="flex items-baseline justify-between mt-1 mb-4">
              <h2 className="text-3xl font-black text-primary dark:text-primary-fixed-dim">{plan?.name || 'BUSINESS'}</h2>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
                {sub?.status || 'ACTIVE'}
              </span>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Valor da Assinatura</span>
                <span className="font-black text-slate-900 dark:text-slate-100">
                  {plan?.priceMonthly ? `${plan.priceMonthly.toLocaleString('pt-MZ')} MT/mês` : 'Personalizado'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Ciclo de Faturação</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">Mensal</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Dias Restantes</span>
                <span className={`font-black ${daysRemaining <= 5 ? 'text-red-600' : 'text-slate-900 dark:text-slate-100'}`}>
                  {daysRemaining} dias
                </span>
              </div>
            </div>
          </div>

          <div className="pt-6">
            <button
              type="button"
              onClick={() => {
                setTargetAddon(undefined);
                setIsUpgradeModalOpen(true);
              }}
              className="w-full py-3 bg-primary hover:bg-primary-container text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">upgrade</span>
              <span>Alterar / Fazer Upgrade de Plano</span>
            </button>
          </div>
        </div>

        {/* Operational Limits and Consumption Card */}
        <div className="lg:col-span-2 bg-surface dark:bg-slate-900 rounded-3xl border border-outline-variant dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
              Consumo de Recursos & Limites Operacionais
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Acompanhamento em tempo real dos limites contratados na licença da sua empresa.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Utilizadores */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-primary">person</span>
                  Utilizadores Ativos
                </span>
                <span className="text-slate-900 dark:text-slate-100 font-black">
                  {usage?.usersCount || 1} / {plan?.maxUsers ? plan.maxUsers : '∞'}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{
                    width: plan?.maxUsers ? `${Math.min(100, ((usage?.usersCount || 1) / plan.maxUsers) * 100)}%` : '20%',
                  }}
                ></div>
              </div>
            </div>

            {/* Lojas / Sucursais */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-blue-600">store</span>
                  Lojas / Sucursais
                </span>
                <span className="text-slate-900 dark:text-slate-100 font-black">
                  {usage?.branchesCount || 1} / {plan?.maxBranches ? plan.maxBranches : '∞'}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all"
                  style={{
                    width: plan?.maxBranches ? `${Math.min(100, ((usage?.branchesCount || 1) / plan.maxBranches) * 100)}%` : '30%',
                  }}
                ></div>
              </div>
            </div>

            {/* Armazéns */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-purple-600">warehouse</span>
                  Armazéns Operacionais
                </span>
                <span className="text-slate-900 dark:text-slate-100 font-black">
                  {usage?.warehousesCount || 1} / {plan?.maxWarehouses ? plan.maxWarehouses : '∞'}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full bg-purple-600 rounded-full transition-all"
                  style={{
                    width: plan?.maxWarehouses ? `${Math.min(100, ((usage?.warehousesCount || 1) / plan.maxWarehouses) * 100)}%` : '40%',
                  }}
                ></div>
              </div>
            </div>

            {/* Caixas / Terminais POS */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-emerald-600">point_of_sale</span>
                  Terminais / Caixas POS
                </span>
                <span className="text-slate-900 dark:text-slate-100 font-black">
                  {usage?.posTerminalsCount || 1} / {plan?.maxPosTerminals ? plan.maxPosTerminals : '∞'}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full bg-emerald-600 rounded-full transition-all"
                  style={{
                    width: plan?.maxPosTerminals ? `${Math.min(100, ((usage?.posTerminalsCount || 1) / plan.maxPosTerminals) * 100)}%` : '30%',
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modular Add-ons Management */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-outline-variant dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
        <div>
          <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
            Módulos e Add-ons Específicos
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Ative funcionalidades avançadas para expandir a capacidade do seu ERP sem mudar de plano.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {AVAILABLE_ADDONS_CATALOG.map((catAddon) => {
            const activeRecord = addons.find((a) => a.addonCode === catAddon.code);
            const isAddonActive = activeRecord?.isActive ?? false;
            const isToggling = togglingAddon === catAddon.code;

            return (
              <div
                key={catAddon.code}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                  isAddonActive
                    ? 'border-primary/40 bg-primary/5 dark:bg-primary/10'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded">
                      {catAddon.category}
                    </span>
                    <span
                      className={`text-[11px] font-bold ${
                        isAddonActive ? 'text-green-600 dark:text-green-400' : 'text-slate-400'
                      }`}
                    >
                      {isAddonActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-2">{catAddon.name}</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{catAddon.description}</p>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-200/60 dark:border-slate-700/60 flex justify-between items-center">
                  <span className="text-xs font-black text-primary">
                    {catAddon.priceMonthly.toLocaleString('pt-MZ')} MT/mês
                  </span>
                  <button
                    type="button"
                    disabled={isToggling}
                    onClick={() => handleToggleAddon(catAddon.code, isAddonActive)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      isAddonActive
                        ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300'
                        : 'bg-primary text-white hover:bg-primary-container'
                    }`}
                  >
                    {isToggling ? 'A guardar…' : isAddonActive ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upgrade Plan Modal */}
      <UpgradePlanModal
        isOpen={isUpgradeModalOpen}
        onClose={() => {
          setIsUpgradeModalOpen(false);
          setTargetAddon(undefined);
        }}
        currentPlanCode={plan?.code || 'BUSINESS'}
        onPlanUpgraded={loadData}
        targetAddon={targetAddon}
      />
    </div>
  );
};
