# Production Security Gates & Continuous Access Control

> **Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  
> **Mandate:** Security & RLS Implemented Simultaneously with Every Table Creation  

---

## Security Invariants

1. **No RLS-Disabled Tables in `public`:** Every table created in the `public` schema MUST have Row Level Security enabled in the same migration file (`ALTER TABLE public.tablename ENABLE ROW LEVEL SECURITY;`).
2. **Explicit Grants Only:** Explicit `GRANT SELECT, INSERT, UPDATE ON public.tablename TO authenticated;` statements must be included. No `anon` writes are permitted under any circumstances.
3. **Company Isolation Policy:** Every multi-tenant business table must include:
   ```sql
   CREATE POLICY "company_isolation" ON public.tablename
     FOR ALL USING (company_id = public.get_user_company_id());
   ```
4. **Cost-Price Masking:** Product cost prices (`avg_cost`, `last_purchase_cost`) and profit margins (`profit_pct`) must be restricted to users possessing the `products.view_cost` permission.
5. **Secure RPCs:** All transactional functions must specify `SECURITY DEFINER` and `SET search_path = public, pg_temp;`. Public execution of sensitive RPCs must be revoked from `anon` and `authenticated`, granting execution only via server-checked authorization helpers.
