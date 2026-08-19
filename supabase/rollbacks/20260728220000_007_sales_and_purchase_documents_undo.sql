-- Rollback Migration: 20260728220000_007_sales_and_purchase_documents_undo.sql
-- Description: Reverts migration 007 safely.

BEGIN;

DROP FUNCTION IF EXISTS private.reverse_confirmed_document CASCADE;
DROP FUNCTION IF EXISTS private.confirm_supplier_document CASCADE;
DROP FUNCTION IF EXISTS private.confirm_customer_document CASCADE;
DROP FUNCTION IF EXISTS public.recalculate_document CASCADE;
DROP FUNCTION IF EXISTS private.next_document_number CASCADE;

DROP TABLE IF EXISTS migration.document_lines_raw CASCADE;
DROP TABLE IF EXISTS migration.documents_raw CASCADE;

DROP TABLE IF EXISTS public.ledger_entries CASCADE;
DROP TABLE IF EXISTS public.document_status_history CASCADE;
DROP TABLE IF EXISTS public.document_links CASCADE;
DROP TABLE IF EXISTS public.document_transport_details CASCADE;
DROP TABLE IF EXISTS public.document_lines CASCADE;
DROP TABLE IF EXISTS public.documents CASCADE;
DROP TABLE IF EXISTS public.document_types CASCADE;

COMMIT;
