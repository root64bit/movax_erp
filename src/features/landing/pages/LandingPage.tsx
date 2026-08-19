import React from 'react';
import { NavbarPublic } from '../components/NavbarPublic';
import { FooterPublic } from '../components/FooterPublic';
import { PLATFORM_PRODUCT_NAME } from '@/shared/lib/branding';

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
    <div className="min-h-screen flex flex-col bg-background text-on-background font-body-md antialiased selection:bg-primary/20">
      <NavbarPublic onNavigate={handleNav} activeRoute="home" />

      <main className="flex-grow">
        {/* HERO SECTION */}
        <section className="relative py-16 md:py-24 px-4 sm:px-6 md:px-8 max-w-[1280px] mx-auto text-center overflow-hidden">
          {/* Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 mb-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-xs font-black uppercase tracking-wider">
              <span className="material-symbols-outlined text-sm">wifi_off</span>
              <span>Online & Offline First</span>
            </div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-black uppercase tracking-wider">
              <span className="material-symbols-outlined text-sm">tune</span>
              <span>Soluções Customizadas ao Cliente</span>
            </div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 text-xs font-black uppercase tracking-wider">
              <span className="material-symbols-outlined text-sm">payments</span>
              <span>M-Pesa Integrado</span>
            </div>
          </div>

          <h1 className="font-display-lg text-4xl sm:text-6xl md:text-7xl font-black text-slate-900 dark:text-slate-100 tracking-tight max-w-5xl mx-auto leading-tight">
            Gestão inteligente que funciona <span className="text-primary underline decoration-primary/30">online e offline</span>
          </h1>

          <p className="font-body-lg text-base sm:text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto mt-6 mb-10 leading-relaxed">
            A plataforma SaaS ERP & POS multiempresa desenhada para a realidade moçambicana. Fature sem interrupções mesmo com perdas de conexão à web e personalize o sistema à medida exata da sua operação comercial.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
            <button
              type="button"
              onClick={() => handleNav('register')}
              className="w-full sm:w-auto px-8 py-4 bg-primary hover:bg-primary-container text-white font-black text-sm sm:text-base rounded-2xl shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Registar Empresa & Começar</span>
              <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </button>
            <button
              type="button"
              onClick={() => handleNav('pricing')}
              className="w-full sm:w-auto px-8 py-4 bg-surface dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 border border-outline-variant dark:border-slate-700 font-bold text-sm sm:text-base rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg text-primary">local_offer</span>
              <span>Ver Planos & Subscrições</span>
            </button>
          </div>

          {/* Quick Pillars */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 text-left border border-outline-variant dark:border-slate-800 rounded-3xl p-6 bg-surface/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Moeda & Fiscal</span>
              <p className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-base">receipt_long</span>
                100% MZN & IVA Moçambique
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Conectividade</span>
              <p className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-emerald-600 text-base">cloud_sync</span>
                Auto-Sincronização Cloud
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pagamentos Rápidos</span>
              <p className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-blue-600 text-base">phone_android</span>
                M-Pesa & Cartões POS
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Arquitetura</span>
              <p className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-purple-600 text-base">domain</span>
                Multi-Sucursal & Multiarmazém
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 1: ONLINE & OFFLINE RESILIENCE */}
        <section className="py-20 px-4 sm:px-6 md:px-8 bg-slate-900 text-white relative overflow-hidden">
          <div className="max-w-[1280px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-black uppercase tracking-wider">
                <span className="material-symbols-outlined text-sm">signal_disconnected</span>
                <span>Sem Interrupções de Venda</span>
              </div>
              <h2 className="font-display-lg text-3xl sm:text-5xl font-black tracking-tight leading-tight">
                A plataforma funciona <span className="text-emerald-400">online e offline</span> mesmo com quebra de conexão à web
              </h2>
              <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
                Sabemos que a instabilidade de internet ou cortes na rede elétrica são desafios reais. Com o {PLATFORM_PRODUCT_NAME}, a sua equipa continua a faturar e atender clientes sem qualquer atraso:
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-sm font-bold">check</span>
                  </div>
                  <div>
                    <strong className="text-white block text-sm">Emissão Contínua de Vendas & Talões POS</strong>
                    <span className="text-xs text-slate-400">Os caixas continuam operacionais, emitem faturas/talões e processam pagamentos sem depender de rede ativa.</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-sm font-bold">check</span>
                  </div>
                  <div>
                    <strong className="text-white block text-sm">Armazenamento Local Criptografado</strong>
                    <span className="text-xs text-slate-400">Todas as transações e movimentos de stock ficam registados em segurança na memória local do terminal.</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-sm font-bold">check</span>
                  </div>
                  <div>
                    <strong className="text-white block text-sm">Auto-Sincronização Automática com a Nuvem</strong>
                    <span className="text-xs text-slate-400">Assim que a ligação à internet é restabelecida, os dados sincronizam automaticamente com os servidores centrais sem duplicados.</span>
                  </div>
                </li>
              </ul>
            </div>

            <div className="bg-slate-800/80 border border-slate-700 rounded-3xl p-8 shadow-2xl relative">
              <div className="flex items-center justify-between pb-6 border-b border-slate-700 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-xs font-bold text-slate-300">Modo Híbrido Resiliente Ativo</span>
                </div>
                <span className="text-xs font-mono bg-slate-900 px-3 py-1 rounded-lg text-emerald-400 font-bold">Sincronização 100% Garantida</span>
              </div>
              <div className="space-y-4 text-xs">
                <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-700/80 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-emerald-400">wifi_off</span>
                    <div>
                      <p className="font-bold text-white">Internet Caiu no Ponto de Venda</p>
                      <p className="text-slate-400 text-[11px]">Sistema muda transparentemente para armazenamento offline local</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">Vendas Continuam</span>
                </div>
                <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-700/80 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-blue-400">sync</span>
                    <div>
                      <p className="font-bold text-white">Ligação Web Restabelecida</p>
                      <p className="text-slate-400 text-[11px]">Faturas, stocks e caixas sobem para o Supabase Cloud</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-md bg-blue-500/20 text-blue-300 font-bold text-[10px]">Auto-Sync Concluído</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: CUSTOMIZED SOLUTIONS FOR THE CLIENT */}
        <section className="py-20 px-4 sm:px-6 md:px-8 max-w-[1280px] mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-black uppercase tracking-wider text-primary">Flexibilidade Total</span>
            <h2 className="font-display-lg text-3xl sm:text-5xl font-black text-slate-900 dark:text-slate-100 mt-2">
              Soluções Customizadas e À Medida do seu Negócio
            </h2>
            <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base mt-4">
              Cada sector tem as suas particularidades. O {PLATFORM_PRODUCT_NAME} adapta-se à sua empresa com módulos configuráveis, regras fiscais locais e fluxos sob medida.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 bg-surface dark:bg-slate-900 rounded-3xl border border-outline-variant dark:border-slate-800 shadow-sm hover:shadow-md transition-all space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl">build</span>
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">Oficinas, Auto & Pneus</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Gestão integrada de artigos com medidas (pneus, baterias, óleos), ordens de serviço, mão de obra (alinhamento, calibragem) e tabelas de compatibilidade.
              </p>
            </div>

            <div className="p-8 bg-surface dark:bg-slate-900 rounded-3xl border border-outline-variant dark:border-slate-800 shadow-sm hover:shadow-md transition-all space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl">storefront</span>
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">Retalho, Lojas & Supermercados</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Faturação ultra-rápida por código de barras, impressão térmica com layout personalizado, múltiplos caixas POS em simultâneo e fechos de turno cegos.
              </p>
            </div>

            <div className="p-8 bg-surface dark:bg-slate-900 rounded-3xl border border-outline-variant dark:border-slate-800 shadow-sm hover:shadow-md transition-all space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl">local_shipping</span>
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">Distribuição & Logística</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Controlo de múltiplos armazéns com transferências internas guiadas, cotações com validade configurável e contas correntes a prazo (15, 30, 60 dias).
              </p>
            </div>
          </div>

          {/* Custom enterprise callout */}
          <div className="mt-12 p-8 rounded-3xl bg-primary/5 dark:bg-slate-800/60 border border-primary/20 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <h4 className="text-lg font-black text-slate-900 dark:text-slate-100">Necessita de uma integração ou módulo específico?</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl">
                Desenvolvemos conectores para balanças, sistemas legados, importação em lote de bases de dados antigas e regras fiscais à medida da sua empresa.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleNav('register')}
              className="px-6 py-3 bg-primary hover:bg-primary-container text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all shrink-0 cursor-pointer"
            >
              Falar com Especialista / Registar
            </button>
          </div>
        </section>

        {/* SECTION 3: SUBSCRIPTIONS & PLANS HIGHLIGHT */}
        <section className="py-20 px-4 sm:px-6 md:px-8 bg-slate-50 dark:bg-slate-900/40 border-t border-b border-outline-variant dark:border-slate-800">
          <div className="max-w-[1280px] mx-auto text-center">
            <span className="text-xs font-black uppercase tracking-wider text-primary">Subscrições Descomplicadas</span>
            <h2 className="font-display-lg text-3xl sm:text-5xl font-black text-slate-900 dark:text-slate-100 mt-2 mb-4">
              Escolha o seu plano e subscreva em 2 minutos
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base max-w-2xl mx-auto mb-12">
              Clique em qualquer plano para subscrever e configurar a sua empresa de imediato com ativação por M-Pesa.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
              {/* STARTER */}
              <div className="p-6 bg-surface dark:bg-slate-900 rounded-2xl border border-outline-variant dark:border-slate-800 flex flex-col justify-between hover:border-primary/50 transition-all">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">STARTER</h3>
                    <p className="text-xs text-slate-500">Pequenos negócios e lojas únicas</p>
                  </div>
                  <div>
                    <span className="text-3xl font-black text-slate-900 dark:text-slate-100">4.500</span>
                    <span className="text-xs font-bold text-slate-500"> MT / mês</span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                    <li className="flex items-center gap-2">✓ Até 3 Utilizadores</li>
                    <li className="flex items-center gap-2">✓ 1 Sucursal & 1 Armazém</li>
                    <li className="flex items-center gap-2">✓ 1 Terminal POS</li>
                    <li className="flex items-center gap-2">✓ Funcionamento Offline</li>
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => handleNav('register?plan=STARTER&cycle=MONTHLY')}
                  className="mt-6 w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-primary hover:text-white font-bold text-xs text-slate-800 dark:text-slate-200 transition-all text-center cursor-pointer"
                >
                  Subscrever STARTER →
                </button>
              </div>

              {/* BUSINESS */}
              <div className="p-6 bg-surface dark:bg-slate-900 rounded-2xl border-2 border-primary shadow-xl ring-2 ring-primary/20 flex flex-col justify-between relative -translate-y-1">
                <div className="absolute top-0 right-4 -translate-y-1/2 bg-primary text-white px-3 py-0.5 rounded-full font-black text-[10px] uppercase">
                  Recomendado
                </div>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">BUSINESS</h3>
                    <p className="text-xs text-slate-500">Para empresas consolidadas</p>
                  </div>
                  <div>
                    <span className="text-3xl font-black text-slate-900 dark:text-slate-100">8.900</span>
                    <span className="text-xs font-bold text-slate-500"> MT / mês</span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                    <li className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">✓ Até 7 Utilizadores</li>
                    <li className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">✓ 1 Sucursal & 2 Armazéns</li>
                    <li className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">✓ 2 Caixas POS</li>
                    <li className="flex items-center gap-2">✓ Pagamento M-Pesa Automático</li>
                    <li className="flex items-center gap-2">✓ Transferências de Stock</li>
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => handleNav('register?plan=BUSINESS&cycle=MONTHLY')}
                  className="mt-6 w-full py-2.5 rounded-xl bg-primary hover:bg-primary-container text-white font-black text-xs shadow-md transition-all text-center cursor-pointer"
                >
                  Subscrever BUSINESS →
                </button>
              </div>

              {/* PRO */}
              <div className="p-6 bg-surface dark:bg-slate-900 rounded-2xl border border-outline-variant dark:border-slate-800 flex flex-col justify-between hover:border-primary/50 transition-all">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">PRO</h3>
                    <p className="text-xs text-slate-500">Empresas com múltiplas sucursais</p>
                  </div>
                  <div>
                    <span className="text-3xl font-black text-slate-900 dark:text-slate-100">13.900</span>
                    <span className="text-xs font-bold text-slate-500"> MT / mês</span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                    <li className="flex items-center gap-2">✓ Até 15 Utilizadores</li>
                    <li className="flex items-center gap-2">✓ 2 Sucursais & 6 Armazéns</li>
                    <li className="flex items-center gap-2">✓ 6 Caixas POS</li>
                    <li className="flex items-center gap-2">✓ Relatórios Analíticos de Margem</li>
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => handleNav('register?plan=PRO&cycle=MONTHLY')}
                  className="mt-6 w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-primary hover:text-white font-bold text-xs text-slate-800 dark:text-slate-200 transition-all text-center cursor-pointer"
                >
                  Subscrever PRO →
                </button>
              </div>

              {/* ENTERPRISE */}
              <div className="p-6 bg-surface dark:bg-slate-900 rounded-2xl border border-outline-variant dark:border-slate-800 flex flex-col justify-between hover:border-primary/50 transition-all">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">ENTERPRISE</h3>
                    <p className="text-xs text-slate-500">Redes e grandes distribuidores</p>
                  </div>
                  <div>
                    <span className="text-2xl font-black text-slate-900 dark:text-slate-100">Sob Medida</span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                    <li className="flex items-center gap-2">✓ Utilizadores Ilimitados</li>
                    <li className="flex items-center gap-2">✓ Sucursais & Armazéns Ilimitados</li>
                    <li className="flex items-center gap-2">✓ API & Integrações Dedicadas</li>
                    <li className="flex items-center gap-2">✓ Suporte 24/7 & SLA Prioritário</li>
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => handleNav('register?plan=ENTERPRISE&cycle=MONTHLY')}
                  className="mt-6 w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-primary hover:text-white font-bold text-xs text-slate-800 dark:text-slate-200 transition-all text-center cursor-pointer"
                >
                  Subscrever ENTERPRISE →
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <FooterPublic onNavigate={handleNav} />
    </div>
  );
};
