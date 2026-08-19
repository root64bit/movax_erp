-- Rollback Migration: 20260728200000_005_legacy_article_and_stock_migration_staging_undo.sql
-- Description: Reverts migration 005 safely.

BEGIN;

DROP FUNCTION IF EXISTS migration.reconcile_article_stock_batch CASCADE;
DROP FUNCTION IF EXISTS migration.process_opening_stock_migration_batch CASCADE;
DROP FUNCTION IF EXISTS migration.process_article_migration_batch CASCADE;

DROP TABLE IF EXISTS migration.migration_errors CASCADE;
DROP TABLE IF EXISTS migration.stock_movements_raw CASCADE;
DROP TABLE IF EXISTS migration.products_raw CASCADE;
DROP TABLE IF EXISTS migration.migration_batches CASCADE;

COMMIT;
