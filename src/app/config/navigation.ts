export interface NavigationItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  permissions?: string[];
  addonCode?: string;
  badge?: string;
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'dashboard',
    path: '/dashboard',
    permissions: ['products.view', 'settings.manage'],
  },
  {
    id: 'pos',
    label: 'Ponto de Venda (POS)',
    icon: 'point_of_sale',
    path: '/pos',
    permissions: ['sales.create'],
  },
  {
    id: 'quotation',
    label: 'Cotações',
    icon: 'request_quote',
    path: '/quotations',
    permissions: ['sales.create', 'sales.read'],
  },
  {
    id: 'inventory',
    label: 'Inventário / Catálogo',
    icon: 'inventory_2',
    path: '/inventory',
    permissions: ['products.read', 'products.view', 'stock.read', 'stock.view'],
  },
  {
    id: 'movements',
    label: 'Movimentos & Transferências',
    icon: 'swap_horiz',
    path: '/movements',
    permissions: ['stock.read', 'stock.view', 'stock.direct_entry', 'stock.direct_exit'],
  },
  {
    id: 'purchases',
    label: 'Compras a Fornecedores',
    icon: 'shopping_bag',
    path: '/purchases',
    permissions: ['purchases.read', 'purchases.invoice.create'],
  },
  {
    id: 'documents',
    label: 'Documentos Emitidos',
    icon: 'receipt_long',
    path: '/documents',
    permissions: ['documents.view'],
  },
  {
    id: 'accounts',
    label: 'Contas & Caixa',
    icon: 'account_balance_wallet',
    path: '/accounts',
    permissions: ['payments.read', 'payments.view', 'accounts.read'],
  },
  {
    id: 'entities',
    label: 'Clientes & Fornecedores',
    icon: 'groups',
    path: '/entities',
    permissions: ['settings.manage', 'products.view', 'customers.manage'],
  },
  {
    id: 'reports',
    label: 'Relatórios Operacionais',
    icon: 'bar_chart',
    path: '/reports',
    permissions: ['reports.read', 'reports.sales', 'reports.stock'],
  },
  {
    id: 'administration',
    label: 'Administração & SaaS',
    icon: 'admin_panel_settings',
    path: '/administration',
    permissions: ['settings.manage', 'users.manage'],
  },
];
