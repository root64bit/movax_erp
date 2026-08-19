# Payments, Allocations and Current Accounts Schema Documentation

> **Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  

---

## 1. Primary Payment Tables Deployed

- **`public.payment_methods`**: 8 seeded methods (`CASH`, `BANK_TRANSFER`, `BANK_CARD`, `MPESA`, `EMOLA`, `MKESH`, `CHEQUE`, `OTHER`).
- **`public.payments`**: Payment header supporting `CUSTOMER_RECEIPT` and `SUPPLIER_PAYMENT`. Enforces party mutual exclusion and allocation sums.
- **`public.payment_method_entries`**: Split payment method details per payment.
- **`public.payment_allocations`**: Immutable allocation records linking payment to invoice document with atomic row-locking guards.
- **`public.payment_reversals`**: Complete payment reversal audit entries.
- **`public.payment_receipts`**: Customer receipt record with atomic sequence numbering `REC A/xxxxxx`.
- **`migration.payments_raw` & `migration.payment_allocations_raw`**: Legacy payment staging tables.
