-- Rollback Migration: 20260728210000_006_customers_suppliers_and_contact_migration_undo.sql
-- Description: Reverts migration 006 safely.

BEGIN;

DROP FUNCTION IF EXISTS migration.reconcile_supplier_batch CASCADE;
DROP FUNCTION IF EXISTS migration.reconcile_customer_batch CASCADE;
DROP FUNCTION IF EXISTS migration.process_supplier_migration_batch CASCADE;
DROP FUNCTION IF EXISTS migration.process_customer_migration_batch CASCADE;

DROP TABLE IF EXISTS migration.suppliers_raw CASCADE;
DROP TABLE IF EXISTS migration.customers_raw CASCADE;

DROP FUNCTION IF EXISTS private.initialise_supplier_opening_balance CASCADE;
DROP FUNCTION IF EXISTS private.initialise_customer_opening_balance CASCADE;

DROP TABLE IF EXISTS public.supplier_bank_accounts CASCADE;
DROP TABLE IF EXISTS public.supplier_contacts CASCADE;
DROP TABLE IF EXISTS public.supplier_addresses CASCADE;
DROP TABLE IF EXISTS public.suppliers CASCADE;

DROP TABLE IF EXISTS public.customer_contacts CASCADE;
DROP TABLE IF EXISTS public.customer_addresses CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;

DROP TABLE IF EXISTS public.payment_terms CASCADE;

COMMIT;
