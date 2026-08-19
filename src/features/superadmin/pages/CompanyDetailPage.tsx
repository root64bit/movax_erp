import React, { useState, useEffect } from 'react';
import { SuperAdminService, CompanyRow } from '../services/superadmin.service';
import { PageLoader } from '@/shared/components/feedback';
import { formatMZN, formatDate } from '@/shared/utils/formatters';

interface CompanyDetailPageProps {
  companyId: string;
  onBack: () => void;
}

const CompanyDetailPage: React.FC<CompanyDetailPageProps> = ({ companyId, onBack }) => {
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('resumo');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await SuperAdminService.fetchCompanyDetail(companyId);
        setCompany(data);
      } catch (err) {
        console.error('Error fetching company', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [companyId]);

  if (loading || !company) return <PageLoader message="A carregar detalhes da empresa..." />;

  const tabs = ['Resumo', 'Subscrição', 'Pagamentos', 'Utilização', 'Utilizadores', 'Sucursais', 'Módulos', 'Auditoria'];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex-1 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">{company.name}</h1>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                company.planStatus === 'ACTIVE' 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' 
                  : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400'
              }`}>
                {company.planStatus}
              </span>
            </div>
            <p className="text-xs text-slate-500">NUIT: {company.taxNumber} • {company.planCode} • {formatMZN(company.lastPaymentAmount)}/mês</p>
          </div>
          <button className="px-4 py-2 bg-primary hover:bg-primary-container text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95">
            Gerir subscrição
          </button>
        </div>
      </div>

      <div className="flex space-x-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-px">
        {tabs.map(tab => {
          const tabKey = tab.toLowerCase();
          const isActive = activeTab === tabKey;
          return (
            <button
              key={tabKey}
              onClick={() => setActiveTab(tabKey)}
              className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition-colors ${
                isActive 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {activeTab === 'resumo' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-[#1b2023] border border-slate-200 dark:border-[#34383b] rounded-2xl p-6 shadow-sm">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Plano Actual</p>
                  <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">{company.planCode}</h3>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-primary dark:text-primary-fixed-dim">{formatMZN(company.lastPaymentAmount)}<span className="text-[10px] text-slate-500 font-normal">/mês</span></p>
                  <p className="text-[10px] text-slate-500 mt-1">Próxima renovação: {formatDate(company.subscriptionExpiresAt)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#1b2023] border border-slate-200 dark:border-[#34383b] rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-6">Utilização de Recursos</h3>
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-xs font-bold mb-2">
                    <span className="text-slate-700 dark:text-slate-300">Utilizadores</span>
                    <span className="text-slate-900 dark:text-slate-100">{company.userCount} / 10</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(company.userCount / 10) * 100}%` }}></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-xs font-bold mb-2">
                    <span className="text-slate-700 dark:text-slate-300">Armazéns</span>
                    <span className="text-slate-900 dark:text-slate-100">{company.warehouseCount} / 3</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(company.warehouseCount / 3) * 100}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-2">
                    <span className="text-slate-700 dark:text-slate-300">Terminais POS</span>
                    <span className="text-slate-900 dark:text-slate-100">{company.posTerminalCount} / 5</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(company.posTerminalCount / 5) * 100}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1b2023] border border-slate-200 dark:border-[#34383b] rounded-2xl p-6 shadow-sm h-fit">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-5">Informação da Empresa</h3>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Nome Legal</p>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{company.name}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">NUIT</p>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{company.taxNumber}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Email Principal</p>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{company.email}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Telefone</p>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{company.phone}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Cidade Sede</p>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{company.city}</p>
              </div>
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Data de Criação</p>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{formatDate(company.subscriptionStartsAt)}</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1b2023] border border-slate-200 dark:border-[#34383b] rounded-2xl p-12 text-center shadow-sm">
          <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-700 mb-2">construction</span>
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Separador "{activeTab}" em desenvolvimento</p>
          <p className="text-xs text-slate-500 mt-1">O conteúdo desta secção será disponibilizado brevemente.</p>
        </div>
      )}
    </div>
  );
};

export default CompanyDetailPage;
