# Manager restriction test results

- Login/context: PASS.
- Required direct stock permissions: PASS.
- Forbidden permission set: none present.
- Product-creation RPC: denied (`P0001`).
- Direct `inventory_balances` insert: denied (`42501`).
- Direct `user_profiles` update: denied after migration 017 (`42501`).
- Administrative user RPC: denied (`P0001`).
- Server-paginated reports: PASS for sales, stock, receivables, payables, and VAT.
- System mode: `MIGRATION`.

The direct profile test initially exposed a self-update gap; the test-only display-name change was restored and migration 017 closed the path.
