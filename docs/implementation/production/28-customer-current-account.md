# Customer Current Account Engine

> **Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  

---

## 1. Accounting Sign Convention & Source of Truth

- **Customer Invoices & Debit Notes:** Debit amount (increases customer balance).
- **Customer Credit Notes & Payments:** Credit amount (decreases customer balance).
- **Source of Truth:** Derived dynamically from `public.ledger_entries` via `private.refresh_customer_balance(customer_id)`.
- **View:** `public.customer_current_account_view`.
