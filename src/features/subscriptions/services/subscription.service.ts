import { requireSupabase } from '@/integrations/supabase/client';
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
    code: 'BUSINESS_API',
    name: 'Módulo Business API (Enterprise)',
    description: 'Chaves de API REST, Webhooks e sincronização com e-commerce e ERPs externos.',
    priceMonthly: 2500,
    category: 'Integração',
  },
  {
    code: 'BACKUP_TRANSITION',
    name: 'Backup Cloud Contínuo & Transição de Dados',
    description: 'Cópias de segurança automáticas em nuvem isolada e assistente de importação de dados.',
    priceMonthly: 1500,
    category: 'Sistema',
  },
  {
    code: 'STOCK_VALUATION_PRO',
    name: 'Rastreabilidade Lotes, Validade & Séries (FIFO/LIFO)',
    description: 'Controlo de lotes com validade, números de série e métodos de valorização FIFO/LIFO.',
    priceMonthly: 1500,
    category: 'Stock',
  },
  {
    code: 'BANK_RECONCILIATION',
    name: 'Baixa de Banco & Reconciliação Bancária',
    description: 'Extratos de contas bancárias (BIM, BCI, Standard Bank) com baixa automática de faturas.',
    priceMonthly: 1500,
    category: 'Financeiro',
  },
  {
    code: 'ADVANCED_STOCK',
    name: 'Stock Avançado & Múltiplos Armazéns',
    description: 'Transferências em trânsito com Guia, rastreio minucioso e inventários por armazém.',
    priceMonthly: 1500,
    category: 'Stock',
  },
  {
    code: 'PURCHASES',
    name: 'Compras & Fornecedores Multimoeda',
    description: 'Faturas de compras com câmbio manual e contas correntes de fornecedores.',
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
    description: 'Margens reais, curva ABC, rentabilidade e exportações analíticas em Excel/Word/PDF.',
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
            description: row.description,
            priceMonthly: Number(row.price_monthly),
            priceAnnual: Number(row.price_annual),
            maxUsers: row.max_users,
            maxBranches: row.max_branches,
            maxWarehouses: row.max_warehouses,
            maxPosTerminals: row.max_pos_terminals,
            includedFeatures: row.included_features || defaultPlan?.includedFeatures || [],
            popular: row.code === 'BUSINESS',
          };
        });
      }
      return DEFAULT_SUBSCRIPTION_PLANS;
    } catch {
      return DEFAULT_SUBSCRIPTION_PLANS;
    }
  },

  async fetchActiveSubscription(companyId?: string): Promise<CompanySubscription | null> {
    try {
      const client = requireSupabase();
      let query = client.from('company_subscriptions').select('*').eq('status', 'ACTIVE');
      if (companyId) {
        query = query.eq('company_id', companyId);
      }
      const { data, error } = await query.maybeSingle();

      if (error || !data) {
        return {
          status: 'ACTIVE',
          startsAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
          daysRemaining: 30,
          currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
        };
      }

      const expires = data.current_period_end || data.trial_ends_at;
      const daysRemaining = expires
        ? Math.max(0, Math.ceil((new Date(expires).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 30;

      return {
        status: data.status,
        startsAt: data.current_period_start || new Date().toISOString(),
        expiresAt: expires,
        daysRemaining,
        currentPeriodEnd: data.current_period_end,
      };
    } catch (err: any) {
      logger.error('Failed to fetch active subscription', err, { module: 'SubscriptionService' });
      return {
        status: 'ACTIVE',
        startsAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        daysRemaining: 30,
      };
    }
  },

  async fetchLicenseOverview(companyId?: string): Promise<LicenseOverview> {
    try {
      const client = requireSupabase();

      const [subRes, plansRes, usersCount, branchesCount, whCount, posCount, addonsRes, invoicesRes] =
        await Promise.all([
          client.from('company_subscriptions').select('*').limit(1).maybeSingle(),
          client.from('subscription_plans').select('*'),
          client.from('user_profiles').select('id', { count: 'exact', head: true }),
          client.from('branches').select('id', { count: 'exact', head: true }),
          client.from('warehouses').select('id', { count: 'exact', head: true }),
          client.from('pos_terminals').select('id', { count: 'exact', head: true }),
          client.from('company_addons').select('*').eq('status', 'ACTIVE'),
          client.from('license_billing_invoices').select('*').order('created_at', { ascending: false }).limit(10),
        ]);

      const subData = subRes.data;
      const planCode = (subData?.plan_code as SubscriptionPlanCode) || 'BUSINESS';
      const plans = (plansRes.data || []) as any[];
      const currentPlanRow =
        plans.find((p) => p.code === planCode) ||
        DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.code === planCode) ||
        DEFAULT_SUBSCRIPTION_PLANS[1];

      const plan: SubscriptionPlan = {
        code: planCode,
        name: currentPlanRow.name,
        description: currentPlanRow.description,
        priceMonthly: Number(currentPlanRow.price_monthly ?? currentPlanRow.priceMonthly ?? 8900),
        priceAnnual: Number(currentPlanRow.price_annual ?? currentPlanRow.priceAnnual ?? 90780),
        maxUsers: currentPlanRow.max_users ?? currentPlanRow.maxUsers ?? 7,
        maxBranches: currentPlanRow.max_branches ?? currentPlanRow.maxBranches ?? 1,
        maxWarehouses: currentPlanRow.max_warehouses ?? currentPlanRow.maxWarehouses ?? 2,
        maxPosTerminals: currentPlanRow.max_pos_terminals ?? currentPlanRow.maxPosTerminals ?? 2,
        includedFeatures: currentPlanRow.included_features || currentPlanRow.includedFeatures || [],
        popular: planCode === 'BUSINESS',
      };

      const expires = subData?.current_period_end || subData?.trial_ends_at;
      const daysRemaining = expires
        ? Math.max(0, Math.ceil((new Date(expires).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 30;

      const subscription: CompanySubscription = {
        status: (subData?.status as any) || 'ACTIVE',
        startsAt: subData?.current_period_start || new Date().toISOString(),
        expiresAt: expires,
        daysRemaining,
        currentPeriodEnd: subData?.current_period_end,
      };

      const usage: LicenseUsage = {
        usersCount: usersCount.count || 1,
        branchesCount: branchesCount.count || 1,
        warehousesCount: whCount.count || 1,
        posTerminalsCount: posCount.count || 1,
      };

      const addons: CompanyAddonItem[] = (addonsRes.data || []).map((row: any) => ({
        id: row.id,
        addonCode: row.addon_code,
        name: AVAILABLE_ADDONS_CATALOG.find((a) => a.code === row.addon_code)?.name || row.addon_code,
        description: AVAILABLE_ADDONS_CATALOG.find((a) => a.code === row.addon_code)?.description,
        priceMonthly: Number(row.price_monthly || 0),
        isActive: row.status === 'ACTIVE',
        startsAt: row.starts_at,
        expiresAt: row.expires_at,
      }));

      const invoices: LicenseBillingInvoice[] = (invoicesRes.data || []).map((row: any) => ({
        id: row.id,
        invoiceNumber: row.invoice_number || `INV-${row.id.slice(0, 8)}`,
        periodStart: row.period_start || new Date().toISOString().slice(0, 10),
        periodEnd: row.period_end || new Date().toISOString().slice(0, 10),
        planCode: row.plan_code || planCode,
        amountMzn: Number(row.total_amount || row.amount_mzn || 0),
        paymentMethod: row.payment_method || 'M_PESA',
        paymentReference: row.payment_reference,
        status: (row.status as any) || 'PAID',
        paidAt: row.paid_at,
      }));

      return {
        plan,
        subscription,
        usage,
        addons,
        invoices,
      };
    } catch (err: any) {
      logger.error('Failed to load license overview', err, { module: 'SubscriptionService' });
      return {
        plan: DEFAULT_SUBSCRIPTION_PLANS[1],
        subscription: {
          status: 'ACTIVE',
          startsAt: new Date().toISOString(),
          daysRemaining: 30,
        },
        usage: {
          usersCount: 2,
          branchesCount: 1,
          warehousesCount: 1,
          posTerminalsCount: 1,
        },
        addons: [],
        invoices: [],
      };
    }
  },

  async toggleAddon(addonCode: string, activate: boolean): Promise<void> {
    try {
      const client = requireSupabase();
      const catalogItem = AVAILABLE_ADDONS_CATALOG.find((a) => a.code === addonCode);
      if (activate) {
        await client.from('company_addons').upsert(
          {
            addon_code: addonCode,
            status: 'ACTIVE',
            price_monthly: catalogItem?.priceMonthly || 1500,
            quantity: 1,
          },
          { onConflict: 'company_id,addon_code' },
        );
      } else {
        await client.from('company_addons').delete().eq('addon_code', addonCode);
      }
    } catch (err: any) {
      logger.error('Failed to toggle addon in Supabase', err, { module: 'SubscriptionService', addonCode });
    }
  },

  async upgradePlan(
    newPlanCode: SubscriptionPlanCode,
    billingCycle: 'MONTHLY' | 'ANNUAL',
    paymentMethod?: string,
    reference?: string,
  ): Promise<void> {
    try {
      const client = requireSupabase();
      const targetPlan = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.code === newPlanCode);
      const amount = billingCycle === 'ANNUAL' ? targetPlan?.priceAnnual || 0 : targetPlan?.priceMonthly || 0;

      await client.from('company_subscriptions').upsert(
        {
          plan_code: newPlanCode,
          billing_cycle: billingCycle,
          status: 'ACTIVE',
          monthly_amount: targetPlan?.priceMonthly,
          annual_amount: targetPlan?.priceAnnual,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + (billingCycle === 'ANNUAL' ? 365 : 30) * 86400000).toISOString(),
        },
        { onConflict: 'company_id' },
      );

      // Create billing invoice record
      await client.from('license_billing_invoices').insert({
        invoice_number: `INV-${Date.now().toString().slice(-6)}`,
        period_start: new Date().toISOString().slice(0, 10),
        period_end: new Date(Date.now() + (billingCycle === 'ANNUAL' ? 365 : 30) * 86400000).toISOString().slice(0, 10),
        plan_code: newPlanCode,
        total_amount: amount,
        payment_method: paymentMethod || 'M_PESA',
        payment_reference: reference || 'PAGAMENTO-UPGRADE',
        status: 'PAID',
        paid_at: new Date().toISOString(),
      });
    } catch (err: any) {
      logger.error('Failed to upgrade plan in Supabase', err, { module: 'SubscriptionService', newPlanCode });
      throw new AppError(err.message || 'Falha ao atualizar plano.');
    }
  },
};
