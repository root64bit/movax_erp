BEGIN;

DROP FUNCTION IF EXISTS public.admin_update_user_profile(UUID, TEXT, BOOLEAN);
GRANT UPDATE ON public.user_profiles TO authenticated;
DROP POLICY IF EXISTS "user_profiles_update" ON public.user_profiles;
CREATE POLICY "user_profiles_update" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_permission('users.manage'));

COMMIT;
