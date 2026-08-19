import { describe, it, expect } from 'vitest';
import {
  RESPONSIBILITY_BUNDLES,
  getBundleByCode,
  calculateEffectivePermissions,
  calculateBusinessCapabilities,
} from '../../src/lib/responsibilityBundles';

describe('User Administration & RBAC Responsibility Bundles', () => {
  it('loads core responsibility bundles correctly', () => {
    expect(RESPONSIBILITY_BUNDLES.length).toBeGreaterThan(0);
    const adminBundle = getBundleByCode('ADMIN');
    expect(adminBundle).toBeDefined();
    expect(adminBundle?.permissions).toContain('admin.users');
    expect(adminBundle?.permissions).toContain('sales.create');
  });

  it('calculates full effective permissions for Administrator role', () => {
    const effective = calculateEffectivePermissions(['ADMIN'], []);
    expect(effective).toContain('admin.users');
    expect(effective).toContain('sales.create');
    expect(effective).toContain('stock.direct_entry');
    expect(effective).toContain('reports.financial');
  });

  it('calculates restricted permissions for Operational Manager (cannot manage users or sales)', () => {
    const effective = calculateEffectivePermissions(['GESTOR_OPERACIONAL'], []);
    expect(effective).toContain('products.read');
    expect(effective).toContain('stock.direct_entry');
    expect(effective).not.toContain('admin.users');
    expect(effective).not.toContain('sales.create');
  });

  it('combines permissions when multiple bundles are selected', () => {
    const effective = calculateEffectivePermissions(['VENDAS_CAIXA', 'ARMAZEM_STOCK'], []);
    // From VENDAS_CAIXA
    expect(effective).toContain('sales.create');
    // From ARMAZEM_STOCK
    expect(effective).toContain('stock.direct_entry');
    expect(effective).toContain('inventory.range_report');
  });

  it('supports custom permission overrides (additions and removals)', () => {
    const baseEffective = calculateEffectivePermissions(['VENDAS_CAIXA'], []);
    expect(baseEffective).not.toContain('reports.financial');

    // Add custom addition
    const withAddition = calculateEffectivePermissions(['VENDAS_CAIXA'], ['reports.financial']);
    expect(withAddition).toContain('reports.financial');
  });

  it('generates accurate business capability list for UI transparency', () => {
    const capabilities = calculateBusinessCapabilities(['ADMIN']);
    expect(capabilities.allowed.length).toBeGreaterThan(0);
    expect(capabilities.forbidden[0]).toContain('Nenhuma restrição');
  });
});
