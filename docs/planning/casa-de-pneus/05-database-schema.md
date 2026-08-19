# Database Schema Design: Casa de Pneus

## 1. Core Domain
| Table | Purpose | Columns | PK | FKs | Defaults/Audit |
|-------|---------|---------|----|-----|----------------|
| `companies` | Multi-tenant root | `id` UUID, `name` VARCHAR, `tax_number` VARCHAR, `address` TEXT, `phone` VARCHAR, `email` VARCHAR, `logo_url` VARCHAR, `created_at` TIMESTAMPTZ, `updated_at` TIMESTAMPTZ | `id` | None | `created_at` = NOW() |
| `branches` | Physical store locations | `id` UUID, `company_id` UUID, `name` VARCHAR, `code` VARCHAR, `address` TEXT, `phone` VARCHAR, `is_active` BOOLEAN | `id` | `companies.id` | `is_active` = TRUE |
| `warehouses` | Storage locations | `id` UUID, `branch_id` UUID, `name` VARCHAR, `code` VARCHAR, `is_default` BOOLEAN, `is_active` BOOLEAN | `id` | `branches.id` | `is_active` = TRUE |
| `company_settings` | Configuration kv store | `id` UUID, `company_id` UUID, `setting_key` VARCHAR, `setting_value` TEXT, `data_type` VARCHAR | `id` | `companies.id` | - |
| `fiscal_periods` | Financial years | `id` UUID, `company_id` UUID, `year` INT, `start_date` DATE, `end_date` DATE, `status` VARCHAR, `closed_at` TIMESTAMPTZ, `closed_by` UUID | `id` | `companies.id`, `users.id` | `status` = 'open' |
| `document_sequences` | Invoice numbering | `id` UUID, `company_id` UUID, `document_type` VARCHAR, `series` VARCHAR, `current_number` INT, `fiscal_period_id` UUID, `prefix` VARCHAR, `suffix` VARCHAR | `id` | `companies.id`, `fiscal_periods.id` | `current_number` = 0 |

## 2. Identity Domain
| Table | Purpose | Columns | PK | FKs | Defaults/Audit |
|-------|---------|---------|----|-----|----------------|
| `user_profiles` | User extensions | `id` UUID, `company_id` UUID, `username` VARCHAR, `full_name` VARCHAR, `email` VARCHAR, `phone` VARCHAR, `is_active` BOOLEAN, `force_password_change` BOOLEAN, `last_login_at` TIMESTAMPTZ | `id` | `auth.users.id`, `companies.id` | `is_active` = TRUE |
| `roles` | RBAC roles | `id` UUID, `company_id` UUID, `name` VARCHAR, `description` TEXT, `is_system_role` BOOLEAN | `id` | `companies.id` | `is_system_role` = FALSE |
| `permissions` | RBAC permissions | `id` UUID, `code` VARCHAR, `module` VARCHAR, `description` TEXT | `id` | None | - |
| `role_permissions` | Role-Perm mapping | `role_id` UUID, `permission_id` UUID | (`role_id`, `perm_id`) | `roles.id`, `permissions.id` | - |
| `user_roles` | User-Role mapping | `user_id` UUID, `role_id` UUID | (`user_id`, `role_id`) | `users.id`, `roles.id` | - |
| `branch_access` | Branch visibility | `user_id` UUID, `branch_id` UUID | (`user_id`, `branch_id`) | `users.id`, `branches.id`| - |
| `warehouse_access` | WH visibility | `user_id` UUID, `warehouse_id` UUID | (`user_id`, `wh_id`) | `users.id`, `warehouses.id`| - |
| `login_events` | Security logging | `id` UUID, `user_id` UUID, `event_type` VARCHAR, `ip_address` VARCHAR, `user_agent` TEXT, `created_at` TIMESTAMPTZ | `id` | `users.id` | `created_at` = NOW() |

## 3. Catalogue Domain
*(Includes products, product_families, product_categories, brands, units_of_measure, tax_codes, price_history)*
Products table acts as the central item master. Links to families, categories, brands. Stores average cost and current sale price. `price_history` tracks changes for audit.

## 4. Stock Domain
*(Includes inventory_balances, stock_movements, stock_movement_reasons, inventory_counts, inventory_count_lines, stock_transfers, stock_transfer_lines)*
`inventory_balances` is a materialized view equivalent updated via triggers or application logic from `stock_movements`. Movements are append-only.

## 5. Customers & Suppliers
Customers (B2B/B2C) and Suppliers track contact data, limits, and settings. Separated into base table, addresses, contacts, and bank accounts for suppliers.

## 6. Commercial Documents
*(document_types, documents, document_lines, document_status_history, document_links)*
Core workflow. Documents (Invoices, Orders, Receipts) with Lines. Uses snapshotting for `unit_price`, `description`, `tax_rate` to prevent historical mutation if catalogue changes.

## 7. Payments & Ledger
*(payment_methods, payments, payment_method_entries, payment_allocations, payment_reversals, ledger_accounts, ledger_entries, ledger_entry_links)*
Payments are allocated to documents. Ledger provides double-entry accounting for financial reporting.

## 8. Administration & Migration
*(audit_logs, system_events, print_logs, application_settings, migration_batches, migration_sources, migration_table_maps, migration_field_maps, migration_records, migration_errors, migration_reconciliation_results)*
Robust audit and XT-POS legacy migration tracking.

## Architecture Trade-offs & Recommendations

### 1. Enums vs Lookup Tables
*Trade-off*: Enums are fast and enforce strict schema but require DDL to change. Lookup tables are dynamic but require joins.
*Recommendation*: Use PostgreSQL `ENUM` for fixed state machines (e.g., Document Status: `draft`, `confirmed`, `cancelled`). Use Lookup Tables for extensible lists (e.g., `stock_movement_reasons`, `payment_methods`).

### 2. Calculated vs Materialized Inventory
*Trade-off*: Calculating sum(in) - sum(out) guarantees accuracy but degrades performance. Materialized balances are fast but risk drift.
*Recommendation*: **Hybrid (Materialized + Event Sourced)**. Store balances in `inventory_balances` and update them transactionally when `stock_movements` occur. Add reconciliation jobs to ensure `SUM(movements) == balance`.

### 3. Generated vs Persisted Document Totals
*Trade-off*: Totals can be derived from lines (`SUM(qty * price)`). Persisting them saves query time but risks line/header mismatch.
*Recommendation*: **Persist totals** in the `documents` table for performance and legacy migration fidelity. Enforce header/line consistency via database triggers on insert/update.

### 4. Ledger-Derived vs Stored Balances
*Trade-off*: Real-time ledger SUMs vs account balance columns.
*Recommendation*: **Ledger-derived for detailed accounts, materialized for quick customer/supplier balance**. The `customers.outstanding_amount` is materialized for fast POS validation, updated via triggers on document and payment confirmation.
