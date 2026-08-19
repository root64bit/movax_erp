# Document Financial Posting & Ledger Foundation

> **Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  

---

## 1. Ledger Entry Rules

- Customer documents post to `public.ledger_entries` with `party_type = 'CUSTOMER'`.
  - `CUSTOMER_INVOICE`, `CASH_SALE`, `CUSTOMER_DEBIT_NOTE`: Increases Debit.
  - `CUSTOMER_CREDIT_NOTE`: Increases Credit.
- Supplier documents post with `party_type = 'SUPPLIER'`.
  - `SUPPLIER_INVOICE`, `SUPPLIER_DEBIT_ADVICE`: Increases Credit (Payable).
  - `SUPPLIER_CREDIT_ADVICE`, `SUPPLIER_RETURN`: Increases Debit (Reduces Payable).
