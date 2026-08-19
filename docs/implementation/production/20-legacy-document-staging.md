# Legacy Commercial Document Staging Architecture

> **Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  

---

## 1. Staging Tables (`migration` Schema)

- `migration.documents_raw`: Raw extract of historical sales and purchase document headers from XT-POS.
- `migration.document_lines_raw`: Raw extract of historical sales and purchase line items.

---

## 2. Validation & Processing Workflow

- Validation statuses: `PENDING`, `VALID`, `INVALID`, `ERROR`.
- Transformation statuses: `PENDING`, `TRANSFORMED`, `IMPORTED`, `SKIPPED`, `ERROR`.
- Full historical document data transformation and financial reconciliation will be executed in **WP10**.
