-- Rollback Migration: 20260728162000_001_core_schemas_and_company_config_undo.sql
-- Description: Reverts migration 001 safely.

BEGIN;

DROP TABLE IF EXISTS public.document_sequences CASCADE;
DROP TABLE IF EXISTS public.fiscal_periods CASCADE;
DROP TABLE IF EXISTS public.company_settings CASCADE;
DROP TABLE IF EXISTS public.warehouses CASCADE;
DROP TABLE IF EXISTS public.branches CASCADE;
DROP TABLE IF EXISTS public.companies CASCADE;
DROP TABLE IF EXISTS public.system_settings CASCADE;

-- Note: Schemas (private, migration, audit) are preserved if other objects reference them.

COMMIT;
