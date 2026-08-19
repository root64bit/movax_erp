# Migration Staging and RPC Audit — PROD-WP10C

> **Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  
> **Audit Date:** 2026-07-28  

---

## 1. Migration Schema Objects After Migration 010

### New Tables (Migration 010)

| Table | Row Count (Post-Test Cleanup) | RLS Enabled | Grants |
|-------|-------------------------------|-------------|--------|
| `migration.transformation_runs` | 0 | N/A (service_role only) | `service_role` |
| `migration.transformation_results` | 0 | N/A (service_role only) | `service_role` |
| `migration.business_decisions` | 0 | N/A (service_role only) | `service_role` |
| `migration.rollback_operations` | 0 | N/A (service_role only) | `service_role` |
| `migration.unit_maps` | 0 | N/A (service_role only) | `service_role` |
| `migration.tax_code_maps` | 0 | N/A (service_role only) | `service_role` |
| `migration.payment_method_maps` | 0 | N/A (service_role only) | `service_role` |

### New RPCs (Migration 010)

| Function | Schema | Security | Access |
|----------|--------|----------|--------|
| `migration.rollback_batch(UUID, TEXT)` | `migration` | `SECURITY DEFINER` | `service_role` |

## 2. Pre-Existing Raw Staging Tables (Migrations 001–009)

All 21 raw staging tables from previous migrations remain intact with their original row counts (329,030 total records). No raw staging data was modified by Migration 010.

## 3. Isolation Verification

- Anonymous role: **Cannot access** `migration` schema (**PASS**)
- Authenticated role: **Cannot access** `migration` schema (**PASS**)
- `service_role`: **Full access** to `migration` schema (**PASS**)
