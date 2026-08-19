-- Migration: 20260804230000_032_fix_user_profiles_rls_insert_policy.sql
-- Purpose: Grant INSERT/DELETE privileges and add RLS policies on user_profiles, user_roles, branch_access, and warehouse_access tables.

BEGIN;

-- 1. Grant INSERT privileges on user_profiles
GRANT INSERT, SELECT, UPDATE ON public.user_profiles TO authenticated;

-- 2. Add INSERT policy for user_profiles
DROP POLICY IF EXISTS "user_profiles_insert" ON public.user_profiles;
CREATE POLICY "user_profiles_insert" ON public.user_profiles
    FOR INSERT TO authenticated WITH CHECK (
        id = auth.uid() OR public.has_permission('users.manage')
    );

-- 3. Grant INSERT & DELETE on user_roles and add policies
GRANT INSERT, DELETE, SELECT ON public.user_roles TO authenticated;

DROP POLICY IF EXISTS "user_roles_insert" ON public.user_roles;
CREATE POLICY "user_roles_insert" ON public.user_roles
    FOR INSERT TO authenticated WITH CHECK (
        user_id = auth.uid() OR public.has_permission('users.manage')
    );

DROP POLICY IF EXISTS "user_roles_delete" ON public.user_roles;
CREATE POLICY "user_roles_delete" ON public.user_roles
    FOR DELETE TO authenticated USING (
        user_id = auth.uid() OR public.has_permission('users.manage')
    );

-- 4. Grant INSERT & DELETE on branch_access and add policies
GRANT INSERT, DELETE, SELECT ON public.branch_access TO authenticated;

DROP POLICY IF EXISTS "branch_access_insert" ON public.branch_access;
CREATE POLICY "branch_access_insert" ON public.branch_access
    FOR INSERT TO authenticated WITH CHECK (
        user_id = auth.uid() OR public.has_permission('users.manage')
    );

DROP POLICY IF EXISTS "branch_access_delete" ON public.branch_access;
CREATE POLICY "branch_access_delete" ON public.branch_access
    FOR DELETE TO authenticated USING (
        user_id = auth.uid() OR public.has_permission('users.manage')
    );

-- 5. Grant INSERT & DELETE on warehouse_access and add policies
GRANT INSERT, DELETE, SELECT ON public.warehouse_access TO authenticated;

DROP POLICY IF EXISTS "warehouse_access_insert" ON public.warehouse_access;
CREATE POLICY "warehouse_access_insert" ON public.warehouse_access
    FOR INSERT TO authenticated WITH CHECK (
        user_id = auth.uid() OR public.has_permission('users.manage')
    );

DROP POLICY IF EXISTS "warehouse_access_delete" ON public.warehouse_access;
CREATE POLICY "warehouse_access_delete" ON public.warehouse_access
    FOR DELETE TO authenticated USING (
        user_id = auth.uid() OR public.has_permission('users.manage')
    );

-- 6. RPC: SECURITY DEFINER Helper for administrative creation of user profiles
CREATE OR REPLACE FUNCTION public.admin_create_user_profile(
  p_user_id UUID,
  p_username TEXT,
  p_full_name TEXT,
  p_email TEXT,
  p_phone TEXT DEFAULT NULL,
  p_role_code TEXT DEFAULT 'MANAGER_LIMITED'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit, pg_temp
AS $$
DECLARE
  v_company_id UUID;
  v_profile public.user_profiles;
  v_role_id UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('users.manage') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: users.manage';
  END IF;

  IF NULLIF(TRIM(p_full_name), '') IS NULL THEN
    RAISE EXCEPTION 'FULL_NAME_REQUIRED';
  END IF;
  IF NULLIF(TRIM(p_email), '') IS NULL THEN
    RAISE EXCEPTION 'EMAIL_REQUIRED';
  END IF;

  v_company_id := public.get_user_company_id();

  INSERT INTO public.user_profiles (
    id, company_id, username, full_name, email, phone, is_active
  ) VALUES (
    p_user_id, v_company_id, TRIM(LOWER(p_username)), TRIM(p_full_name), TRIM(LOWER(p_email)), NULLIF(TRIM(p_phone), ''), true
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    is_active = true,
    updated_at = now()
  RETURNING * INTO v_profile;

  -- Assign role if specified
  SELECT id INTO v_role_id FROM public.roles WHERE company_id = v_company_id AND code = p_role_code;
  IF v_role_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id) VALUES (p_user_id, v_role_id) ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO audit.operational_events (
    company_id, user_id, event_type, resource_type, resource_id, metadata
  ) VALUES (
    v_company_id, auth.uid(), 'USER_PROFILE_CREATED', 'user_profile', p_user_id,
    jsonb_build_object('username', p_username, 'email', p_email, 'role_code', p_role_code)
  );

  RETURN jsonb_build_object(
    'id', v_profile.id,
    'username', v_profile.username,
    'full_name', v_profile.full_name,
    'email', v_profile.email,
    'is_active', v_profile.is_active
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_user_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_user_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMIT;
