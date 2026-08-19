# Production Schema Conflict Analysis — Target: bkbcgndzsfylwsinxwbb

> **Project Reference:** `bkbcgndzsfylwsinxwbb`  
> **Evaluation Date:** 2026-07-28  

---

## 1. Domain Object Conflict Analysis

| Proposed Entity / Function | Target Database State | Conflict Risk | Resolution |
|----------------------------|-----------------------|---------------|------------|
| `public.companies` | Non-existent | NONE | Direct creation |
| `public.branches` | Non-existent | NONE | Direct creation |
| `public.warehouses` | Non-existent | NONE | Direct creation |
| `public.user_profiles` | Non-existent | NONE | Direct creation (references `auth.users`) |
| `public.roles` | Non-existent | NONE | Direct creation |
| `public.permissions` | Non-existent | NONE | Direct creation |
| `public.products` | Non-existent | NONE | Direct creation |
| `public.stock_movements` | Non-existent | NONE | Direct creation |
| `public.documents` | Non-existent | NONE | Direct creation |
| `public.payments` | Non-existent | NONE | Direct creation |
| `migration.*` (all raw tables) | Non-existent schema | NONE | Create `migration` schema + raw tables |

---

## 2. Namespace & Function Safety

1. **System Functions:** All core transactional RPCs (`confirm_document`, `post_stock_movement`, `allocate_payment`) will be placed under explicit schema qualification (`public.*` or `private.*`) with strict `search_path = public, pg_temp`.
2. **Schema Isolation:** Staging tables for legacy XT-POS imports will reside in the `migration` schema, preventing any exposure to the REST API or PostgREST public auto-documentation.

---

## 3. Conflict Status: CLEARED

Because the production target `bkbcgndzsfylwsinxwbb` is a dedicated, unpopulated database, **zero schema conflicts exist**. Implementation can proceed deterministically.
