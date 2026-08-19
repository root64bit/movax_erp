-- Rollback Migration: 20260728240000_008_payments_allocations_and_current_accounts_undo.sql
-- Description: Reverts migration 008 safely.

BEGIN;

DROP VIEW IF EXISTS public.supplier_current_account_view CASCADE;
DROP VIEW IF EXISTS public.customer_current_account_view CASCADE;

DROP FUNCTION IF EXISTS private.reverse_payment CASCADE;
DROP FUNCTION IF EXISTS private.confirm_supplier_payment CASCADE;
DROP FUNCTION IF EXISTS private.confirm_customer_payment CASCADE;
DROP FUNCTION IF EXISTS private.allocate_payment CASCADE;
DROP FUNCTION IF EXISTS private.refresh_supplier_balance CASCADE;
DROP FUNCTION IF EXISTS private.refresh_customer_balance CASCADE;
DROP FUNCTION IF EXISTS private.refresh_document_payment_status CASCADE;
DROP FUNCTION IF EXISTS private.next_receipt_number CASCADE;
DROP FUNCTION IF EXISTS private.next_payment_number CASCADE;

DROP TABLE IF EXISTS migration.payment_allocations_raw CASCADE;
DROP TABLE IF EXISTS migration.payments_raw CASCADE;

DROP TABLE IF EXISTS public.payment_receipts CASCADE;
DROP TABLE IF EXISTS public.payment_reversals CASCADE;
DROP TABLE IF EXISTS public.payment_allocations CASCADE;
DROP TABLE IF EXISTS public.payment_method_entries CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.payment_methods CASCADE;

COMMIT;
