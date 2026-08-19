# Payment Security & Row Level Security (RLS)

> **Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  

---

## 1. RLS Policies

- **`public.payments`**: RLS enabled. Read access requires `company_id` match and `payments.view` permission. Direct UPDATE allowed only when status is `DRAFT`.
- **`public.payment_method_entries`**: RLS enabled. Isolated by `company_id`.
- **`public.payment_allocations`**: RLS enabled. Read-only to authenticated users. Modifications must occur via `private.allocate_payment(...)`.
- **`public.payment_receipts`**: RLS enabled. Read-only to authenticated users.
