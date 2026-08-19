import { requireSupabase } from '@/integrations/supabase/client';
import { logger } from '@/shared/lib/logger';
import { ValidationError, AppError } from '@/shared/utils/errorUtils';
import type { TenantOnboardingInput, SubscriptionPlan, SubscriptionPlanCode } from '@/shared/types/domain.types';

export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    code: 'STARTER',
    name: 'STARTER',
    description: 'Para pequenos negócios em crescimento e prestadores de serviços.',
    priceMonthly: 4500,
    priceAnnual: 45900,
    maxUsers: 3,
    maxBranches: 1,
    maxWarehouses: 1,
    maxPosTerminals: 1,
    includedFeatures: ['CORE'],
  },
  {
    code: 'BUSINESS',
    name: 'BUSINESS',
    description: 'O equilíbrio perfeito para operações consolidadas e comércio a retalho.',
    priceMonthly: 8900,
    priceAnnual: 90780,
    maxUsers: 7,
    maxBranches: 1,
    maxWarehouses: 2,
    maxPosTerminals: 2,
    includedFeatures: ['CORE', 'ADVANCED_STOCK', 'PURCHASES', 'FINANCIAL'],
    popular: true,
  },
  {
    code: 'PRO',
    name: 'PRO',
    description: 'Para empresas em expansão com necessidades analíticas e multi-filial.',
    priceMonthly: 13900,
    priceAnnual: 141780,
    maxUsers: 15,
    maxBranches: 2,
    maxWarehouses: 6,
    maxPosTerminals: 6,
    includedFeatures: ['CORE', 'ADVANCED_STOCK', 'PURCHASES', 'FINANCIAL', 'BI_PRO', 'MULTI_BRANCH', 'SECURITY_PRO'],
  },
  {
    code: 'ENTERPRISE',
    name: 'ENTERPRISE',
    description: 'Redes de lojas, grandes distribuidores, talhos industriais e supermercados.',
    priceMonthly: 0,
    priceAnnual: 0,
    maxUsers: null,
    maxBranches: null,
    maxWarehouses: null,
    maxPosTerminals: null,
    includedFeatures: [
      'CORE', 'ADVANCED_STOCK', 'PURCHASES', 'FINANCIAL', 'BI_PRO',
      'MULTI_BRANCH', 'SECURITY_PRO', 'SUPERMARKET_POS', 'BUTCHER_MODULE',
      'OFFLINE_SYNC', 'LOCAL_PAYMENTS',
    ],
  },
];

export const OnboardingService = {
  async provisionTenant(input: TenantOnboardingInput): Promise<{ success: boolean; message: string }> {
    if (!input.companyName.trim()) throw new ValidationError('O nome da empresa é obrigatório.');
    if (!input.taxNumber.trim()) throw new ValidationError('O NUIT da empresa é obrigatório.');
    if (!input.adminEmail.trim()) throw new ValidationError('O email do administrador é obrigatório.');
    if (input.adminPassword.length < 8) throw new ValidationError('A palavra-passe deve ter pelo menos 8 caracteres.');

    logger.info('Starting tenant registration', {
      module: 'OnboardingService',
      company: input.companyName,
      nuit: input.taxNumber,
      plan: input.planCode,
    });

    try {
      const client = requireSupabase();
      const { error: authError } = await client.auth.signUp({
        email: input.adminEmail.trim(),
        password: input.adminPassword,
        options: {
          data: {
            full_name: input.adminFullName.trim(),
            phone: input.adminPhone?.trim() || null,
            company_name: input.companyName.trim(),
            nuit: input.taxNumber.trim(),
            city: input.city.trim(),
            plan_code: input.planCode,
            billing_cycle: input.billingCycle,
          },
        },
      });

      if (authError) throw authError;

      return {
        success: true,
        message: 'Registo concluído com sucesso! Pode agora iniciar sessão com a sua nova conta.',
      };
    } catch (err: any) {
      logger.error('Failed to provision tenant', err, { module: 'OnboardingService' });
      throw new AppError(err.message || 'Não foi possível concluir o registo.');
    }
  },
};
