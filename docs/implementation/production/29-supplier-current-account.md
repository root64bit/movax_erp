# Supplier Current Account Engine

> **Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  

---

## 1. Supplier Accounting Sign Convention

- **Supplier Invoices & Debit Advice:** Credit amount (increases payable balance).
- **Supplier Credit Advice & Payments:** Debit amount (reduces payable balance).
- **Source of Truth:** Derived dynamically from `public.ledger_entries` via `private.refresh_supplier_balance(supplier_id)`.
- **View:** `public.supplier_current_account_view`.
