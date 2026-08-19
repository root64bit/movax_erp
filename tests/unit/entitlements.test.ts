import { describe, it, expect } from 'vitest';
import { canCreateResource, hasPlanFeature } from '../../src/features/subscriptions/utils/entitlements';

describe('SaaS Entitlements & Plan Limits', () => {
  it('enforces Starter plan resource boundaries', () => {
    // Starter: max 3 users, 1 branch, 1 warehouse, 1 POS
    expect(canCreateResource('STARTER', 'users', 2).allowed).toBe(true);
    expect(canCreateResource('STARTER', 'users', 3).allowed).toBe(false);

    expect(canCreateResource('STARTER', 'branches', 1).allowed).toBe(false);
    expect(canCreateResource('STARTER', 'warehouses', 1).allowed).toBe(false);
  });

  it('enforces Business plan multi-warehouse boundaries', () => {
    // Business: max 7 users, 2 warehouses
    expect(canCreateResource('BUSINESS', 'warehouses', 1).allowed).toBe(true);
    expect(canCreateResource('BUSINESS', 'warehouses', 2).allowed).toBe(false);
  });

  it('respects company subscription override limits', () => {
    const override = { max_users_override: 10 };
    expect(canCreateResource('STARTER', 'users', 5, override).allowed).toBe(true);
    expect(canCreateResource('STARTER', 'users', 10, override).allowed).toBe(false);
  });

  it('verifies included features and add-ons', () => {
    expect(hasPlanFeature('STARTER', 'pos')).toBe(true);
    expect(hasPlanFeature('STARTER', 'reports')).toBe(false);
    expect(hasPlanFeature('PRO', 'reports')).toBe(true);
    // Addon activation
    expect(hasPlanFeature('STARTER', 'business_api', ['business_api'])).toBe(true);
  });
});
