# Payment Reconciliation Test Evidence

> **Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  

---

## 1. Reconciliation Invariants

```text
CUSTOMER_PAYMENTS_TOTAL: PASS (Variance: 0.00 MZN)
CURRENT_ACCOUNTS_BALANCE_TOTAL: PASS (Variance: 0.00 MZN)
```

- Customer current balance equals ledger-derived sum.
- Supplier current balance equals ledger-derived sum.
- Document amount paid equals total active allocations.
