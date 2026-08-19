import React, { useEffect, useState } from 'react';
import { PLATFORM_PRODUCT_NAME, PLATFORM_TAGLINE } from '@/shared/lib/branding';

interface SuperAdminLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userLabel?: string;
  onSignOut?: () => void;
}

export const SuperAdminLayout: React.FC<SuperAdminLayoutProps> = ({
  children,
  activeTab,
  setActiveTab,
  userLabel = 'Super Admin',
  onSignOut,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return document.documentElement.classList.contains('dark');
  });
  
  const [globalSearch, setGlobalSearch] = useState('');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    document.body.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const navItems = [
    { id: 'overview', label: 'Principal', icon: 'dashboard' },
    { id: 'companies', label: 'Comercial', icon: 'business' },
    { id: 'payments', label: 'Operações', icon: 'payments' },
    { id: 'control', label: 'Controlo', icon: 'shield' },
    { id: 'plans', label: 'Configuração', icon: 'tune' },
  ];

  const navigate = (tab: string) => {
    setActiveTab(tab);
    window.history.pushState({ tab }, '', `/superadmin/${tab === 'overview' ? '' : tab}`);
  };
  
  const handleExitToErp = () => {
    window.location.href = '/';
  };

  const title = navItems.find((item) => item.id === activeTab)?.label || 'Super Admin';

  const sidebar = (
    <aside
      aria-label="Navegação Super Admin"
      className={`fixed inset-y-0 left-0 z-40 flex w-[292px] max-w-[88vw] flex-col border-r border-slate-200 bg-white shadow-sm transition-transform dark:border-[#34383b] dark:bg-[#15191b] lg:w-[252px] lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}
    >
      <div className="border-b border-slate-200 px-5 py-5 dark:border-[#34383b]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#062b55] text-sm font-black tracking-tight text-white shadow-sm">MX</div>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-black tracking-tight text-[#062b55] dark:text-[#b5d0ff]">{PLATFORM_PRODUCT_NAME}</p>
                <div className="mt-0.5 inline-block rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                  Super Admin
                </div>
              </div>
            </div>
          </div>
          <button aria-label="Fechar menu" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-[#252a2d]" onClick={() => setMenuOpen(false)}>
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-0 py-3 font-sans">
        <div className="space-y-4">
          <div>
            <div className="space-y-0.5">
              {navItems.map((item) => {
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
        </div>
      </nav>

      <div className="border-t border-slate-200 p-4 dark:border-[#34383b]">
        <button
          onClick={handleExitToErp}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-[#34383b] dark:bg-[#1d2225] dark:text-slate-200 dark:hover:bg-[#252a2d]"
        >
          <span className="material-symbols-outlined text-[16px]">storefront</span>
          Voltar ao ERP Normal
        </button>
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e7eef7] text-xs font-black text-[#062b55] dark:bg-[#26384b] dark:text-[#b5d0ff]">
            {userLabel.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-black dark:text-white">{userLabel}</p>
            <p className="truncate text-[10px] font-semibold text-slate-500 dark:text-slate-400">Super Administrator</p>
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
            <p className="truncate text-[15px] font-black tracking-tight text-slate-900 dark:text-white">
              {title}
            </p>
          </div>
        </div>

        <div className="relative hidden w-full max-w-md md:block">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">search</span>
          <input
            aria-label="Pesquisa global"
            value={globalSearch}
            onChange={(event) => setGlobalSearch(event.target.value)}
            placeholder="Pesquisar subscrições, empresas..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-14 text-[13px] font-medium outline-none transition focus:border-[#5377a0] focus:bg-white focus:ring-2 focus:ring-[#5377a0]/15 dark:border-[#34383b] dark:bg-[#202529] dark:text-white dark:placeholder-slate-500"
          />
        </div>

        <div className="relative ml-2">
          <button
            type="button"
            aria-label="Notificações do sistema"
            className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#34383b] dark:bg-[#202529] dark:text-slate-200"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
          </button>
        </div>

        <div className="flex items-center justify-center ml-2 h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-[#e7eef7] text-xs font-black text-[#062b55] dark:border-[#34383b] dark:bg-[#26384b] dark:text-[#b5d0ff]">
          {userLabel.slice(0, 2).toUpperCase()}
        </div>

        <button type="button" onClick={() => setIsDark((value) => !value)} aria-label="Alternar tema" title={isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro'} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#34383b] dark:bg-[#202529] dark:text-slate-200">
          <span className="material-symbols-outlined text-[20px]">{isDark ? 'light_mode' : 'dark_mode'}</span>
        </button>
      </header>

      <main className="min-h-screen px-3 pb-8 pt-[84px] sm:px-5 lg:ml-[252px] lg:px-6 lg:pt-[88px] xl:px-8">
        <div className="mx-auto w-full max-w-[1680px]">
          <div className="mb-4">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Painel Central &gt; <span className="text-[#062b55] dark:text-[#b5d0ff]">{title}</span>
            </p>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
};
