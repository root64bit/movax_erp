# MIGRATION-to-PILOT Approval and Rollback Package

## Hard gate

The production system remains in `MIGRATION`. No application screen, migration,
deployment script, or test may change it. Transition to `PILOT` requires a
separate signed package and an explicitly authorised mode-change operation.

## Approval checklist

- [ ] Exposed database password and Management token rotated; publishable/secret
      API-key migration and dependent application checks are complete.
- [ ] Git secret-history review accepted or history rewritten under a separate
      coordinated credential-revocation plan.
- [ ] Production frontend URL and owner-only access tested.
- [x] Initial Administrator and Manager users created with forced password change.
- [ ] `ADMINISTRATOR` and `MANAGER_LIMITED` business acceptance tests signed.
- [ ] Company identity, NUIT, address, contacts, branches, warehouses, fiscal
      period, tax codes, payment terms, and payment methods approved.
- [ ] Printer/browser combinations verified for invoices, supplier documents,
      receipts/payments, and reports.
- [ ] Backup checksum and restoration rehearsal accepted.
- [ ] Synthetic TEST cleanup evidence accepted.
- [ ] Business owner, finance owner, operations owner, and technical owner sign.

Legacy XT-POS migration completion is not a prerequisite for this gate.

## Authorised mode change

Only after all approvals, create a new versioned SQL migration that:

1. locks the `SYSTEM_MODE` setting;
2. asserts the current value is `MIGRATION`;
3. writes `PILOT` and the approval reference;
4. records the acting user and timestamp in the audit trail;
5. commits atomically.

Do not edit the setting manually in the dashboard.

## Rollback from PILOT

Trigger rollback for material posting defects, incorrect permissions, fiscal or
tax configuration errors, unexplained reconciliation differences, or security
events.

1. Stop user access and new operations.
2. Use an approved atomic migration to return `SYSTEM_MODE` to `MIGRATION`.
3. Preserve evidence and capture a fresh backup.
4. Identify pilot-only UUIDs and idempotency keys.
5. Reverse confirmed payments and documents through supported reversal APIs.
6. Reconcile stock, documents, allocations, customer/supplier balances, and
   ledgers against the pre-PILOT snapshot.
7. Correct, retest with rollback-only TEST data, and request new approval.

Do not delete financial history directly and do not start legacy APPLY during
pilot rollback.
