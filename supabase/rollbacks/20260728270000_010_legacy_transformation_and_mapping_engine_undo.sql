-- Rollback Migration: 20260728270000_010_legacy_transformation_and_mapping_engine_undo.sql
-- Description: Reverts migration 010 safely.

BEGIN;

DROP FUNCTION IF EXISTS migration.rollback_batch(UUID, TEXT) CASCADE;
DROP TABLE IF EXISTS migration.payment_method_maps CASCADE;
DROP TABLE IF EXISTS migration.tax_code_maps CASCADE;
DROP TABLE IF EXISTS migration.unit_maps CASCADE;
DROP TABLE IF EXISTS migration.rollback_operations CASCADE;
DROP TABLE IF EXISTS migration.business_decisions CASCADE;
DROP TABLE IF EXISTS migration.transformation_results CASCADE;
DROP TABLE IF EXISTS migration.transformation_runs CASCADE;

COMMIT;
