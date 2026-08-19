# Payment Allocation Engine & Invariant Protections

> **Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  

---

## 1. Core Allocation Invariants

```text
1. Sum of active allocations for a payment <= confirmed payment total.
2. Sum of active allocations for a document <= document grand total.
3. Allocation amount > 0.
4. Payment unapplied amount = payment total - active allocated amount.
```

- **Atomic Guarding:** `private.allocate_payment(...)` locks both `payments` and `documents` rows via `FOR UPDATE` before evaluating balances.
- **Oldest-First Mode:** `private.confirm_customer_payment(..., 'OLDEST_FIRST')` automatically allocates against oldest due-date documents.
