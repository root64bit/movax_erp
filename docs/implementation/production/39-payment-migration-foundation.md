# Legacy Payment Migration Staging Foundation

> **Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  

---

## 1. Deployed Staging Tables in `migration` Schema

- `migration.payments_raw`
- `migration.payment_allocations_raw`
- `migration.current_accounts_raw`

## 2. Deployed Transformation & Reconciliation RPCs

- `migration.process_customer_payment_batch(batch_id)`
- `migration.process_supplier_payment_batch(batch_id)`
- `migration.process_payment_allocation_batch(batch_id)`
- `migration.reconcile_payment_batch(batch_id)`
- `migration.reconcile_current_accounts(batch_id)`
