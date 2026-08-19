-- Rollback Migration: 20260728230000_007a_document_engine_closure_undo.sql
-- Description: Reverts migration 007a safely.

BEGIN;

DROP FUNCTION IF EXISTS private.create_supplier_return_from_document CASCADE;
DROP FUNCTION IF EXISTS private.create_supplier_debit_advice_from_document CASCADE;
DROP FUNCTION IF EXISTS private.create_supplier_credit_advice_from_document CASCADE;
DROP FUNCTION IF EXISTS private.create_customer_debit_note_from_document CASCADE;
DROP FUNCTION IF EXISTS private.create_customer_credit_note_from_document CASCADE;

COMMIT;
