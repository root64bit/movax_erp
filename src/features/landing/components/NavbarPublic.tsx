import React, { useState } from 'react';
import { PLATFORM_PRODUCT_NAME } from '@/shared/lib/branding';

interface NavbarPublicProps {
  onNavigate?: (route: string) => void;
  activeRoute?: string;
}

export const NavbarPublic: React.FC<NavbarPublicProps> = ({ onNavigate, activeRoute = 'home' }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNav = (route: string) => {
    setMobileMenuOpen(false);
    if (onNavigate) {
      onNavigate(route);
    } else {
      window.history.pushState({}, '', route === 'home' ? '/' : `/${route}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-surface/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-outline-variant dark:border-slate-800 transition-colors">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 md:px-8 h-20 flex items-center justify-between">
        {/* Brand */}
        <button
          type="button"
          onClick={() => handleNav('home')}
          className="flex items-center gap-3 group text-left cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-2xl">dataset</span>
          </div>
          <div>
            <span className="font-display-md text-xl font-black tracking-tight text-slate-900 dark:text-slate-100 block">
              {PLATFORM_PRODUCT_NAME}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Plataforma Cloud Moçambique
            </span>
          </div>
        </button>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          <button
            type="button"
            onClick={() => handleNav('home')}
            className={`font-body-md text-sm font-bold transition-colors hover:text-primary ${
              activeRoute === 'home' ? 'text-primary' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Início
          </button>
          <button
            type="button"
            onClick={() => handleNav('pricing')}
            className={`font-body-md text-sm font-bold transition-colors hover:text-primary ${
              activeRoute === 'pricing' ? 'text-primary' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Preços & Planos
          </button>
        </nav>

        {/* Action Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleNav('login')}
            className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            Iniciar Sessão
          </button>
          <button
            type="button"
            onClick={() => handleNav('register')}
            className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-white font-black text-xs sm:text-sm shadow-md transition-all active:scale-95 cursor-pointer"
          >
            Criar Conta Grátis
          </button>
        </div>

        {/* Mobile Hamburger */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden w-10 h-10 rounded-xl border border-outline-variant dark:border-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200"
          aria-label="Menu de Navegação"
        >
          <span className="material-symbols-outlined text-2xl">
            {mobileMenuOpen ? 'close' : 'menu'}
          </span>
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-outline-variant dark:border-slate-800 bg-surface dark:bg-slate-900 px-6 py-6 space-y-4 animate-fadeIn">
          <div className="flex flex-col space-y-3">
            <button
              type="button"
              onClick={() => handleNav('home')}
              className={`text-left font-bold text-base py-2 ${
                activeRoute === 'home' ? 'text-primary' : 'text-slate-700 dark:text-slate-200'
              }`}
            >
              Início
            </button>
            <button
              type="button"
              onClick={() => handleNav('pricing')}
              className={`text-left font-bold text-base py-2 ${
                activeRoute === 'pricing' ? 'text-primary' : 'text-slate-700 dark:text-slate-200'
              }`}
            >
              Preços & Planos
            </button>
          </div>

          <div className="pt-4 border-t border-outline-variant dark:border-slate-800 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => handleNav('login')}
              className="w-full py-3 rounded-xl border border-outline-variant text-center font-bold text-sm text-slate-700 dark:text-slate-200"
            >
              Iniciar Sessão
            </button>
            <button
              type="button"
              onClick={() => handleNav('register')}
              className="w-full py-3 rounded-xl bg-primary text-white text-center font-black text-sm shadow-md"
            >
              Criar Conta Grátis
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
