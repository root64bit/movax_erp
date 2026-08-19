import React, { useState, useEffect } from 'react';
import { SuperAdminService, PaymentRow } from '../services/superadmin.service';
import { PageLoader } from '@/shared/components/feedback';
import { formatMZN, formatDateTime } from '@/shared/utils/formatters';

const PaymentsPage: React.FC = () => {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await SuperAdminService.fetchPayments();
        setPayments(data);
      } catch (err) {
        console.error('Error fetching payments', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return <PageLoader message="A carregar pagamentos..." />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">Pagamentos</h1>
          <p className="text-sm text-slate-500 mt-1">Acompanhe pagamentos de licenças e renovações Movax.</p>
        </div>
        <button className="px-4 py-2 border border-outline-variant dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">download</span>
          Exportar
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#1b2023] border-l-4 border-l-blue-500 border border-slate-200 dark:border-[#34383b] rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Recebido Este Mês</p>
          <span className="text-2xl font-black text-slate-900 dark:text-white">{formatMZN(854000)}</span>
        </div>
        <div className="bg-white dark:bg-[#1b2023] border-l-4 border-l-amber-500 border border-slate-200 dark:border-[#34383b] rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Pendente</p>
          <span className="text-2xl font-black text-amber-600 dark:text-amber-500">{formatMZN(35600)}</span>
        </div>
        <div className="bg-white dark:bg-[#1b2023] border-l-4 border-l-rose-500 border border-slate-200 dark:border-[#34383b] rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Falhado</p>
          <span className="text-2xl font-black text-rose-600 dark:text-rose-500">{formatMZN(13900)}</span>
        </div>
        <div className="bg-white dark:bg-[#1b2023] border-l-4 border-l-slate-400 border border-slate-200 dark:border-[#34383b] rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Reembolsado</p>
          <span className="text-2xl font-black text-slate-700 dark:text-slate-300">{formatMZN(0)}</span>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1b2023] border border-slate-200 dark:border-[#34383b] rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <select className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-primary/20 outline-none">
            <option>Data: Todos</option>
            <option>Hoje</option>
            <option>Esta semana</option>
            <option>Este mês</option>
          </select>
          <select className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-primary/20 outline-none">
            <option>Provider: Todos</option>
            <option>M-Pesa</option>
            <option>e-Mola</option>
            <option>Cartão / BIM</option>
            <option>Transferência</option>
          </select>
          <select className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-primary/20 outline-none">
            <option>Estado: Todos</option>
            <option>Confirmado</option>
            <option>Pendente</option>
            <option>Falhado</option>
          </select>
          <select className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-primary/20 outline-none">
            <option>Plano: Todos</option>
            <option>Starter</option>
            <option>Business</option>
            <option>Pro</option>
          </select>
          <input 
            type="text" 
            placeholder="Pesquisar empresa ou ref..." 
            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-primary/20 outline-none"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-[#1b2023] border border-slate-200 dark:border-[#34383b] rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700/50 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                <th className="p-4">Data</th>
                <th className="p-4">Empresa</th>
                <th className="p-4">Plano</th>
                <th className="p-4">Método</th>
                <th className="p-4">Referência</th>
                <th className="p-4 text-right">Valor</th>
                <th className="p-4">Estado</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {payments.map(payment => (
                <tr key={payment.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatDateTime(payment.createdAt)}</td>
                  <td className="p-4 text-xs font-bold text-slate-900 dark:text-slate-100">{payment.companyName}</td>
                  <td className="p-4 text-xs text-slate-700 dark:text-slate-300">{payment.planCode}</td>
                  <td className="p-4 text-xs text-slate-700 dark:text-slate-300">{payment.method}</td>
                  <td className="p-4 text-xs text-slate-700 dark:text-slate-300 font-mono">{payment.reference}</td>
                  <td className="p-4 text-xs font-bold text-slate-900 dark:text-slate-100 text-right">{formatMZN(payment.amount)}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      payment.status === 'CONFIRMADO' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                      payment.status === 'FALHADO' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400' :
                      'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                    }`}>
                      {payment.status}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <button className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-colors inline-flex items-center justify-center">
                      <span className="material-symbols-outlined text-[18px]">more_vert</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 text-center">
          <p className="text-xs text-slate-500">Mostrando {payments.length} de {payments.length} transacções</p>
        </div>
      </div>
    </div>
  );
};

export default PaymentsPage;
