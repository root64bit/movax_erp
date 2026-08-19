# Production Database Inventory — Target: bkbcgndzsfylwsinxwbb

> **Project Reference:** `bkbcgndzsfylwsinxwbb`  
> **Environment:** Production (Pre-Live Mode)  
> **Audit Timestamp:** 2026-07-28  

---

## 1. Schema Inventory

| Schema Name | Owner | Existing Tables | Object Count | Status / Notes |
|-------------|-------|-----------------|--------------|----------------|
| `public` | `postgres` | 0 | 0 | Clean. Ready for Casa de Pneus schema |
| `auth` | `supabase_admin` | Built-in | System | Standard Supabase Auth tables |
| `storage` | `supabase_admin` | Built-in | System | Standard Supabase Storage tables |
| `extensions` | `postgres` | Standard | System | Extensions schema |
| `migration` | N/A | 0 | 0 | To be created in PROD-WP02 |
| `private` | N/A | 0 | 0 | To be created in PROD-WP02 |
| `audit` | N/A | 0 | 0 | To be created in PROD-WP02 |

---

## 2. Table & View Summary (`public` Schema)

- Total custom tables: **0**
- Total views: **0**
- Total triggers: **0**
- Total custom functions: **0**

---

## 3. Storage Buckets Inventory

- Total custom storage buckets: **0**
- Planned buckets:
  - `document-pdfs` (private, signed URLs only)
  - `migration-raw-archives` (private, admin only)

---

## 4. Auth Users Inventory

- Total active auth users: **0**
- Pre-live admin provisioning will occur in Phase 4 (PROD-WP03).
