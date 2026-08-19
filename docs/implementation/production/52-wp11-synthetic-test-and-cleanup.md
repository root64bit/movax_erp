# WP11 Synthetic Test and Cleanup Evidence

> Date: 2026-07-28  
> Mode: `MIGRATION`  
> Test method: one database transaction, followed by mandatory rollback

## Identification and isolation

- Synthetic codes use the `TEST-` prefix.
- Synthetic idempotency keys use `TEST-SALE-`, `TEST-PAYMENT-`,
  `TEST-PURCHASE-`, or `TEST-SUPPLIER-PAYMENT-`.
- Synthetic records use generated UUIDs and never reuse or predict legacy IDs.
- The server accepts synthetic operations in `MIGRATION` only when:
  - the session is authenticated;
  - the user has `migration.manage`;
  - `SET LOCAL app.synthetic_test_mode = 'on'` exists in the same transaction.
- Ordinary browser sessions cannot set this transaction-local database flag.

## Reconciliation result

The automated rollback test created a TEST customer, supplier, and product,
posted opening test stock of 10, sold 2, purchased 5, fully received the
customer invoice, and fully paid the supplier invoice.

| Check | Result |
|---|---|
| Customer document | `PAID` |
| Customer payment | `FULLY_ALLOCATED` |
| Supplier document | `PAID` |
| Supplier payment | `FULLY_ALLOCATED` |
| Customer allocations | 1 |
| Supplier allocations | 1 |
| Reconciled stock | 13 |
| Customer ledger entries | 2 |
| Supplier ledger entries | 2 |

After rollback, products, customers, suppliers, documents, lines, stock
movements, payments, allocations, and ledger counts exactly matched their
pre-test values. No TEST record remained.

## Safe cleanup procedure

Preferred cleanup is always `ROLLBACK` of the transaction that created the
synthetic records. If a test transaction is accidentally committed:

1. Stop further TEST activity and keep `SYSTEM_MODE = MIGRATION`.
2. Back up the database.
3. Identify the exact TEST UUIDs through their `TEST-` codes and idempotency
   keys; never delete by date range or broad wildcard alone.
4. Reconcile documents, allocations, ledger entries, and stock movements for
   those UUIDs.
5. Use the supported reversal functions in dependency order. Do not directly
   delete confirmed financial or stock history.
6. Confirm balances and stock return to the pre-test snapshot.
7. Record approval, operator, identifiers, checksums, and results.

Automated reference: `scripts/test_wp11_synthetic_e2e_rollback.js`.
