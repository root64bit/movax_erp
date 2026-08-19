-- MOVAX ERP / POS
-- Multi-tenant security hardening and safer user provisioning.
-- This migration intentionally keeps the historical pilot tenant data, but removes
-- policies/triggers that could leak or automatically assign new users across tenants.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. COMPANIES: an authenticated tenant can only read/update its own company.
-- Company creation remains a service-role / platform-admin operation.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "companies_select_policy" ON public.companies;
CREATE POLICY "companies_select_policy" ON public.companies
FOR SELECT TO authenticated
USING (id = public.get_user_company_id());

DROP POLICY IF EXISTS "companies_update_policy" ON public.companies;
CREATE POLICY "companies_update_policy" ON public.companies
FOR UPDATE TO authenticated
USING (
  id = public.get_user_company_id()
  AND public.has_permission('settings.manage')
)
WITH CHECK (
  id = public.get_user_company_id()
  AND public.has_permission('settings.manage')
);

REVOKE INSERT ON public.companies FROM authenticated;

-- -----------------------------------------------------------------------------
-- 2. CORE TENANT TABLES: replace pilot UUID policies with dynamic company scope.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "branches_select_policy" ON public.branches;
CREATE POLICY "branches_select_policy" ON public.branches
FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "branches_insert_policy" ON public.branches;
CREATE POLICY "branches_insert_policy" ON public.branches
FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_user_company_id()
  AND public.has_permission('settings.manage')
);

DROP POLICY IF EXISTS "branches_update_policy" ON public.branches;
CREATE POLICY "branches_update_policy" ON public.branches
FOR UPDATE TO authenticated
USING (
  company_id = public.get_user_company_id()
  AND public.has_permission('settings.manage')
)
WITH CHECK (
  company_id = public.get_user_company_id()
  AND public.has_permission('settings.manage')
);

DROP POLICY IF EXISTS "warehouses_select_policy" ON public.warehouses;
CREATE POLICY "warehouses_select_policy" ON public.warehouses
FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "warehouses_insert_policy" ON public.warehouses;
CREATE POLICY "warehouses_insert_policy" ON public.warehouses
FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_user_company_id()
  AND public.has_permission('settings.manage')
);

DROP POLICY IF EXISTS "warehouses_update_policy" ON public.warehouses;
CREATE POLICY "warehouses_update_policy" ON public.warehouses
FOR UPDATE TO authenticated
USING (
  company_id = public.get_user_company_id()
  AND public.has_permission('settings.manage')
)
WITH CHECK (
  company_id = public.get_user_company_id()
  AND public.has_permission('settings.manage')
);

DROP POLICY IF EXISTS "company_settings_select_policy" ON public.company_settings;
CREATE POLICY "company_settings_select_policy" ON public.company_settings
FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "company_settings_insert_policy" ON public.company_settings;
CREATE POLICY "company_settings_insert_policy" ON public.company_settings
FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_user_company_id()
  AND public.has_permission('settings.manage')
);

DROP POLICY IF EXISTS "company_settings_update_policy" ON public.company_settings;
CREATE POLICY "company_settings_update_policy" ON public.company_settings
FOR UPDATE TO authenticated
USING (
  company_id = public.get_user_company_id()
  AND public.has_permission('settings.manage')
)
WITH CHECK (
  company_id = public.get_user_company_id()
  AND public.has_permission('settings.manage')
);

DROP POLICY IF EXISTS "fiscal_periods_select_policy" ON public.fiscal_periods;
CREATE POLICY "fiscal_periods_select_policy" ON public.fiscal_periods
FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "document_sequences_select_policy" ON public.document_sequences;
CREATE POLICY "document_sequences_select_policy" ON public.document_sequences
FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id());

-- -----------------------------------------------------------------------------
-- 3. RBAC TABLES: users.manage must never become a cross-tenant bypass.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "user_profiles_select" ON public.user_profiles;
CREATE POLICY "user_profiles_select" ON public.user_profiles
FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR (
    company_id = public.get_user_company_id()
    AND public.has_permission('users.manage')
  )
);

DROP POLICY IF EXISTS "user_profiles_insert" ON public.user_profiles;
CREATE POLICY "user_profiles_insert" ON public.user_profiles
FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_user_company_id()
  AND (
    id = auth.uid()
    OR public.has_permission('users.manage')
  )
);

DROP POLICY IF EXISTS "role_permissions_select" ON public.role_permissions;
CREATE POLICY "role_permissions_select" ON public.role_permissions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.roles r
    WHERE r.id = role_permissions.role_id
      AND r.company_id = public.get_user_company_id()
  )
);

DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
CREATE POLICY "user_roles_select" ON public.user_roles
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR (
    public.has_permission('users.manage')
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = user_roles.user_id
        AND up.company_id = public.get_user_company_id()
    )
  )
);

DROP POLICY IF EXISTS "user_roles_insert" ON public.user_roles;
CREATE POLICY "user_roles_insert" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (
  public.has_permission('users.manage')
  AND EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = user_roles.user_id
      AND up.company_id = public.get_user_company_id()
  )
  AND EXISTS (
    SELECT 1 FROM public.roles r
    WHERE r.id = user_roles.role_id
      AND r.company_id = public.get_user_company_id()
  )
);

DROP POLICY IF EXISTS "user_roles_delete" ON public.user_roles;
CREATE POLICY "user_roles_delete" ON public.user_roles
FOR DELETE TO authenticated
USING (
  public.has_permission('users.manage')
  AND EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = user_roles.user_id
      AND up.company_id = public.get_user_company_id()
  )
);

DROP POLICY IF EXISTS "branch_access_select" ON public.branch_access;
CREATE POLICY "branch_access_select" ON public.branch_access
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR (
    public.has_permission('users.manage')
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = branch_access.user_id
        AND up.company_id = public.get_user_company_id()
    )
  )
);

DROP POLICY IF EXISTS "branch_access_insert" ON public.branch_access;
CREATE POLICY "branch_access_insert" ON public.branch_access
FOR INSERT TO authenticated
WITH CHECK (
  public.has_permission('users.manage')
  AND EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = branch_access.user_id
      AND up.company_id = public.get_user_company_id()
  )
  AND EXISTS (
    SELECT 1 FROM public.branches b
    WHERE b.id = branch_access.branch_id
      AND b.company_id = public.get_user_company_id()
  )
);

DROP POLICY IF EXISTS "branch_access_delete" ON public.branch_access;
CREATE POLICY "branch_access_delete" ON public.branch_access
FOR DELETE TO authenticated
USING (
  public.has_permission('users.manage')
  AND EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = branch_access.user_id
      AND up.company_id = public.get_user_company_id()
  )
);

DROP POLICY IF EXISTS "warehouse_access_select" ON public.warehouse_access;
CREATE POLICY "warehouse_access_select" ON public.warehouse_access
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR (
    public.has_permission('users.manage')
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = warehouse_access.user_id
        AND up.company_id = public.get_user_company_id()
    )
  )
);

DROP POLICY IF EXISTS "warehouse_access_insert" ON public.warehouse_access;
CREATE POLICY "warehouse_access_insert" ON public.warehouse_access
FOR INSERT TO authenticated
WITH CHECK (
  public.has_permission('users.manage')
  AND EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = warehouse_access.user_id
      AND up.company_id = public.get_user_company_id()
  )
  AND EXISTS (
    SELECT 1 FROM public.warehouses w
    WHERE w.id = warehouse_access.warehouse_id
      AND w.company_id = public.get_user_company_id()
  )
);

DROP POLICY IF EXISTS "warehouse_access_delete" ON public.warehouse_access;
CREATE POLICY "warehouse_access_delete" ON public.warehouse_access
FOR DELETE TO authenticated
USING (
  public.has_permission('users.manage')
  AND EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = warehouse_access.user_id
      AND up.company_id = public.get_user_company_id()
  )
);


-- Tenant-owned reference data must also be isolated. NULL company_id remains
-- reserved for future platform-global catalogue rows.
DROP POLICY IF EXISTS "document_types_select" ON public.document_types;
CREATE POLICY "document_types_select" ON public.document_types
FOR SELECT TO authenticated
USING (company_id IS NULL OR company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "payment_methods_select" ON public.payment_methods;
CREATE POLICY "payment_methods_select" ON public.payment_methods
FOR SELECT TO authenticated
USING (company_id IS NULL OR company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "financial_advice_allocations_select" ON public.financial_advice_allocations;
CREATE POLICY "financial_advice_allocations_select" ON public.financial_advice_allocations
FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id());

-- -----------------------------------------------------------------------------
-- 4. Stop public signup from silently assigning every new auth user to the pilot
-- tenant. Tenant provisioning must be performed explicitly by the current tenant
-- administrator RPC / future service-role invitation endpoint.
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Keep the function for backwards compatibility, but make it inert if called
-- manually. No company, role, branch or warehouse is inferred globally.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. Remove tenant-specific role labels from all companies.
-- -----------------------------------------------------------------------------
UPDATE public.roles SET name = 'Administrador' WHERE code IN ('ADMIN', 'ADMINISTRATOR');
UPDATE public.roles SET name = 'Gestor' WHERE code IN ('MANAGER', 'MANAGER_LIMITED');

COMMIT;
