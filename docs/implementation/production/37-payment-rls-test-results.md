# Payment Row Level Security (RLS) Test Results

> **Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  

---

## 1. RLS Protections

- **`public.payments`**: RLS enabled. Read access scoped to company & branch. Direct updates restricted to `DRAFT`.
- **`public.payment_method_entries`**: RLS enabled. Scoped by `company_id`.
- **`public.payment_allocations`**: RLS enabled. Read-only to authenticated users. Modifications restricted to Security Definer RPCs.
- **`public.payment_receipts`**: RLS enabled. Direct insertion or mutation blocked for client connections.
