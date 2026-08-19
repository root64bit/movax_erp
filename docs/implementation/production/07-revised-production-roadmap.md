# Revised Production Implementation Roadmap & Work Packages

> **Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  
> **Approach:** Production Pre-Live Mode with Domain-Interleaved Migration & Continuous RLS Testing  

---

## Revised Work Package Sequence

| WP # | Work Package Title | Key Deliverables & Production Scope | Mode |
|------|--------------------|--------------------------------------|------|
| **PROD-WP01** | **Production Baseline & Safety Foundation** | Inspect project `bkbcgndzsfylwsinxwbb`, verify clean database baseline, establish backup protocol, deploy migration evidence structure. | `MIGRATION` |
| **PROD-WP02** | **Core Schema & Company Configuration** | Create `public`, `private`, `migration`, `audit` schemas; deploy `companies`, `branches`, `warehouses`, `fiscal_periods`, `company_settings`. | `MIGRATION` |
| **PROD-WP03** | **Authentication, RBAC & RLS Foundation** | Implement Supabase Auth profile integration, 8 roles, ~70 permissions, RLS policies, helper functions (`get_user_company_id`, `has_permission`). | `MIGRATION` |
| **PROD-WP04** | **Articles & Reference Data** | Deploy product catalogue (`products`, `product_families`, `product_categories`, `brands`, `units_of_measure`, `tax_codes` Mozambique IVA 16%, `price_history`). | `MIGRATION` |
| **PROD-WP05** | **Stock Engine & Balance Posting** | Deploy inventory balances, stock movements, stock movement reasons, inventory counts, stock transfers, transactional posting RPCs. | `MIGRATION` |
| **PROD-WP06** | **Legacy Article & Opening Stock Migration** | Import legacy XT-POS articles and opening stock balances into `migration.products_raw` and `migration.stock_movements_raw`, transform, reconcile, and post. | `MIGRATION` |
| **PROD-WP07** | **Customers, Suppliers & Legacy Contact Migration** | Deploy customer and supplier entities, addresses, contacts, bank accounts; import legacy XT-POS customer and supplier data. | `MIGRATION` |
| **PROD-WP08** | **Commercial Documents (Sales & Purchases)** | Deploy document types, documents, document lines, document status history, document links, gap-free sequence generator (`document_sequences`). | `MIGRATION` |
| **PROD-WP09** | **Payments, Allocations & Current Accounts** | Deploy payment methods, payments, payment method entries, payment allocations, payment reversals, ledger accounts, ledger entries. | `MIGRATION` |
| **PROD-WP10** | **Historical Document & Payment Migration** | Import legacy XT-POS invoices, credit notes, receipts, and current account balances into `migration.*` staging, transform, reconcile. | `MIGRATION` |
| **PROD-WP11** | **Reports, Printing & Operational Monitoring** | Deploy report queries/views, daily cash report, stock valuation, margin analysis (with cost-price masking), PDF export, print logs. | `MIGRATION` |
| **PROD-WP12** | **Pilot Deployment & Acceptance Testing** | Transition system mode to `PILOT`. Onboard key Casa de Pneus staff, conduct pilot sales/inventory workflow testing, verify audit trail. | `PILOT` |
| **PROD-WP13** | **Final Delta Cutover & System Activation** | Freeze legacy XT-POS, perform final delta import, run complete reconciliation gate, switch system mode to `LIVE`. | `LIVE` |
