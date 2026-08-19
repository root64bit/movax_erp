import React from 'react';
import { PLATFORM_PRODUCT_NAME, PLATFORM_TAGLINE } from '@/shared/lib/branding';

interface FooterPublicProps {
  onNavigate?: (route: string) => void;
}

export const FooterPublic: React.FC<FooterPublicProps> = ({ onNavigate }) => {
  const handleNav = (route: string) => {
    if (onNavigate) {
      onNavigate(route);
    } else {
      window.history.pushState({}, '', route === 'home' ? '/' : `/${route}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 text-xs py-14 px-4 sm:px-6 md:px-8">
      <div className="max-w-[1280px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="space-y-3">
          <div className="flex items-center gap-2 font-black text-base text-white">
            <span className="material-symbols-outlined text-primary text-xl">dataset</span>
            <span>{PLATFORM_PRODUCT_NAME}</span>
          </div>
          <p className="text-slate-400 text-xs leading-relaxed">{PLATFORM_TAGLINE}</p>
          <p className="text-[11px] text-slate-500">Desenvolvido com foco no mercado de Moçambique.</p>
        </div>

        <div>
          <h4 className="font-bold text-white uppercase text-[11px] tracking-wider mb-3">Plataforma</h4>
          <ul className="space-y-2">
            <li>
              <button type="button" onClick={() => handleNav('pricing')} className="hover:text-white transition-colors">
                Planos & Preços
              </button>
            </li>
            <li>
              <button type="button" onClick={() => handleNav('register')} className="hover:text-white transition-colors">
                Registo de Empresa
              </button>
            </li>
            <li>
              <button type="button" onClick={() => handleNav('login')} className="hover:text-white transition-colors">
                Acesso / Login
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-white uppercase text-[11px] tracking-wider mb-3">Módulos ERP</h4>
          <ul className="space-y-2 text-slate-400">
            <li>Ponto de Venda (POS)</li>
            <li>Gestão de Artigos & Stock</li>
            <li>Cotações & Guias de Transporte</li>
            <li>Contas Correntes & Caixa</li>
            <li>Transferências entre Armazéns</li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-white uppercase text-[11px] tracking-wider mb-3">Suporte & Contactos</h4>
          <p className="text-slate-400 mb-2">Maputo, Moçambique</p>
          <p className="text-slate-400 mb-2">Linha de Apoio: (+258) 84 000 0000</p>
          <p className="text-slate-400">Email: suporte@movax.co.mz</p>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto mt-12 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-slate-500 text-[11px]">
        <p>© {new Date().getFullYear()} {PLATFORM_PRODUCT_NAME}. Todos os direitos reservados.</p>
        <p className="mt-2 sm:mt-0">Preços apresentados em Meticais (MZN).</p>
      </div>
    </footer>
  );
};
