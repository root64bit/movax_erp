# 19 Audit and Security Plan

## Overview
Casa de Pneus operates in an environment where financial tracking, stock integrity, and system auditability are critical to minimizing fraud and errors. This document covers the audit trail strategy and comprehensive security controls.

## Audit Event Categories
Every significant action is recorded in the `audit_logs` table.
- **Authentication**: Login success, login failed, password reset, session revoke.
- **Master Data**: Article creation/update, Customer/Supplier creation/update, price changes.
- **Stock**: Manual adjustments, negative stock warnings overridden, entry/exit confirmations, transfers.
- **Sales/Financial**: Sales creation, selling below cost overrides, document cancellations, payment allocations, credit limit overrides.
- **Admin**: Role changes, user creation, configuration modification, backup triggers, migration imports.

## Audit Record Structure
```sql
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    user_id UUID NOT NULL,          -- Who performed the action
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    action_type VARCHAR NOT NULL,   -- e.g., 'SALE_CONFIRM', 'PRODUCT_PRICE_CHANGE'
    entity_name VARCHAR NOT NULL,   -- e.g., 'products', 'sales_documents'
    entity_id UUID NOT NULL,
    old_data JSONB,                 -- Snapshot before change
    new_data JSONB,                 -- Snapshot after change
    ip_address INET,
    session_id UUID,
    reason TEXT,                    -- Required for overrides (e.g. manual adjustments)
    correlation_id UUID             -- Groups related actions (e.g. sale + stock exit + ledger entry)
);
```

## Audit Log Protection
- **Append-Only**: The `audit_logs` table lacks `UPDATE` and `DELETE` grants for application users and even standard DB administrators.
- **Trigger-Based Generation**: For high-risk tables, PostgreSQL triggers automatically insert into `audit_logs` rather than trusting the client API to log the action.

## Threat Model (Tire Shop Operations)

| Asset | Threat | Attack Path | Impact | Mitigation | Detection | Recovery |
|---|---|---|---|---|---|---|
| Stock (Tires) | Manipulation/Theft | Operator marks good tires as damaged/lost | High (Financial loss) | Require manager approval for adjustments. Restrict `stock.adjust`. | Anomaly reports on adjustments. | Revert adjustment via manager action. |
| Payments | Fraud/Embezzlement | Cashier receives payment, deletes receipt | High (Financial loss) | Receipts are immutable once printed. Reversals require `payments.reverse` and log heavily. | Cash drawer mismatch at end of day. | Audit log identifies the deleted/reversed transaction. |
| Prices | Price Manipulation | Salesperson changes price in DB to sell cheap to friend | High (Margin loss) | RLS restricts direct writes. POS uses server-calculated pricing. | Price override audit logs. | Invoice cancellation and re-issuance. |
| User Accounts | Privilege Escalation | User changes own role to Admin via API | Critical (System takeover) | Role tables are read-only to all except restricted RPCs checking Admin role. | Audit log on `ROLE_CHANGE`. | Admin resets user role. |
| Data | Exfiltration | Competitor accesses customer/supplier list | High (Business risk) | Pagination limits, rate limiting on reports, restrictive RLS. | Unusual spike in report generation. | Terminate session, investigate. |
| Web App | XSS / CSRF | Malicious payload in product description | Medium | React auto-escaping, Zod input validation, SameSite cookies. | WAF / Error logs. | Fix payload, invalidate sessions. |
| Database | SQL Injection | Malicious search query | Critical | Use parameterized queries (Supabase SDK does this automatically by default). | WAF / Postgres error logs. | Database restore from backup if data altered. |

## Security Controls
- **Input Validation**: Strict validation using Zod schemas before any data hits the database API.
- **SQL Injection**: Prevented by Supabase's underlying PostgREST translating HTTP into parameterized queries.
- **XSS & CSRF**: React framework prevents DOM-based XSS. Supabase Auth handles CSRF tokens/cookies properly.
- **Secrets Management**: Third-party keys (e.g., SMTP, external APIs) are stored in Supabase Vault and accessed only via Edge Functions.
- **Least Privilege**: Users are given the minimum permissions needed for their daily tasks.
- **Private File Storage**: Any document attachments (e.g. signed delivery notes) are stored in Supabase Storage buckets configured as private, requiring signed URLs for access.
- **Backup Encryption**: Database backups managed by Supabase are encrypted at rest.

## Fraud Risk Analysis (Tire Shop Specific)
Tires are high-value, fungible items easily resold.
- **Risk**: Ghost supplier invoices to siphon money.
  - *Control*: Supplier creation requires different permissions than Invoice registration. Three-way match (Purchase Order -> Delivery Note -> Invoice).
- **Risk**: Cash sales not rung up.
  - *Control*: Strict sequence numbering for invoices. End of shift drawer reconciliation.

## Data Loss Prevention
- Real-time Point-In-Time Recovery (PITR) configured on Supabase (if plan permits) or daily logical backups to a secure off-site bucket.
- Soft-deletes (e.g., `is_active = false`) are used for master data instead of hard `DELETE`.

## Dependency Scanning
- Enable GitHub Dependabot or similar tooling to scan the React/Next.js repository for known vulnerabilities in NPM packages.
- Ensure Edge Functions are kept up-to-date with secure Deno/Node runtimes.
