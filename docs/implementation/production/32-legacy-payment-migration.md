# Legacy Payment Migration Staging Foundation

> **Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  

---

## 1. Staging Schema Objects

- **`migration.payments_raw`**: Raw staging table for historical legacy customer receipts and supplier payments.
- **`migration.payment_allocations_raw`**: Raw staging table for historical payment allocations.
- **Validation Engine:** Raw payload SHA-256 hash tracking prevents duplicate batch imports.
