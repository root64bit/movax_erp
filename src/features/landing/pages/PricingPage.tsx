import React, { useState } from 'react';
import { NavbarPublic } from '../components/NavbarPublic';
import { FooterPublic } from '../components/FooterPublic';
import { PlanComparisonTable } from '../components/PlanComparisonTable';
import { DEFAULT_SUBSCRIPTION_PLANS } from '../services/onboarding.service';
import { AVAILABLE_ADDONS_CATALOG } from '@/features/subscriptions/services/subscription.service';

interface PricingPageProps {
  onNavigate?: (route: string) => void;
}

export const PricingPage: React.FC<PricingPageProps> = ({ onNavigate }) => {
  const [cycle, setCycle] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const handleNav = (route: string) => {
    if (onNavigate) {
      onNavigate(route);
    } else {
      window.history.pushState({}, '', `/${route}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const faqs = [
    {
      q: 'Posso mudar de plano a qualquer momento?',
      a: 'Sim! Pode fazer upgrade ou downgrade de plano diretamente no painel de administração da sua empresa a qualquer momento.',
    },
    {
      q: 'Como funciona o pagamento via M-Pesa?',
      a: 'Ao selecionar M-Pesa, receberá um push USSD no seu telemóvel para introduzir o seu PIN de forma 100% segura. A ativação é instantânea.',
    },
    {
      q: 'O que acontece se atingir o limite de utilizadores ou armazéns?',
      a: 'Pode contratar add-ons adicionais por utilizador ou armazém sem precisar mudar para um plano superior.',
    },
    {
      q: 'Existe algum contrato de fidelização?',
      a: 'Não. Os planos mensais podem ser cancelados a qualquer momento. Os planos anuais oferecem 15% de desconto.',
    },
    {
      q: 'Os dados da minha empresa ficam seguros e confidenciais?',
      a: 'Absolutamente. Todos os dados são isolados por tenant com segurança Row Level Security (RLS) e encriptação.',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background text-on-background font-body-md antialiased">
      <NavbarPublic onNavigate={handleNav} activeRoute="pricing" />

      <main className="flex-grow">
        {/* Header & Hero */}
        <section className="py-16 md:py-24 px-4 sm:px-6 md:px-8 max-w-[1280px] mx-auto text-center">
          <span className="text-xs font-black uppercase tracking-wider text-primary">Transparência & Flexibilidade</span>
          <h1 className="font-display-lg text-4xl sm:text-5xl font-black text-slate-900 dark:text-slate-100 mt-2 mb-4">
            Planos que acompanham o seu crescimento
          </h1>
          <p className="font-body-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-10 text-sm sm:text-base">
            Soluções robustas de ERP e Ponto de Venda desenhadas para a realidade empresarial moçambicana. Escolha o plano ideal para a sua empresa.
          </p>

          {/* Toggle Mensal / Anual */}
          <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800 rounded-full p-1.5 border border-slate-200 dark:border-slate-700 shadow-inner">
            <button
              type="button"
              onClick={() => setCycle('MONTHLY')}
              className={`px-6 py-2 rounded-full font-bold text-xs sm:text-sm transition-all ${
                cycle === 'MONTHLY'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Mensal (MZN)
            </button>
            <button
              type="button"
              onClick={() => setCycle('ANNUAL')}
              className={`px-6 py-2 rounded-full font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 ${
                cycle === 'ANNUAL'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <span>Anual</span>
              <span className="bg-green-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black">Poupe 15%</span>
            </button>
          </div>
        </section>

        {/* Pricing Cards Grid */}
        <section className="max-w-[1280px] mx-auto px-4 sm:px-6 md:px-8 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {DEFAULT_SUBSCRIPTION_PLANS.map((plan) => {
              const isBusiness = plan.code === 'BUSINESS';
              const monthlyRate = cycle === 'ANNUAL' ? Math.round(plan.priceAnnual / 12) : plan.priceMonthly;

              return (
                <div
                  key={plan.code}
                  className={`bg-surface dark:bg-slate-900 rounded-2xl border flex flex-col justify-between transition-all p-6 sm:p-7 relative ${
                    isBusiness
                      ? 'border-primary shadow-xl ring-2 ring-primary/20 -translate-y-1'
                      : 'border-outline-variant dark:border-slate-800 shadow-sm hover:shadow-md'
                  }`}
                >
                  {isBusiness && (
                    <div className="absolute top-0 right-6 -translate-y-1/2 bg-primary text-white px-3 py-0.5 rounded-full font-black text-[11px] uppercase tracking-wider shadow-sm">
                      Mais Popular
                    </div>
                  )}

                  <div>
                    <div className="mb-4">
                      <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">{plan.name}</h3>
                      <p className="text-xs text-slate-500 mt-1 min-h-[32px]">{plan.description}</p>
                    </div>

                    <div className="my-6">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-slate-100">
                          {monthlyRate.toLocaleString('pt-MZ')}
                        </span>
                        <span className="text-xs font-bold text-slate-500">MT / mês</span>
                      </div>
                      {cycle === 'ANNUAL' && (
                        <p className="text-[11px] text-green-600 dark:text-green-400 font-bold mt-1">
                          Faturado anualmente ({plan.priceAnnual.toLocaleString('pt-MZ')} MT/ano)
                        </p>
                      )}
                    </div>

                    {/* Operational Limits */}
                    <div className="space-y-2 py-4 border-t border-b border-outline-variant dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-primary">person</span>
                        <span>{plan.maxUsers ? `${plan.maxUsers} utilizadores` : 'Utilizadores ilimitados'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-primary">store</span>
                        <span>{plan.maxBranches ? `${plan.maxBranches} sucursal/loja` : 'Sucursais ilimitadas'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-primary">warehouse</span>
                        <span>{plan.maxWarehouses ? `${plan.maxWarehouses} armazém` : 'Armazéns ilimitados'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-primary">point_of_sale</span>
                        <span>{plan.maxPosTerminals ? `${plan.maxPosTerminals} caixa POS` : 'Caixas ilimitados'}</span>
                      </div>
                    </div>

                    {/* Feature highlights */}
                    <ul className="my-6 space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
                      {(plan.features || plan.includedFeatures || []).slice(0, 5).map((feat: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="material-symbols-outlined text-sm text-green-600 mt-0.5">check_circle</span>
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleNav(`register?plan=${plan.code}&cycle=${cycle}`)}
                    className={`w-full py-3 px-4 rounded-xl font-black text-xs sm:text-sm transition-all text-center block ${
                      isBusiness
                        ? 'bg-primary hover:bg-primary-container text-white shadow-md active:scale-95'
                        : 'bg-slate-100 dark:bg-slate-800 hover:bg-primary hover:text-white text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    Começar com {plan.name}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Feature Comparison Table */}
        <section className="max-w-[1280px] mx-auto px-4 sm:px-6 md:px-8 py-16 border-t border-outline-variant dark:border-slate-800">
          <div className="text-center mb-12">
            <span className="text-xs font-black uppercase tracking-wider text-primary">Tabela Detalhada</span>
            <h2 className="font-display-md text-3xl font-black text-slate-900 dark:text-slate-100 mt-2">
              Compare todos os recursos
            </h2>
          </div>

          <PlanComparisonTable onSelectPlan={(planCode) => handleNav(`register?plan=${planCode}&cycle=${cycle}`)} />
        </section>

        {/* Modular Add-ons Catalog Section */}
        <section className="max-w-[1280px] mx-auto px-4 sm:px-6 md:px-8 py-16 border-t border-outline-variant dark:border-slate-800">
          <div className="text-center mb-12">
            <span className="text-xs font-black uppercase tracking-wider text-primary">Flexibilidade Total</span>
            <h2 className="font-display-md text-3xl font-black text-slate-900 dark:text-slate-100 mt-2">
              Módulos e Add-ons Específicos
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-xl mx-auto">
              Precisa de mais poder? Ative recursos individuais a qualquer momento sem necessidade de mudar de plano.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {AVAILABLE_ADDONS_CATALOG.map((addon) => (
              <div
                key={addon.code}
                className="bg-surface dark:bg-slate-900 rounded-2xl border border-outline-variant dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded-md">
                    {addon.category}
                  </span>
                  <h4 className="font-bold text-base text-slate-900 dark:text-slate-100 mt-3">{addon.name}</h4>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{addon.description}</p>
                </div>
                <div className="pt-4 mt-6 border-t border-outline-variant dark:border-slate-800 flex items-baseline justify-between">
                  <span className="text-sm font-black text-primary">
                    +{addon.priceMonthly.toLocaleString('pt-MZ')} MT <span className="text-[11px] font-normal text-slate-500">/mês</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleNav('register')}
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    Disponível no ERP →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ Section */}
        <section className="max-w-[800px] mx-auto px-4 sm:px-6 py-20 border-t border-outline-variant dark:border-slate-800">
          <div className="text-center mb-12">
            <span className="text-xs font-black uppercase tracking-wider text-primary">Dúvidas Frequentes</span>
            <h2 className="font-display-md text-3xl font-black text-slate-900 dark:text-slate-100 mt-2">
              Perguntas & Respostas
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => {
              const isOpen = activeFaq === index;
              return (
                <div
                  key={index}
                  className="bg-surface dark:bg-slate-900 rounded-2xl border border-outline-variant dark:border-slate-800 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setActiveFaq(isOpen ? null : index)}
                    className="w-full p-5 text-left font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center justify-between gap-4"
                  >
                    <span>{faq.q}</span>
                    <span className="material-symbols-outlined text-xl text-slate-400 shrink-0">
                      {isOpen ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed border-t border-outline-variant/40 dark:border-slate-800 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <FooterPublic onNavigate={handleNav} />
    </div>
  );
};
