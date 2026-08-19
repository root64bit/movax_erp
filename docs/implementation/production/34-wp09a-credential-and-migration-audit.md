# Credential Rotation & Pre-Migration Audit — PROD-WP09A

> **Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  
> **Evaluation Date:** 2026-07-28  
> **System Mode:** `MIGRATION` (Confirmed Active)  

---

## 1. Password Rotation Verification Evidence

- **Exposed Password Test:** Authentication attempt using `postgres://postgres.bkbcgndzsfylwsinxwbb:casadepeneus@aws-0-eu-west-1.pooler.supabase.com:6543/postgres` returned `password authentication failed for user "postgres"` (**PASS** - Old password is invalid and non-functional).
- **Active Password Test:** Connection using `process.env.DATABASE_URL` authenticated successfully (**PASS**).
- **Git History & Tracked File Audit:** No connection strings or secrets exist in tracked files. `.env` is listed on line 7 of `.gitignore` and untracked.

---

## 2. Production Function Inventory (12 Private RPCs Deployed)

1. `private.next_payment_number(p_company_id, p_direction, p_fiscal_period_id, p_series)` -> returns `BIGINT`
2. `private.next_receipt_number(p_company_id, p_fiscal_period_id, p_series)` -> returns `BIGINT`
3. `private.refresh_customer_balance(p_customer_id)` -> returns `NUMERIC(18,2)`
4. `private.refresh_supplier_balance(p_supplier_id)` -> returns `NUMERIC(18,2)`
5. `private.refresh_document_payment_status(p_document_id)` -> returns `VOID`
6. `private.confirm_customer_payment(p_payment_id, p_idempotency_key, p_allocation_mode)` -> returns `public.payments`
7. `private.confirm_supplier_payment(p_payment_id, p_idempotency_key, p_allocation_mode)` -> returns `public.payments`
8. `private.allocate_payment(p_payment_id, p_document_id, p_amount, p_idempotency_key)` -> returns `UUID`
9. `private.auto_allocate_payment_oldest_first(p_payment_id, p_idempotency_key)` -> returns `NUMERIC(18,2)`
10. `private.reverse_payment(p_payment_id, p_reason, p_idempotency_key)` -> returns `UUID`
11. `private.issue_payment_receipt(p_payment_id)` -> returns `public.payment_receipts`
12. `private.reprint_payment_receipt(p_receipt_id, p_reason)` -> returns `public.payment_receipts`
