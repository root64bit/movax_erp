# Payment Reconciliation Framework

> **Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  

---

## 1. Reconciliation Invariants

- Total payment receipts = total ledger customer credits.
- Total supplier payments = total ledger supplier debits.
- Total active payment allocations = total document amount paid.
- Zero-variance policy enforced across payment totals, allocations, and party balances.
