import React from 'react';
import { NavbarPublic } from '../components/NavbarPublic';
import { FooterPublic } from '../components/FooterPublic';
import { PLATFORM_PRODUCT_NAME, PLATFORM_TAGLINE } from '@/shared/lib/branding';

interface LandingPageProps {
  onNavigate?: (route: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const handleNav = (route: string) => {
    if (onNavigate) {
      onNavigate(route);
    } else {
      window.history.pushState({}, '', route === 'home' ? '/' : `/${route}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-on-background font-body-md antialiased">
      <NavbarPublic onNavigate={handleNav} activeRoute="home" />

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="py-20 md:py-28 px-4 sm:px-6 md:px-8 max-w-[1280px] mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-black uppercase tracking-wider mb-6">
            <span className="material-symbols-outlined text-base">verified</span>
            <span>ERP & POS Cloud Multiempresa • Moçambique</span>
          </div>

          <h1 className="font-display-lg text-4xl sm:text-6xl font-black text-slate-900 dark:text-slate-100 tracking-tight max-w-4xl mx-auto leading-tight">
            Gestão profissional completa para empresas moçambicanas
          </h1>

          <p className="font-body-lg text-base sm:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mt-6 mb-10 leading-relaxed">
            Controle vendas, múltiplos armazéns, cotações, faturas, compras e caixa com a plataforma cloud mais moderna e intuitiva do mercado.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => handleNav('register')}
              className="w-full sm:w-auto px-8 py-4 bg-primary hover:bg-primary-container text-white font-black text-sm sm:text-base rounded-2xl shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              Registar Empresa Agora →
            </button>
            <button
              type="button"
              onClick={() => handleNav('pricing')}
              className="w-full sm:w-auto px-8 py-4 bg-surface dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 border border-outline-variant dark:border-slate-700 font-bold text-sm sm:text-base rounded-2xl transition-all cursor-pointer"
            >
              Ver Planos & Preços (MZN)
            </button>
          </div>
        </section>

        {/* Feature Highlights Grid */}
        <section className="py-16 px-4 sm:px-6 md:px-8 max-w-[1280px] mx-auto border-t border-outline-variant dark:border-slate-800">
          <div className="text-center mb-12">
            <span className="text-xs font-black uppercase tracking-wider text-primary">Funcionalidades Essenciais</span>
            <h2 className="font-display-md text-3xl font-black text-slate-900 dark:text-slate-100 mt-2">
              Tudo o que o seu negócio precisa num só lugar
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 bg-surface dark:bg-slate-900 rounded-3xl border border-outline-variant dark:border-slate-800 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 grid place-items-center">
                <span className="material-symbols-outlined text-2xl">point_of_sale</span>
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">POS & Faturação Rápida</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Ponto de venda ágil com suporte para leitor de código de barras, impressão de faturas térmicas e A4, e emissão de cotações em segundos.
              </p>
            </div>

            <div className="p-6 bg-surface dark:bg-slate-900 rounded-3xl border border-outline-variant dark:border-slate-800 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 grid place-items-center">
                <span className="material-symbols-outlined text-2xl">warehouse</span>
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Multiarmazém & Transferências</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Gestão rigorosa de stocks em tempo real, transferências com envio e receção confirmada, inventários e valorização pelo custo médio ponderado.
              </p>
            </div>

            <div className="p-6 bg-surface dark:bg-slate-900 rounded-3xl border border-outline-variant dark:border-slate-800 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 grid place-items-center">
                <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Gestão de Caixa & Contas</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Controlo diário de abertura e fecho de caixas com declaração de quebras/sobras, sangrias, reforços e contas correntes de clientes e fornecedores.
              </p>
            </div>
          </div>
        </section>
      </main>

      <FooterPublic onNavigate={handleNav} />
    </div>
  );
};
