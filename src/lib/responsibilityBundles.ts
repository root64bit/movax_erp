export interface ResponsibilityBundle {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  permissions: string[];
  allowedCapabilities: string[];
  forbiddenCapabilities: string[];
}

export const RESPONSIBILITY_BUNDLES: ResponsibilityBundle[] = [
  {
    id: 'bundle_admin',
    code: 'ADMIN',
    name: 'Administrador do Sistema',
    description: 'Acesso total a todas as funcionalidades, gestão de utilizadores, definições e auditoria.',
    icon: 'admin_panel_settings',
    permissions: [
      'admin.users',
      'admin.roles',
      'dashboard.read',
      'products.read',
      'products.create',
      'products.update',
      'products.delete',
      'sales.read',
      'sales.create',
      'sales.confirm',
      'sales.cancel',
      'purchases.read',
      'purchases.create',
      'purchases.confirm',
      'stock.read',
      'stock.direct_entry',
      'stock.direct_exit',
      'customers.read',
      'customers.create',
      'customers.update',
      'suppliers.read',
      'suppliers.create',
      'suppliers.update',
      'payments.receive',
      'payments.pay',
      'ledger.read',
      'reports.read',
      'reports.financial',
      'reports.print',
      'documents.print',
      'documents.export',
    ],
    allowedCapabilities: [
      'Criar e gerir utilizadores e atribuição de pacotes de responsabilidades',
      'Acesso total a todos os módulos operacionais, tabelas de referência e auditoria',
      'Criar e editar produtos, marcas, categorias e preços de venda',
      'Emitir Facturas, Vendas a Dinheiro, Guias de Remessa e Facturas de Fornecedor',
      'Realizar Entradas e Saídas Directas de stock',
      'Registar recebimentos de clientes e pagamentos a fornecedores',
      'Consultar todos os relatórios operacionais, financeiros e exportações CSV',
    ],
    forbiddenCapabilities: [
      'Nenhuma restrição (acesso total e irrestrito ao sistema)',
    ],
  },
  {
    id: 'bundle_manager',
    code: 'GESTOR_OPERACIONAL',
    name: 'Gestor Operacional',
    description: 'Supervisão operacional, consulta de stock, documentos e execução de movimentos directos.',
    icon: 'manage_accounts',
    permissions: [
      'dashboard.read',
      'products.read',
      'stock.read',
      'stock.direct_entry',
      'stock.direct_exit',
      'movements.read',
      'documents.read',
      'reports.read',
      'customers.read',
      'suppliers.read',
      'documents.print',
    ],
    allowedCapabilities: [
      'Consultar Dashboard e indicadores gerais do sistema',
      'Consultar catálogo de artigos e existências físicas em stock',
      'Consultar histórico de movimentos de stock e extrato por artigo',
      'Consultar documentos emitidos e relatórios operacionais',
      'Realizar Entradas Directas de stock (recepção de mercadoria)',
      'Realizar Saídas Directas de stock (ajustes, quebras)',
      'Imprimir relatórios e documentos autorizados',
    ],
    forbiddenCapabilities: [
      'Criar ou gerir utilizadores e permissões de acesso',
      'Emitir facturas de venda ou facturas de compra',
      'Registar recebimentos de clientes ou pagamentos a fornecedores',
      'Cancelar documentos confirmados ou alterar definições globais',
      'Alterar custos de aquisição ou margens de lucro dos produtos',
    ],
  },
  {
    id: 'bundle_sales',
    code: 'VENDAS_CAIXA',
    name: 'Vendas e Caixa',
    description: 'Emissão de documentos de venda a clientes, atendimento no POS, gestão de clientes e caixa.',
    icon: 'point_of_sale',
    permissions: [
      'customers.read',
      'customers.create',
      'sales.create',
      'sales.confirm',
      'products.read',
      'stock.read',
      'stock.direct_exit',
      'stock.allow_negative',
      'payments.receive',
      'documents.print',
      'documents.read',
    ],
    allowedCapabilities: [
      'Consultar e criar fichas de clientes',
      'Utilizar opção de Cliente Pontual em vendas balcão',
      'Emitir Facturas, Vendas a Dinheiro (VD) e Guias de Remessa',
      'Consultar catálogo de produtos e stock disponível em tempo real',
      'Registar guias de saída, incluindo saídas autorizadas com saldo negativo',
      'Registar recebimentos de clientes e emitir recibos autorizados',
      'Imprimir documentos de venda, guias e recibos',
    ],
    forbiddenCapabilities: [
      'Criar ou gerir utilizadores do sistema',
      'Registar facturas de fornecedor ou efectuar pagamentos a fornecedores',
      'Realizar Entradas Directas, ajustes ou transferências de stock',
      'Alterar custos de aquisição de produtos ou definições do sistema',
      'Cancelar documentos emitidos por outros operadores',
    ],
  },
  {
    id: 'bundle_purchases',
    code: 'COMPRAS_FORNECEDORES',
    name: 'Compras e Fornecedores',
    description: 'Registo de compras, gestão de fornecedores e consulta de contas correntes de fornecedor.',
    icon: 'shopping_cart',
    permissions: [
      'suppliers.read',
      'suppliers.create',
      'purchases.create',
      'purchases.confirm',
      'purchases.read',
      'products.read',
      'documents.print',
      'suppliers.ledger_read',
    ],
    allowedCapabilities: [
      'Consultar e criar fichas de fornecedores',
      'Registar e confirmar Facturas de Fornecedor',
      'Consultar histórico de compras e facturas de fornecedor',
      'Consultar catálogo de artigos e custos de aquisição',
      'Consultar extrato de conta corrente de fornecedores',
      'Imprimir documentos de compra',
    ],
    forbiddenCapabilities: [
      'Efectuar pagamentos ou liquidação financeira a fornecedores (atribuído ao Financeiro)',
      'Emitir documentos de venda a clientes',
      'Realizar acertos directos de stock fora das compras',
      'Gerir utilizadores ou alterar definições globais',
    ],
  },
  {
    id: 'bundle_finance',
    code: 'FINANCEIRO_TESOURARIA',
    name: 'Financeiro e Tesouraria',
    description: 'Gestão de contas correntes, recebimentos, pagamentos a fornecedores e tesouraria.',
    icon: 'account_balance_wallet',
    permissions: [
      'ledger.read',
      'payments.receive',
      'payments.pay',
      'invoices.read',
      'notes.read',
      'reports.read',
      'reports.financial',
      'documents.print',
      'documents.export',
      'customers.read',
      'suppliers.read',
    ],
    allowedCapabilities: [
      'Consultar contas correntes de clientes e fornecedores',
      'Registar recebimentos de clientes (parciais ou integrais)',
      'Registar pagamentos a fornecedores (parciais ou integrais)',
      'Consultar facturas em aberto e liquidações pendentes',
      'Consultar notas de crédito, débito e relatórios financeiros',
      'Imprimir e exportar extratos e documentos financeiros em CSV',
    ],
    forbiddenCapabilities: [
      'Alterar directamente quantidades ou existências em stock',
      'Realizar Entradas Directas ou Saídas Directas de material',
      'Criar ou editar utilizadores e permissões de acesso',
      'Alterar preços de venda no catálogo de produtos',
    ],
  },
  {
    id: 'bundle_warehouse',
    code: 'ARMAZEM_STOCK',
    name: 'Armazém e Stock',
    description: 'Gestão física do armazém, controlo de existências, acertos directos e inventários.',
    icon: 'inventory_2',
    permissions: [
      'products.read',
      'stock.read',
      'stock.direct_entry',
      'stock.direct_exit',
      'movements.read',
      'inventory.range_report',
      'inventory.total_report',
      'reports.print_stock',
      'documents.print',
    ],
    allowedCapabilities: [
      'Consultar artigos e existências físicas em armazém',
      'Realizar Entradas Directas de stock (recepção de material)',
      'Realizar Saídas Directas de stock (quebras, consumo interno)',
      'Consultar extrato de movimentos de stock por artigo ou data',
      'Gerar e emitir relatório de inventário por intervalo de códigos',
      'Gerar e emitir relatório de inventário total em stock',
      'Imprimir relatórios e etiquetas de stock',
    ],
    forbiddenCapabilities: [
      'Alterar preços de venda, custos financeiros ou margens de lucro',
      'Emitir facturas ou registar movimentos financeiros',
      'Registar pagamentos ou gerir contas correntes de clientes/fornecedores',
      'Gerir utilizadores ou alterar definições globais',
    ],
  },
  {
    id: 'bundle_audit',
    code: 'CONSULTA_AUDITORIA',
    name: 'Consulta e Auditoria',
    description: 'Acesso exclusivamente de leitura para auditoria operacional, relatórios e verificação.',
    icon: 'find_in_page',
    permissions: [
      'dashboard.read',
      'products.read',
      'documents.read',
      'movements.read',
      'inventory.read',
      'ledger.read',
      'reports.read',
      'documents.print',
      'documents.export',
      'customers.read',
      'suppliers.read',
    ],
    allowedCapabilities: [
      'Acesso exclusivamente de leitura ao Dashboard, Artigos e Existências',
      'Consultar histórico de documentos, extratos de stock e contas correntes',
      'Gerar e consultar relatórios operacionais e financeiros',
      'Imprimir e exportar listagens autorizadas para auditoria em CSV',
    ],
    forbiddenCapabilities: [
      'Criar, editar, cancelar ou eliminar qualquer registo no sistema',
      'Efectuar vendas, compras, recebimentos ou pagamentos',
      'Realizar acertos ou movimentações físicas de stock',
      'Alterar utilizadores, palavras-passes ou permissões de acesso',
    ],
  },
];

const BUNDLE_DATABASE_ROLES: Record<string, string[]> = {
  ADMIN: ['ADMINISTRATOR'],
  GESTOR_OPERACIONAL: ['MANAGER_LIMITED'],
  VENDAS_CAIXA: ['SALES_OP', 'CASHIER'],
  COMPRAS_FORNECEDORES: ['PURCHASING_OP'],
  FINANCEIRO_TESOURARIA: ['ACCOUNTING_OP'],
  ARMAZEM_STOCK: ['STOCK_OP'],
  CONSULTA_AUDITORIA: ['READ_ONLY'],
};

export function roleCodesForBundles(bundleCodes: string[]): string[] {
  return Array.from(new Set(bundleCodes.flatMap((code) => BUNDLE_DATABASE_ROLES[code] ?? [])));
}

export function bundleCodesFromRoleCodes(roleCodes: string[]): string[] {
  const assigned = new Set(roleCodes);
  return Object.entries(BUNDLE_DATABASE_ROLES)
    .filter(([, requiredRoles]) => requiredRoles.every((code) => assigned.has(code)))
    .map(([bundleCode]) => bundleCode);
}

export interface AdvancedOverridePermission {
  code: string;
  name: string;
  description: string;
}

export const ADVANCED_OVERRIDE_PERMISSIONS: AdvancedOverridePermission[] = [
  { code: 'documents.export', name: 'Permitir exportação CSV', description: 'Permite descarregar ficheiros CSV em tabelas e relatórios.' },
  { code: 'documents.print', name: 'Permitir impressão de documentos', description: 'Permite imprimir faturas, guias, recibos e relatórios.' },
  { code: 'products.view_costs', name: 'Permitir visualizar custos e margens', description: 'Permite ver os valores de custo de aquisição e margens de lucro dos produtos.' },
  { code: 'sales.allow_discounts', name: 'Permitir aplicar descontos em vendas', description: 'Permite inserir percentagens de desconto na criação de vendas.' },
  { code: 'documents.cancel', name: 'Permitir cancelar documentos', description: 'Permite cancelar faturas e documentos confirmados.' },
  { code: 'payments.approve', name: 'Permitir aprovar pagamentos', description: 'Permite aprovar e liquidar pagamentos financeiros.' },
  { code: 'entities.manage_customers', name: 'Permitir gerir clientes', description: 'Permite criar, editar e desativar fichas de clientes.' },
  { code: 'entities.manage_suppliers', name: 'Permitir gerir fornecedores', description: 'Permite criar, editar e desativar fichas de fornecedores.' },
];

export function getBundleByCode(code: string): ResponsibilityBundle | undefined {
  return RESPONSIBILITY_BUNDLES.find((b) => b.code.toUpperCase() === code.toUpperCase() || b.id === code);
}

export function calculateEffectivePermissions(
  selectedBundleCodes: string[],
  customAdditions: string[] = [],
  customRemovals: string[] = []
): string[] {
  const permSet = new Set<string>();

  for (const bCode of selectedBundleCodes) {
    const bundle = getBundleByCode(bCode);
    if (bundle) {
      for (const p of bundle.permissions) {
        permSet.add(p);
      }
    }
  }

  for (const addPerm of customAdditions) {
    permSet.add(addPerm);
  }

  for (const remPerm of customRemovals) {
    permSet.delete(remPerm);
  }

  return Array.from(permSet);
}

export function calculateBusinessCapabilities(
  selectedBundleCodes: string[],
  customAdditions: string[] = [],
  customRemovals: string[] = []
): { allowed: string[]; forbidden: string[] } {
  if (selectedBundleCodes.includes('ADMIN')) {
    return {
      allowed: [
        'Acesso total e irrestrito a todas as funcionalidades do sistema',
        'Criar e gerir utilizadores, atribuir pacotes de responsabilidades e alterar permissões',
        'Gestão completa de Produtos, Tabelas de Referência, Preços e Custos',
        'Emissão de Vendas, Compras, Stock, Recebimentos e Pagamentos a Fornecedores',
        'Acesso a todos os Relatórios, Contas Correntes, Impressões e Exportações CSV',
      ],
      forbidden: ['Nenhuma restrição (Administrador do Sistema tem acesso total)'],
    };
  }

  const allowedSet = new Set<string>();
  const forbiddenSet = new Set<string>();

  for (const bCode of selectedBundleCodes) {
    const bundle = getBundleByCode(bCode);
    if (bundle) {
      bundle.allowedCapabilities.forEach((cap) => allowedSet.add(cap));
      bundle.forbiddenCapabilities.forEach((cap) => forbiddenSet.add(cap));
    }
  }

  // Remove capabilities from forbidden if allowed set overrides it
  const finalForbidden = Array.from(forbiddenSet).filter((cap) => {
    if (allowedSet.has('Consultar e criar fichas de clientes') && cap.includes('clientes')) return false;
    if (allowedSet.has('Realizar Entradas Directas de stock (recepção de mercadoria)') && cap.includes('Entradas Directas')) return false;
    if (allowedSet.has('Realizar Saídas Directas de stock (ajustes, quebras)') && cap.includes('Saídas Directas')) return false;
    if (allowedSet.has('Registar recebimentos de clientes e emitir recibos autorizados') && cap.includes('recebimentos')) return false;
    if (allowedSet.has('Registar e confirmar Facturas de Fornecedor') && cap.includes('facturas de fornecedor')) return false;
    if (allowedSet.has('Registar pagamentos a fornecedores (parciais ou integrais)') && cap.includes('pagamentos a fornecedores')) return false;
    return true;
  });

  // Add custom addition notes if any
  for (const addCode of customAdditions) {
    const override = ADVANCED_OVERRIDE_PERMISSIONS.find((o) => o.code === addCode);
    if (override) {
      allowedSet.add(`Exceção Adicional: ${override.name} (${override.description})`);
    }
  }

  // Add custom removal notes if any
  for (const remCode of customRemovals) {
    const override = ADVANCED_OVERRIDE_PERMISSIONS.find((o) => o.code === remCode);
    if (override) {
      finalForbidden.push(`Exceção Removida: ${override.name}`);
    }
  }

  return {
    allowed: Array.from(allowedSet),
    forbidden: finalForbidden,
  };
}
