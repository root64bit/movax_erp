import React from 'react';
import type { Article, SaleInvoice, Client, DashboardMetrics, DocumentRecord, StockMovement, Supplier } from '@/shared/types/domain.types';
import { formatMZN } from '@/shared/utils/formatters';

export interface DashboardProps {
  articles: Article[];
  sales: SaleInvoice[];
  clients?: Client[];
  setActiveTab?: (tab: string) => void;
  onNavigate?: (tab: string) => void;
  onOpenNewArticleModal?: () => void;
  metrics?: DashboardMetrics | null;
  permissions?: string[];
  documents?: DocumentRecord[];
  movements?: StockMovement[];
  suppliers?: Supplier[];
  serverDate?: string;
  canViewCost?: boolean;
  canAllowNegative?: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({
  articles,
  sales,
  clients = [],
  setActiveTab,
  onNavigate,
  onOpenNewArticleModal,
  metrics,
  permissions = [],
}) => {
  const navigate = onNavigate || setActiveTab || (() => {});
  const has = (...codes: string[]) => permissions.length === 0 || codes.some((code) => permissions.includes(code));
  const operationalDate = metrics?.serverDate;
  const lowStockArticles = articles
    .filter((a) => a.stock <= a.minStock && a.stock > 0)
    .sort((a, b) => a.stock - b.stock);
  const outOfStockArticles = articles.filter((a) => a.stock === 0);

  const stats = [
    {
      title: 'Artigos Cadastrados',
      value: metrics ? metrics.activeProducts : articles.length,
      icon: 'inventory_2',
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      title: 'Stock Baixo',
      value: metrics ? metrics.lowStockProducts : lowStockArticles.length,
      icon: 'warning',
      color: 'text-amber-600',
      bg: 'bg-amber-100 dark:bg-amber-950/40',
    },
    {
      title: 'Ruptura de Stock',
      value: metrics ? metrics.outOfStockProducts : outOfStockArticles.length,
      icon: 'error',
      color: 'text-rose-600',
      bg: 'bg-rose-100 dark:bg-rose-950/40',
    },
    {
      title: 'Vendas Hoje',
      value: formatMZN(metrics ? metrics.salesToday : sales.reduce((acc, s) => acc + (s.totalAmount || 0), 0)),
      icon: 'payments',
      color: 'text-emerald-600',
      bg: 'bg-emerald-100 dark:bg-emerald-950/40',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="bg-surface dark:bg-slate-900 border border-outline-variant dark:border-slate-800 rounded-2xl p-5 flex items-center gap-4 shadow-xs"
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bg} ${stat.color}`}>
              <span className="material-symbols-outlined text-2xl">{stat.icon}</span>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500">{stat.title}</p>
              <p className="text-lg font-black text-slate-900 dark:text-slate-100 mt-0.5">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-surface dark:bg-slate-900 border border-outline-variant dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Alertas de Stock</h3>
            <button
              type="button"
              onClick={() => navigate('inventory')}
              className="text-xs font-bold text-primary hover:underline"
            >
              Ver Inventário →
            </button>
          </div>
          {lowStockArticles.length === 0 && outOfStockArticles.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">Nenhum alerta de stock no momento.</p>
          ) : (
            <div className="space-y-2">
              {outOfStockArticles.slice(0, 4).map((a) => (
                <div key={a.id} className="flex justify-between items-center p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 text-xs">
                  <span className="font-bold text-rose-900 dark:text-rose-200">{a.code} - {a.description}</span>
                  <span className="font-black text-rose-700 dark:text-rose-400">Sem stock</span>
                </div>
              ))}
              {lowStockArticles.slice(0, 4).map((a) => (
                <div key={a.id} className="flex justify-between items-center p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 text-xs">
                  <span className="font-bold text-amber-900 dark:text-amber-200">{a.code} - {a.description}</span>
                  <span className="font-bold text-amber-700 dark:text-amber-400">{a.stock} / {a.minStock} {a.unit}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-surface dark:bg-slate-900 border border-outline-variant dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">Ações Rápidas</h3>
            <div className="space-y-2.5">
              {has('sales.create') && (
                <button
                  type="button"
                  onClick={() => navigate('pos')}
                  className="w-full p-3 rounded-xl bg-primary hover:bg-primary-container text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">point_of_sale</span>
                  <span>Nova Venda / POS</span>
                </button>
              )}
              {has('sales.create') && (
                <button
                  type="button"
                  onClick={() => navigate('quotation')}
                  className="w-full p-3 rounded-xl border border-outline-variant hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold text-xs flex items-center justify-center gap-2 transition-all"
                >
                  <span className="material-symbols-outlined text-base">request_quote</span>
                  <span>Criar Cotação</span>
                </button>
              )}
              {has('products.create') && (
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenNewArticleModal) onOpenNewArticleModal();
                    else navigate('inventory');
                  }}
                  className="w-full p-3 rounded-xl border border-outline-variant hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold text-xs flex items-center justify-center gap-2 transition-all"
                >
                  <span className="material-symbols-outlined text-base">add_box</span>
                  <span>Adicionar Artigo</span>
                </button>
              )}
            </div>
          </div>
          {operationalDate && (
            <p className="text-[10px] text-slate-400 mt-4 text-center">Data do Servidor: {new Date(operationalDate).toLocaleDateString('pt-MZ')}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export { Dashboard as DashboardPage };
export default Dashboard;
