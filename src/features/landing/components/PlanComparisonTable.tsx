import React from 'react';

export interface PlanComparisonTableProps {
  onSelectPlan?: (planCode: string) => void;
}

export const PlanComparisonTable: React.FC<PlanComparisonTableProps> = ({ onSelectPlan }) => {
  const categories = [
    {
      title: 'Estrutura & Limites',
      rows: [
        { feature: 'Utilizadores Incluídos', starter: '3', business: '7', pro: '15', enterprise: 'Ilimitado' },
        { feature: 'Sucursais / Lojas', starter: '1', business: '1', pro: '2', enterprise: 'Ilimitadas' },
        { feature: 'Armazéns', starter: '1', business: '2', pro: '6', enterprise: 'Múltiplos / Centrais' },
        { feature: 'Caixas / Terminais POS', starter: '1', business: '2', pro: '6', enterprise: 'Ilimitados' },
      ],
    },
    {
      title: 'Vendas & Frente de Caixa',
      rows: [
        { feature: 'Ponto de Venda (POS) Rápido & Offline', starter: true, business: true, pro: true, enterprise: true },
        { feature: 'Faturação e Recibos em MZN', starter: true, business: true, pro: true, enterprise: true },
        { feature: 'Impressão Térmica e A4', starter: true, business: true, pro: true, enterprise: true },
        { feature: 'Cotações & Proformas', starter: true, business: true, pro: true, enterprise: true },
        { feature: 'Caixa por Turno com Fecho Cego', starter: false, business: true, pro: true, enterprise: true },
        { feature: 'Módulo Supermercado (Balança EAN-13)', starter: false, business: 'Add-on', pro: 'Add-on', enterprise: true },
      ],
    },
    {
      title: 'Stock, Armazéns & Compras Multimoeda',
      rows: [
        { feature: 'Catálogo de Artigos com Preço e IVA', starter: true, business: true, pro: true, enterprise: true },
        { feature: 'Compras Multimoeda (USD/ZAR/EUR com Câmbio Manual)', starter: false, business: true, pro: true, enterprise: true },
        { feature: 'Algoritmos de Saída de Stock (FIFO / LIFO / PMP)', starter: 'PMP Padrão', business: 'Configurável', pro: 'Configurável', enterprise: 'Total' },
        { feature: 'Rastreabilidade por Lote, Validade & Números de Série', starter: false, business: 'Add-on', pro: true, enterprise: true },
        { feature: 'Transferências de Stock em Trânsito com Guia', starter: false, business: true, pro: true, enterprise: true },
        { feature: 'Módulo Talho (Desmancho de Carcaças)', starter: false, business: 'Add-on', pro: 'Add-on', enterprise: true },
      ],
    },
    {
      title: 'Financeiro, Tesouraria & Exportações',
      rows: [
        { feature: 'Contas Correntes de Clientes e Fornecedores', starter: false, business: true, pro: true, enterprise: true },
        { feature: 'Baixa de Banco & Reconciliação Bancária', starter: false, business: true, pro: true, enterprise: true },
        { feature: 'Exportação de Documentos em PDF, Excel (.xlsx) e Word (.doc)', starter: 'PDF / Excel', business: true, pro: true, enterprise: true },
        { feature: 'BI Pro (Margens Reais & Curva ABC)', starter: false, business: false, pro: true, enterprise: true },
        { feature: 'Módulo Business API & Webhooks', starter: false, business: false, pro: false, enterprise: 'Incluído (Enterprise)' },
        { feature: 'Backup Cloud Contínuo & Transição de Dados', starter: 'Add-on', business: 'Add-on', businessAddon: true, pro: 'Add-on', enterprise: true },
        { feature: 'Segurança RBAC & Perfis de Utilizador', starter: 'Básica', business: 'Padrão', pro: 'Avançada', enterprise: 'Total & SLA' },
        { feature: 'Suporte Técnico Local em Moçambique', starter: 'Email', business: 'Email + Telefone', pro: 'Prioritário', enterprise: 'Dedicado 24/7' },
      ],
    },
  ];

  return (
    <div className="w-full overflow-x-auto border border-outline-variant dark:border-slate-800 rounded-xl bg-surface dark:bg-slate-900 shadow-sm">
      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="bg-surface-container-low dark:bg-slate-800/60 border-b border-outline-variant dark:border-slate-800">
            <th className="p-4 sm:p-5 font-black text-slate-900 dark:text-slate-100 min-w-[260px]">Funcionalidades</th>
            <th className="p-4 sm:p-5 font-black text-slate-800 dark:text-slate-200 text-center min-w-[120px]">STARTER</th>
            <th className="p-4 sm:p-5 font-black text-primary dark:text-primary-fixed-dim text-center min-w-[120px] bg-primary/5">BUSINESS</th>
            <th className="p-4 sm:p-5 font-black text-slate-800 dark:text-slate-200 text-center min-w-[120px]">PRO</th>
            <th className="p-4 sm:p-5 font-black text-slate-800 dark:text-slate-200 text-center min-w-[120px]">ENTERPRISE</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((cat, catIdx) => (
            <React.Fragment key={catIdx}>
              <tr className="bg-slate-100/70 dark:bg-slate-800/30 border-y border-slate-200 dark:border-slate-800">
                <td colSpan={5} className="py-2.5 px-4 sm:px-5 font-black text-xs uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  {cat.title}
                </td>
              </tr>
              {cat.rows.map((row, rowIdx) => (
                <tr key={rowIdx} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                  <td className="p-4 font-medium text-slate-700 dark:text-slate-300">{row.feature}</td>
                  <td className="p-4 text-center font-bold">{renderCellValue(row.starter)}</td>
                  <td className="p-4 text-center font-bold bg-primary/5">{renderCellValue(row.business)}</td>
                  <td className="p-4 text-center font-bold">{renderCellValue(row.pro)}</td>
                  <td className="p-4 text-center font-bold">{renderCellValue(row.enterprise)}</td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

function renderCellValue(val: boolean | string | undefined) {
  if (typeof val === 'boolean') {
    return val ? (
      <span className="material-symbols-outlined text-green-600 text-xl inline-block align-middle">check_circle</span>
    ) : (
      <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-xl inline-block align-middle">remove</span>
    );
  }
  if (val === 'Add-on') {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
        Add-on
      </span>
    );
  }
  return <span className="text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-semibold">{val || '—'}</span>;
}
