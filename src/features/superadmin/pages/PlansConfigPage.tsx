import React, { useState, useEffect } from 'react';
import { SuperAdminService } from '../services/superadmin.service';
import { PageLoader } from '@/shared/components/feedback';
import { formatMZN } from '@/shared/utils/formatters';

const PlansConfigPage: React.FC = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await SuperAdminService.fetchPlans();
        setPlans(data);
      } catch (err) {
        console.error('Error fetching plans', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return <PageLoader message="A carregar configurações de planos..." />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">Planos</h1>
          <p className="text-sm text-slate-500 mt-1">Configure os planos comerciais disponíveis no Movax ERP.</p>
        </div>
        <button className="px-4 py-2 bg-primary hover:bg-primary-container text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95">
          Criar Novo Plano
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan, i) => {
          const isPopular = plan.name === 'Business';
          return (
            <div key={i} className={`relative bg-white dark:bg-[#1b2023] border rounded-2xl p-6 shadow-sm flex flex-col transition-all hover:shadow-md ${
              isPopular ? 'border-primary dark:border-primary-fixed-dim ring-1 ring-primary/20' : 'border-slate-200 dark:border-[#34383b]'
            }`}>
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
                    Mais Popular
                  </span>
                </div>
              )}
              
              <div className="mb-6">
                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  {plan.price !== null ? (
                    <>
                      <span className="text-2xl font-black text-slate-900 dark:text-white">{formatMZN(plan.price).replace(' MT', '')}</span>
                      <span className="text-xs text-slate-500 font-bold">MT/mês</span>
                    </>
                  ) : (
                    <span className="text-2xl font-black text-slate-900 dark:text-white">Personalizado</span>
                  )}
                </div>
              </div>

              <div className="flex-1 space-y-4 mb-8">
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Limites</p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                      <span className="material-symbols-outlined text-[16px] text-primary">person</span>
                      {plan.users} Utilizadores
                    </li>
                    <li className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                      <span className="material-symbols-outlined text-[16px] text-blue-500">store</span>
                      {plan.branches} {plan.branches === 1 ? 'Sucursal' : 'Sucursais'}
                    </li>
                    <li className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                      <span className="material-symbols-outlined text-[16px] text-purple-500">warehouse</span>
                      {plan.warehouses} {plan.warehouses === 1 ? 'Armazém' : 'Armazéns'}
                    </li>
                    <li className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                      <span className="material-symbols-outlined text-[16px] text-emerald-500">point_of_sale</span>
                      {plan.pos} {plan.pos === 1 ? 'Terminal POS' : 'Terminais POS'}
                    </li>
                  </ul>
                </div>

                <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Módulos Incluídos</p>
                  <ul className="space-y-2">
                    {plan.features.map((feat: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                        <span className="material-symbols-outlined text-[16px] text-green-500 shrink-0">check_circle</span>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <button className={`w-full py-2.5 rounded-xl text-xs font-bold transition-colors ${
                isPopular 
                  ? 'bg-primary hover:bg-primary-container text-white shadow-sm' 
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100'
              }`}>
                Editar plano
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PlansConfigPage;
