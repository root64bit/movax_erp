-- Rollback Migration: 20260728190000_004_stock_engine_undo.sql
-- Description: Reverts migration 004 safely.

BEGIN;

DROP FUNCTION IF EXISTS public.post_stock_movement CASCADE;
DROP TABLE IF EXISTS public.stock_transfer_lines CASCADE;
DROP TABLE IF EXISTS public.stock_transfers CASCADE;
DROP TABLE IF EXISTS public.inventory_count_lines CASCADE;
DROP TABLE IF EXISTS public.inventory_counts CASCADE;
DROP TABLE IF EXISTS public.stock_movements CASCADE;
DROP TABLE IF EXISTS public.stock_movement_reasons CASCADE;
DROP TABLE IF EXISTS public.inventory_balances CASCADE;

COMMIT;
