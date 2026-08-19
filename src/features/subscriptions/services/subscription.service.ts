import { requireSupabase } from '@/integrations/supabase/client';
import { numberValue } from '@/integrations/supabase/helpers';
import { logger } from '@/shared/lib/logger';
import { AppError } from '@/shared/utils/errorUtils';
import type {
  SubscriptionPlan,
  SubscriptionPlanCode,
  CompanySubscription,
  LicenseUsage,
  CompanyAddonItem,
  LicenseBillingInvoice,
  LicenseOverview,
} from '@/shared/types/domain.types';
import { DEFAULT_SUBSCRIPTION_PLANS } from '@/features/landing/services/onboarding.service';

export const AVAILABLE_ADDONS_CATALOG: Array<{
  code: string;
  name: string;
  description: string;
  priceMonthly: number;
  category: string;
}> = [
  {
    code: 'ADVANCED_STOCK',
    name: 'Stock Avançado & Múltiplos Armazéns',
    description: 'Transferências em trânsito com Guia, rastreio minucioso e inventários por armazém.',
    priceMonthly: 1500,
    category: 'Stock',
  },
  {
    code: 'PURCHASES',
    name: 'Compras & Fornecedores',
    description: 'Faturas de compras, cálculo automático de custos e contas correntes de fornecedores.',
    priceMonthly: 1500,
    category: 'Compras',
  },
  {
    code: 'FINANCIAL',
    name: 'Financeiro & Contas Correntes',
    description: 'Extratos de clientes, liquidações a prazo e recibos com alocação atómica.',
    priceMonthly: 2000,
    category: 'Financeiro',
  },
  {
    code: 'BI_PRO',
    name: 'Relatórios & BI Pro',
    description: 'Margens reais, curva ABC, rentabilidade e exportações analíticas.',
    priceMonthly: 1500,
    category: 'Relatórios',
  },
  {
    code: 'MULTI_BRANCH',
    name: 'Multi-Filial / Sucursais',
    description: 'Gestão de múltiplas lojas com consolidação centralizada.',
    priceMonthly: 1500,
    category: 'Gestão',
  },
  {
    code: 'SUPERMARKET_POS',
    name: 'Módulo Supermercado & Balanças',
    description: 'Frente de caixa rápida com leitura de códigos de barras de balança EAN-13.',
    priceMonthly: 1500,
    category: 'POS',
  },
  {
    code: 'BUTCHER_MODULE',
    name: 'Módulo Talho & Desmancho',
    description: 'Conversão de carcaças em cortes, rendimento, quebra e lotes.',
    priceMonthly: 1500,
    category: 'Produção',
  },
  {
    code: 'OFFLINE_SYNC',
    name: 'Offline-First & Sync Windows',
    description: 'Operação ininterrupta sem internet com sincronização automática.',
    priceMonthly: 1500,
    category: 'Sistema',
  },
  {
    code: 'SECURITY_PRO',
    name: 'Segurança & Auditoria Fina',
    description: 'Perfis avançados por função e logs detalhados de ações críticas.',
    priceMonthly: 1000,
    category: 'Segurança',
  },
];

export const SubscriptionService = {
  async fetchPlans(): Promise<SubscriptionPlan[]> {
    try {
      const client = requireSupabase();
      const { data, error } = await client
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true);
      if (!error && data && data.length > 0) {
        return (data as any[]).map((row) => {
          const defaultPlan = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.code === row.code);
          return {
            code: row.code as SubscriptionPlanCode,
            name: row.name,
            description: row.description || defaultPlan?.description || '',
            priceMonthly: defaultPlan?.priceMonthly ?? 0,
            priceAnnual: defaultPlan?.priceAnnual ?? 0,
            maxUsers: row.max_users,
            maxBranches: row.max_branches,
            maxWarehouses: row.max_warehouses,
            maxPosTerminals: row.max_pos_terminals,
            includedFeatures: row.included_features ?? [],
            popular: row.code === 'BUSINESS',
          };
        });
      }
    } catch {
      // Fallback
    }
    return DEFAULT_SUBSCRIPTION_PLANS;
  },

  async fetchLicenseOverview(): Promise<LicenseOverview> {
    try {
      const client = requireSupabase();
      const { data, error } = await client.rpc('get_company_license_overview_v1');
      if (!error && data) {
        const res = data as Record<string, any>;
        const planData = res.plan ?? {};
        const defaultPlan = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.code === planData.code) || DEFAULT_SUBSCRIPTION_PLANS[1];

        const plan: SubscriptionPlan = {
          code: (planData.code ?? 'BUSINESS') as SubscriptionPlanCode,
          name: planData.name ?? defaultPlan.name,
          description: planData.description ?? defaultPlan.description,
          priceMonthly: defaultPlan.priceMonthly,
          priceAnnual: defaultPlan.priceAnnual,
          maxUsers: planData.max_users ?? defaultPlan.maxUsers,
          maxBranches: planData.max_branches ?? defaultPlan.maxBranches,
          maxWarehouses: planData.max_warehouses ?? defaultPlan.maxWarehouses,
          maxPosTerminals: planData.max_pos_terminals ?? defaultPlan.maxPosTerminals,
          includedFeatures: planData.included_features ?? defaultPlan.includedFeatures,
          popular: planData.code === 'BUSINESS',
        };

        const subData = res.subscription ?? {};
        const subscription: CompanySubscription = {
          status: subData.status ?? 'ACTIVE',
          startsAt: subData.starts_at ?? new Date().toISOString(),
          expiresAt: subData.expires_at ?? undefined,
          daysRemaining: numberValue(subData.days_remaining ?? 30),
        };

        const usageData = res.usage ?? {};
        const usage: LicenseUsage = {
          usersCount: numberValue(usageData.users_count ?? 1),
          branchesCount: numberValue(usageData.branches_count ?? 1),
          warehousesCount: numberValue(usageData.warehouses_count ?? 1),
          posTerminalsCount: numberValue(usageData.pos_terminals_count ?? 1),
        };

        const addons: CompanyAddonItem[] = ((res.addons ?? []) as any[]).map((a) => {
          const cat = AVAILABLE_ADDONS_CATALOG.find((item) => item.code === a.addon_code);
          return {
            id: a.id,
            addonCode: a.addon_code,
            name: cat?.name ?? a.addon_code,
            description: cat?.description ?? '',
            priceMonthly: cat?.priceMonthly ?? 1500,
            isActive: Boolean(a.is_active),
            startsAt: a.starts_at,
            expiresAt: a.expires_at,
          };
        });

        const invoices: LicenseBillingInvoice[] = ((res.invoices ?? []) as any[]).map((inv) => ({
          id: inv.id,
          invoiceNumber: inv.invoice_number,
          periodStart: inv.period_start,
          periodEnd: inv.period_end,
          planCode: inv.plan_code,
          amountMzn: numberValue(inv.amount_mzn),
          paymentMethod: inv.payment_method ?? 'M_PESA',
          paymentReference: inv.payment_reference,
          status: inv.status ?? 'PAID',
          paidAt: inv.paid_at,
        }));

        return { plan, subscription, usage, addons, invoices };
      }
    } catch (err) {
      logger.warn('Could not load remote license overview, using defaults', { module: 'SubscriptionService', error: err });
    }

    return {
      plan: DEFAULT_SUBSCRIPTION_PLANS[1],
      subscription: {
        status: 'ACTIVE',
        startsAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        daysRemaining: 30,
      },
      usage: {
        usersCount: 1,
        branchesCount: 1,
        warehousesCount: 1,
        posTerminalsCount: 1,
      },
      addons: [],
      invoices: [],
    };
  },

  async upgradePlan(
    planCode: string,
    cycle: 'MONTHLY' | 'ANNUAL' = 'MONTHLY',
    paymentMethod: string = 'M_PESA',
    paymentReference?: string,
  ): Promise<{ success: boolean; invoiceNumber?: string }> {
    const client = requireSupabase();
    const { data, error } = await client.rpc('upgrade_subscription_plan_v1', {
      p_plan_code: planCode,
      p_cycle: cycle,
      p_payment_method: paymentMethod,
      p_payment_reference: paymentReference || null,
    });
    if (error) throw new AppError(error.message || 'Falha ao atualizar o plano de subscrição.');
    return data;
  },

  async toggleAddon(addonCode: string, active: boolean): Promise<void> {
    const client = requireSupabase();
    const { error } = await client.rpc('toggle_company_addon_v1', {
      p_addon_code: addonCode,
      p_active: active,
    });
    if (error) throw new AppError(error.message || 'Falha ao alterar estado do add-on.');
  },
};
