import React, { useState, useEffect } from 'react';
import { SuperAdminService, CompanyRow } from '../services/superadmin.service';
import { PageLoader } from '@/shared/components/feedback';
import { formatDate } from '@/shared/utils/formatters';

interface CompaniesListPageProps {
  onSelectCompany: (id: string) => void;
}

const CompaniesListPage: React.FC<CompaniesListPageProps> = ({ onSelectCompany }) => {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCompanies = async () => {
      setLoading(true);
      try {
        const data = await SuperAdminService.fetchCompanies();
        setCompanies(data);
      } catch (err) {
        console.error('Error fetching companies', err);
      } finally {
        setLoading(false);
      }
    };
    loadCompanies();
  }, []);

  if (loading) return <PageLoader message="A carregar empresas..." />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">Empresas</h1>
          <p className="text-sm text-slate-500 mt-1">Gerir todos os clientes Movax ERP.</p>
        </div>
        <button className="px-4 py-2 bg-primary hover:bg-primary-container text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95">
          + Nova
        </button>
      </div>

      <div className="bg-white dark:bg-[#1b2023] border border-slate-200 dark:border-[#34383b] rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <input 
            type="text" 
            placeholder="Pesquisar..." 
            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-primary/20 outline-none"
          />
          <select className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-primary/20 outline-none">
            <option>Todos os Estados</option>
            <option>Active</option>
            <option>Past Due</option>
            <option>Suspended</option>
          </select>
          <select className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-primary/20 outline-none">
            <option>Todos os Planos</option>
            <option>Starter</option>
            <option>Business</option>
            <option>Pro</option>
            <option>Enterprise</option>
          </select>
          <input 
            type="text" 
            placeholder="Cidade" 
            className="w-32 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-primary/20 outline-none"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-[#1b2023] border border-slate-200 dark:border-[#34383b] rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700/50 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                <th className="p-4">Empresa</th>
                <th className="p-4">NUIT</th>
                <th className="p-4">Plano</th>
                <th className="p-4">Estado</th>
                <th className="p-4 text-center">Utilizadores</th>
                <th className="p-4 text-center">Sucursais</th>
                <th className="p-4">Próx. Renovação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {companies.map(company => (
                <tr 
                  key={company.id} 
                  onClick={() => onSelectCompany(company.id)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                >
                  <td className="p-4">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{company.name}</p>
                    <p className="text-[10px] text-slate-500">{company.email}</p>
                  </td>
                  <td className="p-4 text-xs text-slate-700 dark:text-slate-300">{company.taxNumber}</td>
                  <td className="p-4 text-xs font-bold text-slate-700 dark:text-slate-300">{company.planCode}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      company.planStatus === 'ACTIVE' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' 
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400'
                    }`}>
                      {company.planStatus}
                    </span>
                  </td>
                  <td className="p-4 text-xs text-center text-slate-700 dark:text-slate-300">{company.userCount}</td>
                  <td className="p-4 text-xs text-center text-slate-700 dark:text-slate-300">{company.branchCount}</td>
                  <td className="p-4 text-xs text-slate-700 dark:text-slate-300">{formatDate(company.subscriptionExpiresAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 text-center">
          <p className="text-xs text-slate-500">Mostrando {companies.length} de {companies.length} empresas</p>
        </div>
      </div>
    </div>
  );
};

export default CompaniesListPage;
