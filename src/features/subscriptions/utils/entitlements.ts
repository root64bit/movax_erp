import type { SubscriptionPlanCode } from '@/shared/types/domain.types';

export interface PlanLimits {
  maxUsers: number;
  maxBranches: number;
  maxWarehouses: number;
  maxPosTerminals: number;
  includedFeatures: string[];
}

export const PLAN_LIMITS: Record<SubscriptionPlanCode, PlanLimits> = {
  STARTER: {
    maxUsers: 3,
    maxBranches: 1,
    maxWarehouses: 1,
    maxPosTerminals: 1,
    includedFeatures: ['pos', 'sales', 'inventory', 'documents'],
  },
  BUSINESS: {
    maxUsers: 7,
    maxBranches: 1,
    maxWarehouses: 2,
    maxPosTerminals: 2,
    includedFeatures: ['pos', 'sales', 'inventory', 'documents', 'purchases', 'transfers', 'accounts'],
  },
  PRO: {
    maxUsers: 15,
    maxBranches: 2,
    maxWarehouses: 5,
    maxPosTerminals: 5,
    includedFeatures: ['pos', 'sales', 'inventory', 'documents', 'purchases', 'transfers', 'accounts', 'reports', 'quotations'],
  },
  ENTERPRISE: {
    maxUsers: 999999,
    maxBranches: 999999,
    maxWarehouses: 999999,
    maxPosTerminals: 999999,
    includedFeatures: ['pos', 'sales', 'inventory', 'documents', 'purchases', 'transfers', 'accounts', 'reports', 'quotations', 'business_api', 'audit'],
  },
};

export function canCreateResource(
  planCode: SubscriptionPlanCode,
  resourceType: 'users' | 'branches' | 'warehouses' | 'posTerminals',
  currentCount: number,
  overrides?: Partial<Record<string, number>>
): { allowed: boolean; limit: number; current: number } {
  const plan = PLAN_LIMITS[planCode] || PLAN_LIMITS.STARTER;
  let limit = plan.maxUsers;
  if (resourceType === 'branches') limit = plan.maxBranches;
  if (resourceType === 'warehouses') limit = plan.maxWarehouses;
  if (resourceType === 'posTerminals') limit = plan.maxPosTerminals;

  if (overrides && overrides[`max_${resourceType}_override`]) {
    limit = overrides[`max_${resourceType}_override`]!;
  }

  return {
    allowed: currentCount < limit,
    limit,
    current: currentCount,
  };
}

export function hasPlanFeature(
  planCode: SubscriptionPlanCode,
  feature: string,
  activeAddons: string[] = []
): boolean {
  const plan = PLAN_LIMITS[planCode] || PLAN_LIMITS.STARTER;
  if (plan.includedFeatures.includes(feature)) return true;
  return activeAddons.includes(feature);
}
