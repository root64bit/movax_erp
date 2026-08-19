# Database Constraints and Invariants: Casa de Pneus

## 1. Unique Constraints
*   **Article Code**: `UNIQUE(company_id, code)` in `products`. Ensures no duplicate SKUs per tenant.
*   **Customer/Supplier Number**: `UNIQUE(company_id, customer_number)` and `UNIQUE(company_id, supplier_number)`.
*   **Document Numbering**: `UNIQUE(company_id, document_type_id, series, number)`. Essential for fiscal compliance in Mozambique (e.g., Fatura FT 2023/1).
*   **Inventory Balances**: `UNIQUE(company_id, warehouse_id, product_id)`. One balance record per item per location.

## 2. Check Constraints (Data Integrity)
*   **Non-Negative Money**: `CHECK (net_total >= 0)`, `CHECK (tax_total >= 0)`, `CHECK (grand_total >= 0)` on documents.
*   **Quantities**: `CHECK (quantity > 0)` on document lines and stock movements. `CHECK (quantity >= 0)` on inventory balances.
*   **Percentages**: `CHECK (discount_pct >= 0 AND discount_pct <= 100)`, `CHECK (tax_rate >= 0 AND tax_rate <= 100)`.

## 3. Referential Integrity
*   **Standard FKs**: Restrict deletion of actively used lookup values (e.g., `products` referencing `tax_codes` uses `ON DELETE RESTRICT`).
*   **Cascading**: `ON DELETE CASCADE` for parent-child composite relationships (e.g., `document_lines` cascade when `documents` are deleted, though document deletion is heavily restricted).
*   **Company Isolation**: All tenant-specific tables have a `company_id` FK.

## 4. Immutability Rules for Confirmed Documents
*   **Rule**: Once a document status is `confirmed`, it cannot be updated or deleted.
*   **Enforcement**: **PostgreSQL Trigger** `trg_prevent_confirmed_document_update`. Any attempt to `UPDATE` lines or header fields (except `paid_amount` or `status` to `cancelled`) raises an exception.
*   **Cancellation**: Requires a cancellation reason, changes status, and automatically generates reversing stock movements and ledger entries.

## 5. Stock Balance Consistency
*   **Rule**: `quantity_in` and `quantity_out` in `stock_movements` must reflect correctly in `inventory_balances.quantity`.
*   **Enforcement**: **Triggers** on `stock_movements`. After insert, the trigger updates `inventory_balances` atomically.
*   **Prevention of Negative Stock**: `CHECK (quantity >= 0)` on `inventory_balances` enforces hard blocks on negative stock unless explicitly allowed by a `company_settings` flag (handled in the trigger logic).

## 6. Payment Allocations
*   **Rule**: The sum of `payment_allocations` for a payment cannot exceed `payments.total_amount`.
*   **Rule**: The sum of `payment_allocations` for a document cannot exceed `documents.grand_total`.
*   **Enforcement**: Handled via application validation and database triggers (`trg_check_payment_allocations`).

## 7. Cross-Company Isolation
*   **Rule**: A user from Company A cannot query or link to data in Company B.
*   **Enforcement**: **Row Level Security (RLS)** in Supabase. Every table has a policy: `USING (company_id = auth.jwt()->>'company_id')`. Foreign keys also include `company_id` in composite checks where extreme strictness is required.

## 8. Idempotency Guards
*   **Rule**: External API calls, legacy data migrations, or webhook retries must not result in duplicate records.
*   **Enforcement**: Unique constraints on `legacy_id` and `migration_batch_id`. The `source_document_id` and `migration_hash` act as idempotency keys during the XT-POS import.

## Implementation Strategy Summary
| Concept | Enforcement Level |
|---------|-------------------|
| Standard validation (Lengths, > 0) | DB `CHECK` constraints |
| Uniqueness (SKU, Doc Numbers) | DB `UNIQUE` constraints |
| Cross-tenant isolation | Supabase RLS |
| Header/Line immutability | DB `AFTER UPDATE` Triggers |
| Stock Balance syncing | DB `AFTER INSERT` Triggers |
| Complex credit limit logic | Application Service Layer |
| Reconciliation / Drift | Scheduled cron jobs / Edge Functions |
