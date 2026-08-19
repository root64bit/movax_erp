# PROD-WP11 Frontend and Operational Wiring

> Implementation date: 2026-07-28  
> Target project: `bkbcgndzsfylwsinxwbb`  
> Database status: migrations 012–015 deployed  
> System mode after deployment: `MIGRATION`

## Delivered

- Environment-only Supabase configuration and authenticated session gate.
- Permission-aware navigation and cost masking.
- Operational screens for dashboard, catalogue, stock, sales, purchases,
  parties, documents, payments/current accounts, reports, and administration.
- Browser-safe RPCs for products, customers, suppliers, stock movements,
  customer invoices/receipts, and supplier invoices/payments.
- Atomic document confirmation, stock posting, financial posting, payment
  confirmation, allocation, and idempotency.
- Customer invoice, supplier document, receipt/payment, report, and browser
  print workflows.
- Sales, stock, receivables, payables, and VAT reports with CSV export.
- Role mappings for ADMIN, MANAGER, STOCK_OP, SALES_OP, CASHIER,
  PURCHASING_OP, ACCOUNTING_OP, and READ_ONLY.
- Controlled synthetic-test guard. Normal browser sessions cannot bypass
  `MIGRATION`; synthetic operations require an authenticated migration
  administrator, a transaction-local flag, and full rollback.

## Production migrations

| Version | Purpose | Result |
|---|---|---|
| `20260728280000_012` | Core operational frontend RPCs | PASS |
| `20260728290000_013` | Master data and synthetic-test control | PASS |
| `20260728300000_014` | Supplier invoice/payment operations | PASS |
| `20260728310000_015` | Role matrix completion | PASS |

Every migration was applied from a verified logical backup while holding
`SYSTEM_MODE = MIGRATION`. Public execution was removed from protected RPCs.

## Verification

| Check | Result |
|---|---|
| TypeScript and production build | PASS |
| Authentication gate | PASS |
| Permission-aware screen navigation | PASS |
| Customer sale, stock-out, receipt and allocation | PASS |
| Supplier invoice, stock-in, payment and allocation | PASS |
| Report and print preview screens | PASS |
| Seven-role RBAC matrix plus ADMIN | PASS |
| Normal operations rejected in MIGRATION | PASS |
| Synthetic transaction fully rolled back | PASS |
| Test residue after rollback | 0 |
| Browser console errors in UI smoke test | 0 |

## Legacy boundary

No XT-POS history was imported, transformed, applied, or declared complete.
Empty legacy staging is expected and is not a WP11 blocker. Legacy work resumes
only after approved extraction files are supplied.
