-- Migration: 20260731001000_025_purge_all_test_products_and_resets.sql
-- Purpose: Purge all initial test products, inventory balances, and stock movements
-- so that the database starts 100% clean for client demo / production use.

BEGIN;

-- Remove all test balances, stock movements and products
TRUNCATE TABLE public.inventory_balances CASCADE;
TRUNCATE TABLE public.stock_movements CASCADE;
TRUNCATE TABLE public.products CASCADE;

COMMIT;
