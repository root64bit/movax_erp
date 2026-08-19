-- Rollback Migration: 20260728180000_003_articles_and_reference_data_undo.sql
-- Description: Reverts migration 003 safely.

BEGIN;

DROP TABLE IF EXISTS public.price_history CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.tax_codes CASCADE;
DROP TABLE IF EXISTS public.units_of_measure CASCADE;
DROP TABLE IF EXISTS public.brands CASCADE;
DROP TABLE IF EXISTS public.product_categories CASCADE;
DROP TABLE IF EXISTS public.product_families CASCADE;

COMMIT;
