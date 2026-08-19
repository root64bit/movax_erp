-- Rollback Migration: 20260728250000_008a_payments_engine_closure_undo.sql
-- Description: Reverts migration 008a safely.

BEGIN;

DROP FUNCTION IF EXISTS migration.reconcile_current_accounts CASCADE;
DROP FUNCTION IF EXISTS migration.reconcile_payment_batch CASCADE;
DROP FUNCTION IF EXISTS migration.process_payment_allocation_batch CASCADE;
DROP FUNCTION IF EXISTS migration.process_supplier_payment_batch CASCADE;
DROP FUNCTION IF EXISTS migration.process_customer_payment_batch CASCADE;
DROP FUNCTION IF EXISTS private.reprint_payment_receipt CASCADE;
DROP FUNCTION IF EXISTS private.issue_payment_receipt CASCADE;
DROP FUNCTION IF EXISTS private.auto_allocate_payment_oldest_first CASCADE;
DROP TABLE IF EXISTS migration.current_accounts_raw CASCADE;

COMMIT;
