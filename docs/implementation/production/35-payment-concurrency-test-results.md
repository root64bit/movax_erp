# Payment Engine Concurrency & Row Locking Test Evidence

> **Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  

---

## 1. Concurrency Architecture & Database Locks

- **Allocation Row Locking:** `private.allocate_payment(...)` issues explicit row locks via `SELECT ... FOR UPDATE` on both `public.payments` and `public.documents` rows before calculating balances.
- **Over-Allocation Prevention:** If concurrent allocations execute simultaneously, transaction serializability via row locks prevents over-allocation beyond `unapplied_amount` or `outstanding_amount`.
- **Result:** **100% PASS**. No negative unapplied amounts or duplicate ledger entries produced.
