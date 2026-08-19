# Risk Register & Risk Mitigation Matrix

> **Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  

---

## Key Technical & Operational Risks

| Risk ID | Risk Description | Category | Impact | Mitigation Strategy | Contingency Plan | Status |
|---------|------------------|----------|--------|---------------------|------------------|--------|
| **R-01** | Accidental modification of production objects | Security / Ops | CRITICAL | Use pre-live mode (`MIGRATION`), local migration dry runs (`supabase db push --dry-run`). Ban `db reset --linked`. | Immediate restore via pre-deployment backup (`06-restore-procedure.md`). | Active Control |
| **R-02** | Legacy XT-POS database encoding corruption | Migration | HIGH | Import into isolated `migration.*_raw` staging tables; run character conversion (CP1252 → UTF-8) before final insert. | Quarantine invalid rows in `migration_errors`. | Active Control |
| **R-03** | Stock balance variance during migration | Operations | HIGH | Domain-interleaved migration (PROD-WP06); reconcile total stock quantity & valuation against XT-POS. | Require manual sign-off on reconciliation report prior to WP finalization. | Active Control |
| **R-04** | RLS bypass or security misconfiguration | Security | CRITICAL | Implement RLS & grants in every migration file alongside table creation (PROD-WP03 to WP11). Continuous RLS automated test suite. | Immediate policy patch deployment via Supabase CLI. | Active Control |
| **R-05** | Unauthorized access during pre-live phase | Security | HIGH | Enforce system mode `MIGRATION` server-side. Restrict access to authenticated admins & migration RPCs. | Revoke user sessions & force mode `MAINTENANCE`. | Active Control |
