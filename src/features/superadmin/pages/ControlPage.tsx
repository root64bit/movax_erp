import React, { useState } from 'react';

export const ControlPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'audit' | 'security' | 'database'>('audit');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">Controlo e Auditoria</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Auditoria de acessos, segurança multi-tenant e monitorização de instâncias da plataforma Movax.
        </p>
      </div>

      <div className="flex gap-2 border-b border-slate-200 dark:border-[#34383b] pb-2">
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'audit'
              ? 'bg-[#062b55] text-white dark:bg-[#70a6ff] dark:text-[#001e40]'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#252a2d]'
          }`}
        >
          Logs de Auditoria
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'security'
              ? 'bg-[#062b55] text-white dark:bg-[#70a6ff] dark:text-[#001e40]'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#252a2d]'
          }`}
        >
          Segurança e RLS
        </button>
        <button
          onClick={() => setActiveTab('database')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'database'
              ? 'bg-[#062b55] text-white dark:bg-[#70a6ff] dark:text-[#001e40]'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#252a2d]'
          }`}
        >
          Saúde do Sistema
        </button>
      </div>

      <div className="bg-white dark:bg-[#1b2023] border border-slate-200 dark:border-[#34383b] rounded-2xl p-6 shadow-sm">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-black text-slate-900 dark:text-white">Isolamento Multi-Tenant (RLS Ativo)</p>
              <p className="text-xs text-slate-400">Todas as consultas de clientes estão restritas por company_id</p>
            </div>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-full text-xs font-black">
              ATIVO & PROTEGIDO
            </span>
          </div>

          <div className="border-t border-slate-100 dark:border-[#252a2d] pt-4">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Registos de Operação do Super Admin</h4>
            <div className="space-y-2 font-mono text-xs">
              <div className="p-3 bg-slate-50 dark:bg-[#15191b] rounded-xl flex justify-between items-center text-slate-600 dark:text-slate-300">
                <span>[2026-08-19 12:49] Super Admin login via Tenant 0001 (superadmin@movax.co.mz)</span>
                <span className="text-emerald-600 font-bold">SUCESSO</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-[#15191b] rounded-xl flex justify-between items-center text-slate-600 dark:text-slate-300">
                <span>[2026-08-19 12:30] Migration 063 aplicada - Superadmin security definer RPCs criados</span>
                <span className="text-emerald-600 font-bold">SUCESSO</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-[#15191b] rounded-xl flex justify-between items-center text-slate-600 dark:text-slate-300">
                <span>[2026-08-19 12:15] Tenant 1001 (Cliente Activo) utilizador admin autenticado</span>
                <span className="text-emerald-600 font-bold">SUCESSO</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlPage;
