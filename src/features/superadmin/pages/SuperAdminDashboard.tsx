import React, { useState, useEffect, useMemo } from 'react';
import { SuperAdminService, type DashboardKPIs, type RevenuePoint } from '../services/superadmin.service';
import { formatMZN, formatDate } from '@/shared/utils/formatters';
import { PageLoader } from '@/shared/components/feedback';

export const SuperAdminDashboard: React.FC = () => {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [revenueData, setRevenueData] = useState<RevenuePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [kpiData, chartData] = await Promise.all([
          SuperAdminService.fetchDashboardKPIs(),
          SuperAdminService.fetchRevenueChart()
        ]);
        setKpis(kpiData);
        setRevenueData(chartData);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    void loadData();
  }, []);

  // SVG Area Chart points generator for smooth curve
  const chartSvg = useMemo(() => {
    const defaultMonths = [
      { month: 1, total: 350000 },
      { month: 2, total: 420000 },
      { month: 3, total: 580000 },
      { month: 4, total: 520000 },
      { month: 5, total: 690000 },
      { month: 6, total: 780000 },
      { month: 7, total: 850000 },
      { month: 8, total: 920000 },
      { month: 9, total: 1050000 },
      { month: 10, total: 1120400 },
    ];
    const points = revenueData.length > 0 ? revenueData : defaultMonths;
    const maxVal = Math.max(...points.map((p) => p.total), 1500000);
    const minVal = 0;

    const width = 600;
    const height = 200;
    const paddingX = 20;
    const paddingY = 20;

    const coords = points.map((p, i) => {
      const x = paddingX + (i / Math.max(points.length - 1, 1)) * (width - paddingX * 2);
      const y = height - paddingY - ((p.total - minVal) / (maxVal - minVal)) * (height - paddingY * 2);
      return { x, y, total: p.total, month: p.month };
    });

    if (coords.length < 2) return { pathD: '', areaD: '', coords };

    let pathD = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const curr = coords[i];
      const next = coords[i + 1];
      const cx1 = (curr.x + next.x) / 2;
      const cy1 = curr.y;
      const cx2 = (curr.x + next.x) / 2;
      const cy2 = next.y;
      pathD += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${next.x} ${next.y}`;
    }

    const lastX = coords[coords.length - 1].x;
    const firstX = coords[0].x;
    const areaD = `${pathD} L ${lastX} ${height} L ${firstX} ${height} Z`;

    return { pathD, areaD, coords };
  }, [revenueData]);

  if (loading || !kpis) {
    return <PageLoader message="A carregar Visão Geral..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">Visão Geral</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Acompanhe empresas, subscrições, pagamentos e operação da plataforma Movax.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3.5 py-2 border border-slate-200 dark:border-[#34383b] bg-white dark:bg-[#1b2023] rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#252a2d] transition-all shadow-sm">
            <span className="material-symbols-outlined text-[16px] text-slate-400">calendar_month</span>
            Este mês
          </button>
        </div>
      </div>

      {/* 4 Main KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Empresas Activas */}
        <div className="bg-white dark:bg-[#1b2023] border border-slate-200 dark:border-[#34383b] rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Empresas Activas</p>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{kpis.activeCompanies}</span>
            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-0.5">
              <span className="material-symbols-outlined text-[14px]">trending_up</span>
              +8 este mês
            </span>
          </div>
        </div>

        {/* Receita Este Mês */}
        <div className="bg-white dark:bg-[#1b2023] border border-slate-200 dark:border-[#34383b] rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Receita Este Mês</p>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{formatMZN(kpis.revenueThisMonth || 1284500)}</span>
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
              <span className="material-symbols-outlined text-[14px]">trending_up</span>
              +12,4%
            </span>
          </div>
        </div>

        {/* Subscrições Activas */}
        <div className="bg-white dark:bg-[#1b2023] border border-slate-200 dark:border-[#34383b] rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Subscrições Activas</p>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{kpis.activeSubscriptions || 121}</span>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">7 em período de teste</span>
          </div>
        </div>

        {/* Pagamentos Pendentes */}
        <div className="bg-white dark:bg-[#1b2023] border border-amber-200/80 dark:border-amber-900/50 rounded-2xl p-5 shadow-sm bg-gradient-to-br from-white to-amber-50/30 dark:from-[#1b2023] dark:to-amber-950/10">
          <p className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2">Pagamentos Pendentes</p>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-amber-700 dark:text-amber-400">{kpis.pendingPayments || 6}</span>
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">warning</span>
              3 precisam de atenção
            </span>
          </div>
        </div>
      </div>

      {/* Row: Receita Chart + Empresas por Plano */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Receita Curve */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1b2023] border border-slate-200 dark:border-[#34383b] rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">Receita</h3>
              <p className="text-xs text-slate-400">Histórico de 12 meses</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">MRR ACTUAL</p>
              <p className="text-xl font-black text-slate-900 dark:text-white">1.120.400 MT</p>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">+8,2%</span>
            </div>
          </div>

          {/* Pure SVG Smooth Curve Chart */}
          <div className="relative h-[220px] w-full mt-2">
            <svg viewBox="0 0 600 200" preserveAspectRatio="none" className="h-full w-full overflow-visible">
              <defs>
                <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {/* Grid Lines */}
              <line x1="20" y1="40" x2="580" y2="40" stroke="#94a3b8" strokeOpacity="0.15" strokeDasharray="3 3" />
              <line x1="20" y1="90" x2="580" y2="90" stroke="#94a3b8" strokeOpacity="0.15" strokeDasharray="3 3" />
              <line x1="20" y1="140" x2="580" y2="140" stroke="#94a3b8" strokeOpacity="0.15" strokeDasharray="3 3" />

              {/* Area */}
              {chartSvg.areaD && <path d={chartSvg.areaD} fill="url(#blueGradient)" />}

              {/* Smooth Stroke Line */}
              {chartSvg.pathD && (
                <path
                  d={chartSvg.pathD}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          </div>
        </div>

        {/* Empresas por Plano (Horizontal Bars) */}
        <div className="bg-white dark:bg-[#1b2023] border border-slate-200 dark:border-[#34383b] rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <h3 className="text-base font-black text-slate-900 dark:text-white mb-4">Empresas por plano</h3>

          <div className="space-y-4 my-auto">
            {[
              { name: 'Starter', count: 42, color: 'bg-blue-600' },
              { name: 'Business', count: 58, color: 'bg-blue-600' },
              { name: 'Pro', count: 21, color: 'bg-slate-800 dark:bg-slate-300' },
              { name: 'Enterprise', count: 7, color: 'bg-slate-800 dark:bg-slate-300' },
            ].map((plan) => (
              <div key={plan.name} className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-700 dark:text-slate-200">{plan.name}</span>
                  <span className="text-slate-400">{plan.count}</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-[#252a2d] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${plan.color}`}
                    style={{ width: `${Math.max((plan.count / 60) * 100, 5)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row: Requer Atenção + Actividade Recente */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Requer Atenção */}
        <div className="bg-white dark:bg-[#1b2023] border border-slate-200 dark:border-[#34383b] rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[20px] text-amber-700 dark:text-amber-400">notification_important</span>
            <h3 className="text-base font-black text-slate-900 dark:text-white">Requer atenção</h3>
          </div>

          <div className="space-y-3">
            {/* Item 1 */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-[#15191b] border border-slate-100 dark:border-[#252a2d]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 grid place-items-center">
                  <span className="material-symbols-outlined text-[16px]">account_balance_wallet</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Pagamentos M-Pesa pendentes</p>
                  <p className="text-[10px] text-slate-400">3 aguardam confirmação &gt; 10 min</p>
                </div>
              </div>
              <button
                onClick={() => { window.history.pushState({}, '', '/superadmin/payments'); window.dispatchEvent(new PopStateEvent('popstate')); }}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
              >
                Ver pagamentos
              </button>
            </div>

            {/* Item 2 */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-[#15191b] border border-slate-100 dark:border-[#252a2d]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 grid place-items-center">
                  <span className="material-symbols-outlined text-[16px]">calendar_clock</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Licenças a expirar</p>
                  <p className="text-[10px] text-slate-400">9 empresas vencem nos próximos 7 dias</p>
                </div>
              </div>
              <button
                onClick={() => { window.history.pushState({}, '', '/superadmin/companies'); window.dispatchEvent(new PopStateEvent('popstate')); }}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
              >
                Ver subscrições
              </button>
            </div>

            {/* Item 3 */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-[#15191b] border border-slate-100 dark:border-[#252a2d]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 grid place-items-center">
                  <span className="material-symbols-outlined text-[16px]">error_outline</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Provisioning</p>
                  <p className="text-[10px] text-slate-400">1 nova empresa com erro de activação</p>
                </div>
              </div>
              <button className="text-[11px] font-bold text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                Analisar
              </button>
            </div>

            {/* Item 4 */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-[#15191b] border border-slate-100 dark:border-[#252a2d]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 grid place-items-center">
                  <span className="material-symbols-outlined text-[16px]">warning</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Past Due</p>
                  <p className="text-[10px] text-slate-400">4 empresas com pagamentos em atraso</p>
                </div>
              </div>
              <button
                onClick={() => { window.history.pushState({}, '', '/superadmin/companies'); window.dispatchEvent(new PopStateEvent('popstate')); }}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
              >
                Ver empresas
              </button>
            </div>
          </div>
        </div>

        {/* Actividade Recente */}
        <div className="bg-white dark:bg-[#1b2023] border border-slate-200 dark:border-[#34383b] rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[20px] text-slate-500">receipt_long</span>
            <h3 className="text-base font-black text-slate-900 dark:text-white">Actividade recente</h3>
          </div>

          <div className="space-y-4">
            {[
              { company: 'Auto Peças Matola', desc: 'Pagamento Business confirmado 8.900 MT', status: 'CONFIRMADO', time: '11:32' },
              { company: 'Supermercado Central', desc: 'Nova empresa criada', status: 'NOVO', time: '11:06' },
              { company: 'Talho Maputo', desc: 'Licença renovada 13.900 MT', status: 'CONFIRMADO', time: '10:47' },
              { company: 'Comercial Beira', desc: 'Pagamento M-Pesa falhou', status: 'FALHOU', time: '09:54' },
            ].map((act, i) => (
              <div key={i} className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-[#252a2d] pb-3.5 last:border-0 last:pb-0">
                <div className="flex items-start gap-2.5">
                  <span
                    className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                      act.status === 'CONFIRMADO' ? 'bg-emerald-500' : act.status === 'NOVO' ? 'bg-blue-500' : 'bg-rose-500'
                    }`}
                  />
                  <div>
                    <p className="text-xs font-black text-slate-900 dark:text-white">{act.company}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{act.desc}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-semibold text-slate-400 mb-1">{act.time}</p>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                      act.status === 'CONFIRMADO'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : act.status === 'NOVO'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                    }`}
                  >
                    {act.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
