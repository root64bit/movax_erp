-- Migration: 20260731160000_027_purge_initial_stk_test_movements.sql
-- Purpose: Delete legacy test stock movements STK-001 and STK-002 from database

BEGIN;

DELETE FROM public.stock_movements
WHERE legacy_ref IN ('STK-001', 'STK-002');

COMMIT;
