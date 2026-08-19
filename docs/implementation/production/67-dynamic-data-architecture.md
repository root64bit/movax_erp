# Dynamic data architecture

`src/lib/appData.ts` is the typed data boundary. Reads use RLS-scoped tables plus `get_current_user_context`, `get_dashboard_metrics`, and `get_operational_report`. Critical writes use security-definer RPCs with permission, company, branch/warehouse, mode, validation, audit, and idempotency enforcement. The service/secret key is never bundled into the browser.
