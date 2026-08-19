# Payment Reversal & Idempotency Engine

> **Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  

---

## 1. Reversal & Idempotency Rules

- **Idempotency:** Payment confirmation RPC accepts `p_idempotency_key`. Retrying with the same key returns the existing confirmed payment without double sequence generation or double ledger posting.
- **Reversal:** `private.reverse_payment(...)` marks payment header as `REVERSED`, reverses associated active allocations, restores document outstanding balances, updates ledger status to `REVERSED`, and recalculates customer/supplier balances.
- **Double Reversal Guard:** Re-invoking reversal on an already reversed payment raises `ALREADY_REVERSED` exception.
