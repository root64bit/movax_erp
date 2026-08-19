-- Rollback Migration: 20260728170000_002_auth_rbac_and_rls_foundation_undo.sql
-- Description: Reverts migration 002 safely.

BEGIN;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.has_warehouse_access(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.has_branch_access(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.has_permission(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_permissions() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_company_id() CASCADE;

DROP TABLE IF EXISTS public.login_events CASCADE;
DROP TABLE IF EXISTS public.warehouse_access CASCADE;
DROP TABLE IF EXISTS public.branch_access CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.role_permissions CASCADE;
DROP TABLE IF EXISTS public.permissions CASCADE;
DROP TABLE IF EXISTS public.roles CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;

COMMIT;
