-- WP11: close unrestricted self-profile writes and expose a narrow administrative RPC.
BEGIN;

DROP POLICY IF EXISTS "user_profiles_update" ON public.user_profiles;
REVOKE UPDATE ON public.user_profiles FROM authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_user_profile(
  p_user_id UUID,
  p_full_name TEXT,
  p_is_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit, pg_temp
AS $$
DECLARE
  v_company_id UUID;
  v_profile public.user_profiles;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('users.manage') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: users.manage';
  END IF;
  IF NULLIF(TRIM(p_full_name), '') IS NULL THEN
    RAISE EXCEPTION 'FULL_NAME_REQUIRED';
  END IF;
  IF p_user_id = auth.uid() AND NOT p_is_active THEN
    RAISE EXCEPTION 'CANNOT_DEACTIVATE_CURRENT_USER';
  END IF;

  v_company_id := public.get_user_company_id();
  UPDATE public.user_profiles
  SET full_name = TRIM(p_full_name),
      is_active = p_is_active,
      updated_at = now()
  WHERE id = p_user_id AND company_id = v_company_id
  RETURNING * INTO v_profile;
  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;

  INSERT INTO audit.operational_events (
    company_id, user_id, event_type, resource_type, resource_id, metadata
  ) VALUES (
    v_company_id, auth.uid(), 'USER_PROFILE_UPDATED', 'user_profile', p_user_id,
    jsonb_build_object('is_active', p_is_active)
  );

  RETURN jsonb_build_object(
    'id', v_profile.id,
    'full_name', v_profile.full_name,
    'is_active', v_profile.is_active
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_user_profile(UUID, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_user_profile(UUID, TEXT, BOOLEAN) TO authenticated;

COMMIT;
