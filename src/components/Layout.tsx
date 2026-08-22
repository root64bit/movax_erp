import React, { useEffect, useMemo, useState } from 'react';
import type { AccessScope, Article, Client, DocumentRecord } from '@/shared/types/domain.types';
import { formatMZN } from '@/shared/utils/formatters';
import { PLATFORM_PRODUCT_NAME, PLATFORM_TAGLINE } from '@/shared/lib/branding';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  globalSearch: string;
  setGlobalSearch: (q: string) => void;
  onTriggerShortcut?: (key: string) => void;
  userLabel?: string;
  roleLabel?: string;
  companyName?: string;
  systemMode?: string;
  warehouseLabel?: string;
  warehouses?: AccessScope[];
  activeWarehouseId?: string;
  onSelectWarehouse?: (warehouseId: string) => Promise<void> | void;
  onSignOut?: () => void;
  permissions?: string[];
  articles?: Article[];
  clients?: Client[];
  documents?: DocumentRecord[];
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  activeTab,
  setActiveTab,
  globalSearch,
  setGlobalSearch,
  userLabel = 'Utilizador',
  roleLabel = '',
  companyName = 'Empresa',
  systemMode = 'PRODUCTION',
  warehouseLabel = '',
  warehouses = [],
  activeWarehouseId = '',
  onSelectWarehouse,
  onSignOut,
  permissions = [],
  articles = [],
  clients = [],
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifTab, setNotifTab] = useState<'stock' | 'receivables'>('stock');
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [contextChanging, setContextChanging] = useState(false);
  const [contextError, setContextError] = useState('');
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return document.documentElement.classList.contains('dark');
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    document.body.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, []);

  const has = (...codes: string[]) => codes.some((code) => permissions.includes(code));

  const lowStockArticles = useMemo(
    () => articles
      .filter((art) => art.stock <= art.minStock)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 50),
    [articles],
  );
  const pendingReceivables = useMemo(
    () => clients
      .filter((client) => client.pendingBalance > 0)
      .sort((a, b) => b.pendingBalance - a.pendingBalance)
      .slice(0, 50),
    [clients],
  );
  const totalNotifications = lowStockArticles.length + pendingReceivables.length;

  const navItems = useMemo(
    () => [
      { id: 'dashboard', label: 'Início', icon: 'home', group: 'Principal', visible: permissions.length === 0 || has('dashboard.read', 'products.view') },
      { id: 'inventory', label: 'Artigos e Stock', icon: 'inventory_2', group: 'Principal', visible: permissions.length === 0 || has('products.read', 'products.view', 'stock.read', 'stock.view') },
      { id: 'sales', label: 'Nova Venda', icon: 'local_offer', group: 'Principal', visible: permissions.length === 0 || has('sales.create') },
      { id: 'quotation', label: 'Cotação', icon: 'request_quote', group: 'Principal', visible: permissions.length === 0 || has('sales.create', 'sales.read') },
      { id: 'purchases', label: 'Compras', icon: 'shopping_cart', group: 'Principal', visible: permissions.length === 0 || has('purchases.read', 'purchases.invoice.create') },
      { id: 'movements', label: 'Entradas e Saídas', icon: 'swap_horiz', group: 'Principal', visible: permissions.length === 0 || has('stock.read', 'stock.view', 'stock.direct_entry', 'stock.direct_exit') },
      { id: 'entities', label: 'Clientes e Fornecedores', icon: 'group', group: 'Principal', visible: permissions.length === 0 || has('settings.manage', 'products.view', 'customers.manage') },
      { id: 'documents', label: 'Documentos', icon: 'description', group: 'Principal', visible: permissions.length === 0 || has('documents.view') },
      { id: 'accounts', label: 'Pagamentos e Contas', icon: 'account_balance_wallet', group: 'Principal', visible: permissions.length === 0 || has('payments.read', 'payments.view', 'accounts.read') },
      { id: 'reports', label: 'Relatórios', icon: 'analytics', group: 'Principal', visible: permissions.length === 0 || has('reports.read', 'reports.sales', 'reports.stock') },
      { id: 'license', label: 'Plano e Licença', icon: 'card_membership', group: 'Gestão', visible: permissions.length === 0 || has('settings.manage') },
      { id: 'administration', label: 'Administração', icon: 'settings', group: 'Gestão', visible: permissions.length === 0 || has('settings.manage', 'users.manage') },
      { id: 'superadmin', label: 'Painel Super Admin', icon: 'admin_panel_settings', group: 'Gestão', visible: roleLabel?.includes('SUPER_ADMIN') },
    ].filter((item) => item.visible),
    [permissions],
  );

  const navGroups = useMemo(() => {
    const order = ['Principal', 'Stock e Compras', 'Comercial e Financeiro', 'Gestão'];
    return order
      .map((group) => ({ group, items: navItems.filter((item) => item.group === group) }))
      .filter((section) => section.items.length > 0);
  }, [navItems]);

  useEffect(() => setMenuOpen(false), [activeTab]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setShowNotifications(false);
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const navigate = (tab: string) => {
    if (tab === 'superadmin') {
      window.location.href = '/superadmin';
      return;
    }
    setActiveTab(tab);
    setShowNotifications(false);
    window.history.pushState({ tab }, '', `/${tab === 'dashboard' ? '' : tab}`);
  };

  const title = navItems.find((item) => item.id === activeTab)?.label || 'Acesso não autorizado';
  const normalizedMode = systemMode === 'MIGRATION' ? 'MIGRAÇÃO' : systemMode === 'LIVE' ? 'PRODUÇÃO' : systemMode || 'PRODUÇÃO';
  const resolvedWarehouseLabel = warehouses.find((warehouse) => warehouse.id === activeWarehouseId)?.name || warehouseLabel;

  const changeWarehouse = async (warehouseId: string) => {
    if (!onSelectWarehouse || warehouseId === activeWarehouseId || contextChanging) return;
    setContextChanging(true);
    setContextError('');
    try {
      await onSelectWarehouse(warehouseId);
    } catch (cause) {
      setContextError(cause instanceof Error ? cause.message : 'Não foi possível mudar o armazém.');
    } finally {
      setContextChanging(false);
    }
  };

  const sidebar = (
    <aside
      aria-label="Navegação principal"
      className={`fixed inset-y-0 left-0 z-40 flex w-[292px] max-w-[88vw] flex-col border-r border-slate-200 bg-white shadow-sm transition-transform dark:border-[#34383b] dark:bg-[#15191b] lg:w-[252px] lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}
    >
      <div className="border-b border-slate-200 px-5 py-5 dark:border-[#34383b]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#062b55] text-sm font-black tracking-tight text-white shadow-sm">MX</div>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-black tracking-tight text-[#062b55] dark:text-[#b5d0ff]">{PLATFORM_PRODUCT_NAME}</p>
                <p className="truncate text-[10px] font-semibold text-slate-500 dark:text-slate-400">{PLATFORM_TAGLINE}</p>
              </div>
            </div>
          </div>
          <button aria-label="Fechar menu" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-[#252a2d]" onClick={() => setMenuOpen(false)}>
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#34383b] dark:bg-[#1d2225]">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">Empresa ativa</p>
          <p className="mt-1 truncate text-sm font-black text-slate-900 dark:text-white" title={companyName}>{companyName}</p>
          {warehouses.length > 1 && onSelectWarehouse ? (
            <label className="mt-2 block">
              <span className="sr-only">Armazém operacional</span>
              <select
                aria-label="Armazém operacional"
                value={activeWarehouseId || warehouses[0]?.id || ''}
                disabled={contextChanging}
                onChange={(event) => { void changeWarehouse(event.target.value); }}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-bold text-slate-700 outline-none focus:border-[#5377a0] dark:border-[#34383b] dark:bg-[#202529] dark:text-slate-200"
              >
                {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
              </select>
              {contextChanging && <span className="mt-1 block text-[9px] font-semibold text-blue-600">A mudar contexto…</span>}
              {contextError && <span className="mt-1 block text-[9px] font-semibold text-red-600">{contextError}</span>}
            </label>
          ) : resolvedWarehouseLabel ? (
            <p className="mt-1 truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">{resolvedWarehouseLabel}</p>
          ) : null}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-0 py-3 font-sans">
        <div className="space-y-4">
          {navGroups.map((section) => (
            <div key={section.group}>
              {section.group !== 'Principal' && (
                <p className="px-5 pb-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{section.group}</p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.id)}
                      className={`group relative flex w-full items-center gap-3.5 px-5 py-3 text-left transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#e4ecf6] text-[#001e40] dark:bg-[#1a2c42] dark:text-[#a7c8ff] font-extrabold border-r-[4px] border-[#001e40] dark:border-[#70a6ff]'
                          : 'font-semibold text-slate-800 hover:bg-slate-100/70 dark:text-[#cbd0d4] dark:hover:bg-[#252a2d]'
                      }`}
                    >
                      {isActive ? (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded border-[1.5px] border-[#001e40] bg-transparent text-[#001e40] dark:border-[#70a6ff] dark:text-[#a7c8ff]">
                          <span className="material-symbols-outlined text-[15px] font-bold">{item.icon}</span>
                        </div>
                      ) : (
                        <span className="material-symbols-outlined text-[20px] shrink-0 text-slate-800 dark:text-slate-300 group-hover:text-[#001e40] transition-colors">
                          {item.icon}
                        </span>
                      )}
                      <span className={`truncate text-[14px] tracking-tight ${isActive ? 'font-black text-[#001e40] dark:text-[#a7c8ff]' : 'font-semibold text-slate-800 dark:text-slate-200'}`}>
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      <div className="border-t border-slate-200 p-4 dark:border-[#34383b]">
        <div className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-[#1d2225]">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <div className="min-w-0">
              <p className="truncate text-[11px] font-black text-slate-700 dark:text-slate-200">{isOnline ? 'Internet disponível' : 'Internet indisponível'}</p>
              <p className="truncate text-[9px] font-semibold uppercase tracking-wide text-slate-400">{normalizedMode}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e7eef7] text-xs font-black text-[#062b55] dark:bg-[#26384b] dark:text-[#b5d0ff]">{userLabel.slice(0, 2).toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-black dark:text-white">{userLabel}</p>
            <p className="truncate text-[10px] font-semibold text-slate-500 dark:text-slate-400">{roleLabel || 'Utilizador'}</p>
          </div>
          <button onClick={onSignOut} aria-label="Terminar sessão" title="Terminar sessão" className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700 dark:text-slate-400 dark:hover:bg-red-950/30 dark:hover:text-red-300">
            <span className="material-symbols-outlined text-lg">logout</span>
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-[#f5f7fa] font-sans text-slate-900 dark:bg-[#111517] dark:text-[#e1e3e4]">
      {sidebar}
      {menuOpen && <button aria-label="Fechar menu" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-30 bg-black/45 backdrop-blur-[1px] lg:hidden" />}

      <header className="fixed inset-x-0 top-0 z-20 flex min-h-[68px] items-center gap-2 border-b border-slate-200 bg-white/95 px-3 shadow-sm backdrop-blur sm:px-5 dark:border-[#34383b] dark:bg-[#171b1e]/95 lg:left-[252px]">
        <button aria-label="Abrir menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-200 dark:hover:bg-[#252a2d]">
          <span className="material-symbols-outlined">menu</span>
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[15px] font-black tracking-tight text-slate-900 dark:text-white">{title}</p>
            <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-700 md:inline dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">{normalizedMode}</span>
          </div>
          <p className="truncate text-[10px] font-semibold text-slate-400">{companyName}{resolvedWarehouseLabel ? ` · ${resolvedWarehouseLabel}` : ''}</p>
        </div>

        <div className="relative hidden w-full max-w-md md:block">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">search</span>
          <input
            aria-label="Pesquisa global"
            value={globalSearch}
            onChange={(event) => setGlobalSearch(event.target.value)}
            placeholder="Pesquisar artigos, clientes, documentos..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-14 text-[13px] font-medium outline-none transition focus:border-[#5377a0] focus:bg-white focus:ring-2 focus:ring-[#5377a0]/15 dark:border-[#34383b] dark:bg-[#202529] dark:text-white dark:placeholder-slate-500"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-black text-slate-400 dark:border-[#454b50] dark:bg-[#171b1e]">F1</kbd>
        </div>

        {(permissions.length === 0 || has('sales.create')) && (
          <button
            type="button"
            onClick={() => navigate('sales')}
            className="hidden h-10 items-center gap-2 rounded-xl bg-[#006e25] px-4 text-xs font-black text-white shadow-sm transition hover:brightness-110 sm:flex"
          >
            <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
            Nova venda
          </button>
        )}

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowNotifications((value) => !value)}
            aria-label="Alertas operacionais"
            className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#34383b] dark:bg-[#202529] dark:text-slate-200"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            {totalNotifications > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-[9px] font-black leading-5 text-white">{totalNotifications > 99 ? '99+' : totalNotifications}</span>}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-12 z-50 w-[min(92vw,390px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-[#34383b] dark:bg-[#1b2023]">
              <div className="border-b border-slate-200 p-4 dark:border-[#34383b]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-black">Centro de alertas</p>
                    <p className="mt-0.5 text-[10px] font-semibold text-slate-400">Prioridades que precisam de atenção</p>
                  </div>
                  <button onClick={() => setShowNotifications(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-[#252a2d]"><span className="material-symbols-outlined text-lg">close</span></button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={() => setNotifTab('stock')} className={`rounded-lg px-3 py-2 text-[11px] font-black ${notifTab === 'stock' ? 'bg-[#062b55] text-white' : 'bg-slate-100 text-slate-600 dark:bg-[#252a2d] dark:text-slate-300'}`}>Stock ({lowStockArticles.length})</button>
                  <button onClick={() => setNotifTab('receivables')} className={`rounded-lg px-3 py-2 text-[11px] font-black ${notifTab === 'receivables' ? 'bg-[#062b55] text-white' : 'bg-slate-100 text-slate-600 dark:bg-[#252a2d] dark:text-slate-300'}`}>Cobranças ({pendingReceivables.length})</button>
                </div>
              </div>
              <div className="max-h-[430px] overflow-y-auto p-2">
                {notifTab === 'stock' ? (
                  lowStockArticles.length === 0 ? <p className="p-6 text-center text-xs font-semibold text-slate-400">Sem alertas de stock.</p> : lowStockArticles.map((article) => (
                    <button key={article.id} onClick={() => navigate('inventory')} className="flex w-full items-center justify-between gap-3 rounded-xl p-3 text-left hover:bg-slate-50 dark:hover:bg-[#252a2d]">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-black">{article.code} · {article.description}</p>
                        <p className="mt-0.5 text-[10px] font-semibold text-slate-400">Mínimo {article.minStock}</p>
                      </div>
                      <span className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-black ${article.stock <= 0 ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'}`}>{article.stock}</span>
                    </button>
                  ))
                ) : (
                  pendingReceivables.length === 0 ? <p className="p-6 text-center text-xs font-semibold text-slate-400">Sem valores pendentes.</p> : pendingReceivables.map((client) => (
                    <button key={client.id} onClick={() => navigate('accounts')} className="flex w-full items-center justify-between gap-3 rounded-xl p-3 text-left hover:bg-slate-50 dark:hover:bg-[#252a2d]">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-black">{client.name}</p>
                        <p className="mt-0.5 text-[10px] font-semibold text-slate-400">Conta corrente</p>
                      </div>
                      <span className="shrink-0 text-xs font-black text-red-700 dark:text-red-300">{formatMZN(client.pendingBalance)}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <button type="button" onClick={() => setIsDark((value) => !value)} aria-label="Alternar tema" title={isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro'} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#34383b] dark:bg-[#202529] dark:text-slate-200">
          <span className="material-symbols-outlined text-[20px]">{isDark ? 'light_mode' : 'dark_mode'}</span>
        </button>
      </header>

      <main className="min-h-screen px-3 pb-8 pt-[84px] sm:px-5 lg:ml-[252px] lg:px-6 lg:pt-[88px] xl:px-8">
        <div className="mx-auto w-full max-w-[1680px]">{children}</div>
      </main>
    </div>
  );
};
