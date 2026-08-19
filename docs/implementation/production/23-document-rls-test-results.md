# Commercial Document RLS Test Results

> **Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  

---

## 1. RLS Policy Coverage

- **`public.document_types`**: RLS enabled. Read-only to authenticated users.
- **`public.documents`**: RLS enabled. Direct UPDATE restricted to status = `DRAFT`.
- **`public.document_lines`**: RLS enabled. Direct UPDATE restricted to status = `DRAFT`.
- **`public.document_transport_details`**: RLS enabled. Isolated by `company_id`.
- **`public.document_links`**: RLS enabled. Read-only to authenticated users.
- **`public.document_status_history`**: RLS enabled. Read-only to authenticated users. Normal clients cannot insert/update status history directly.
- **`public.ledger_entries`**: RLS enabled. Read-only to authenticated users. Confirmed entries are immutable; updates require RPC reversal.
