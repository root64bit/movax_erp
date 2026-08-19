-- Rollback Migration: 20260728260000_009_legacy_raw_staging_completion_undo.sql
-- Description: Reverts migration 009 safely.

BEGIN;

DROP TABLE IF EXISTS migration.reconciliation_results CASCADE;
DROP TABLE IF EXISTS migration.raw_import_results CASCADE;
DROP TABLE IF EXISTS migration.settings_raw CASCADE;
DROP TABLE IF EXISTS migration.users_raw CASCADE;
DROP TABLE IF EXISTS migration.document_links_raw CASCADE;
DROP TABLE IF EXISTS migration.supplier_contacts_raw CASCADE;
DROP TABLE IF EXISTS migration.customer_contacts_raw CASCADE;
DROP TABLE IF EXISTS migration.product_prices_raw CASCADE;
DROP TABLE IF EXISTS migration.reference_data_raw CASCADE;
DROP TABLE IF EXISTS migration.migration_sources CASCADE;

COMMIT;
