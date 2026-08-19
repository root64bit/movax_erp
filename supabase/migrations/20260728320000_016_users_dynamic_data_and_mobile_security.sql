-- Migration: 20260728320000_016_users_dynamic_data_and_mobile_security.sql
-- Purpose: initial-user roles, granular permission aliases, login context,
-- dashboard metrics, access-denial audit, and secure direct stock operations.
-- Does not import legacy data and does not change SYSTEM_MODE.

BEGIN;

INSERT INTO public.permissions (code, module, description) VALUES
  ('dashboard.read', 'Dashboard', 'View authorised operational dashboard'),
  ('products.read', 'Catalogue', 'View articles'),
  ('stock.read', 'Inventory', 'View authorised stock'),
  ('stock.direct_entry', 'Inventory', 'Post direct stock entries'),
  ('stock.direct_exit', 'Inventory', 'Post direct stock exits'),
  ('customers.read', 'Customers', 'View customers'),
  ('suppliers.read', 'Suppliers', 'View suppliers'),
  ('sales.read', 'Sales', 'View sales documents'),
  ('purchases.read', 'Purchases', 'View purchase documents'),
  ('payments.read', 'Payments', 'View payments'),
  ('payments.create', 'Payments', 'Create authorised payments'),
  ('accounts.read', 'Accounts', 'View current accounts'),
  ('reports.read', 'Reports', 'View authorised reports'),
  ('audit.read', 'Audit', 'View authorised audit events'),
  ('migration.read', 'Migration', 'View migration status without execution'),
  ('migration.execute', 'Migration', 'Execute approved migration operations'),
  ('system_mode.manage', 'Administration', 'Change system mode through an approved package')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.roles (company_id, code, name, description, is_system_role)
SELECT id, 'ADMINISTRATOR', 'Administrador Casa de Pneus',
       'Administrative access within operational mode and approval controls', true
FROM public.companies
ON CONFLICT (company_id, code) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description, is_system_role = true;

INSERT INTO public.roles (company_id, code, name, description, is_system_role)
SELECT id, 'MANAGER_LIMITED', 'Gestor Casa de Pneus',
       'Read access plus protected direct stock entry and exit only', true
FROM public.companies
ON CONFLICT (company_id, code) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description, is_system_role = true;

-- Administrator: operational/admin permissions, but no mode change, backup, or
-- legacy execution authority. MIGRATION still blocks normal operational RPCs.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'ADMINISTRATOR'
  AND p.code NOT IN (
    'migration.manage', 'migration.execute', 'system_mode.manage', 'backups.manage'
  )
  AND (p.code NOT LIKE 'migration.%' OR p.code = 'migration.read')
ON CONFLICT DO NOTHING;

-- Manager: exact read surface plus protected direct entry/exit. Legacy codes
-- remain because applied RPC/RLS policies use them; aliases drive new UI.
DELETE FROM public.role_permissions
WHERE role_id IN (SELECT id FROM public.roles WHERE code = 'MANAGER_LIMITED');

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'MANAGER_LIMITED'
  AND p.code IN (
    'dashboard.read',
    'products.read', 'products.view',
    'stock.read', 'stock.view', 'stock.direct_entry', 'stock.direct_exit',
    'stock.entry.confirm', 'stock.exit.confirm',
    'customers.read', 'customers.view', 'customers.view_balance',
    'suppliers.read', 'suppliers.view', 'suppliers.view_balance',
    'sales.read', 'purchases.read', 'documents.view', 'documents.print',
    'payments.read', 'payments.view',
    'accounts.read', 'current_accounts.customer.view', 'current_accounts.supplier.view',
    'reports.read', 'reports.stock', 'reports.sales', 'reports.receivables',
    'reports.payables', 'reports.tax', 'reports.export',
    'audit.read'
  )
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS audit.operational_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  route TEXT,
  reason TEXT,
  idempotency_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_operational_event_idempotency UNIQUE (company_id, idempotency_key)
);

ALTER TABLE audit.operational_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON audit.operational_events TO authenticated;
GRANT ALL ON audit.operational_events TO service_role;

DROP POLICY IF EXISTS operational_events_select ON audit.operational_events;
CREATE POLICY operational_events_select ON audit.operational_events
FOR SELECT TO authenticated
USING (
  company_id = public.get_user_company_id()
  AND (
    user_id = auth.uid()
    OR public.has_permission('audit.view')
    OR public.has_permission('audit.read')
  )
);

CREATE OR REPLACE FUNCTION public.get_public_login_context()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'company_name', c.name,
    'system_mode', COALESCE(
      (SELECT setting_value FROM public.system_settings WHERE setting_key = 'SYSTEM_MODE'),
      'UNKNOWN'
    )
  )
  FROM public.companies c
  ORDER BY c.created_at
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_context()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile public.user_profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;

  SELECT * INTO v_profile FROM public.user_profiles WHERE id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_PROFILE_NOT_FOUND';
  END IF;

  RETURN jsonb_build_object(
    'user_id', v_profile.id,
    'company_id', v_profile.company_id,
    'full_name', v_profile.full_name,
    'email', v_profile.email,
    'is_active', v_profile.is_active,
    'force_password_change', v_profile.force_password_change,
    'roles', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('code', r.code, 'name', r.name) ORDER BY r.code)
      FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
    ), '[]'::jsonb),
    'permissions', to_jsonb(public.get_user_permissions()),
    'branches', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', b.id, 'code', b.code, 'name', b.name) ORDER BY b.code)
      FROM public.branch_access ba JOIN public.branches b ON b.id = ba.branch_id
      WHERE ba.user_id = auth.uid() AND b.is_active
    ), '[]'::jsonb),
    'warehouses', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', w.id, 'code', w.code, 'name', w.name) ORDER BY w.code)
      FROM public.warehouse_access wa JOIN public.warehouses w ON w.id = wa.warehouse_id
      WHERE wa.user_id = auth.uid() AND w.is_active
    ), '[]'::jsonb),
    'system_mode', COALESCE(
      (SELECT setting_value FROM public.system_settings WHERE setting_key = 'SYSTEM_MODE'),
      'UNKNOWN'
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_first_login_password_change()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  UPDATE public.user_profiles
  SET force_password_change = false, updated_at = now()
  WHERE id = auth.uid() AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'USER_INACTIVE_OR_NOT_FOUND'; END IF;
  INSERT INTO public.login_events (user_id, event_type)
  VALUES (auth.uid(), 'password_change_completed');
END;
$$;

CREATE OR REPLACE FUNCTION public.record_access_denied(p_route TEXT, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  INSERT INTO audit.operational_events (
    company_id, user_id, event_type, route, reason
  ) VALUES (
    public.get_user_company_id(), auth.uid(), 'ACCESS_DENIED',
    LEFT(COALESCE(p_route, ''), 250), LEFT(COALESCE(p_reason, ''), 500)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_permission('dashboard.read')
    OR public.has_permission('products.view')
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: dashboard.read';
  END IF;
  v_company_id := public.get_user_company_id();

  RETURN jsonb_build_object(
    'active_products', (SELECT count(*) FROM public.products p WHERE p.company_id = v_company_id AND p.is_active),
    'low_stock_products', (
      SELECT count(*) FROM public.products p
      WHERE p.company_id = v_company_id AND p.is_active
        AND COALESCE((
          SELECT sum(ib.quantity) FROM public.inventory_balances ib
          WHERE ib.product_id = p.id
            AND (
              public.has_warehouse_access(ib.warehouse_id)
              OR NOT EXISTS (SELECT 1 FROM public.warehouse_access wa WHERE wa.user_id = auth.uid())
            )
        ), 0) <= p.min_stock
    ),
    'out_of_stock_products', (
      SELECT count(*) FROM public.products p
      WHERE p.company_id = v_company_id AND p.is_active
        AND COALESCE((SELECT sum(ib.quantity) FROM public.inventory_balances ib WHERE ib.product_id = p.id), 0) = 0
    ),
    'sales_today', (
      SELECT COALESCE(sum(d.grand_total), 0) FROM public.documents d
      JOIN public.document_types dt ON dt.id = d.document_type_id
      WHERE d.company_id = v_company_id AND d.document_date = CURRENT_DATE
        AND dt.party_type = 'CUSTOMER' AND d.status NOT IN ('DRAFT','CANCELLED','REVERSED')
        AND (
          public.has_branch_access(d.branch_id)
          OR NOT EXISTS (SELECT 1 FROM public.branch_access ba WHERE ba.user_id = auth.uid())
        )
    ),
    'receivables', (
      SELECT COALESCE(sum(c.current_balance), 0) FROM public.customers c
      WHERE c.company_id = v_company_id AND c.active AND c.current_balance > 0
    ),
    'payables', (
      SELECT COALESCE(sum(s.current_balance), 0) FROM public.suppliers s
      WHERE s.company_id = v_company_id AND s.active AND s.current_balance > 0
    ),
    'draft_documents', (
      SELECT count(*) FROM public.documents d WHERE d.company_id = v_company_id AND d.status = 'DRAFT'
    ),
    'server_date', CURRENT_DATE
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.post_operational_stock_movement_v2(
  p_warehouse_id UUID,
  p_product_id UUID,
  p_movement_type TEXT,
  p_quantity NUMERIC,
  p_reason TEXT,
  p_reference TEXT,
  p_notes TEXT,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit, pg_temp
AS $$
DECLARE
  v_company_id UUID;
  v_product public.products;
  v_movement_id UUID;
  v_before NUMERIC(18,3);
  v_after NUMERIC(18,3);
  v_existing JSONB;
BEGIN
  PERFORM public.require_operational_mode();
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF p_movement_type = 'direct_entry' AND NOT (
    public.has_permission('stock.direct_entry') OR public.has_permission('stock.entry.confirm')
  ) THEN RAISE EXCEPTION 'PERMISSION_DENIED: stock.direct_entry'; END IF;
  IF p_movement_type = 'direct_exit' AND NOT (
    public.has_permission('stock.direct_exit') OR public.has_permission('stock.exit.confirm')
  ) THEN RAISE EXCEPTION 'PERMISSION_DENIED: stock.direct_exit'; END IF;
  IF p_movement_type NOT IN ('direct_entry', 'direct_exit') OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'INVALID_STOCK_MOVEMENT';
  END IF;
  IF NULLIF(TRIM(p_reason), '') IS NULL OR NULLIF(TRIM(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'REASON_AND_IDEMPOTENCY_REQUIRED';
  END IF;

  v_company_id := public.get_user_company_id();
  IF NOT public.has_warehouse_access(p_warehouse_id)
     AND EXISTS (SELECT 1 FROM public.warehouse_access WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'WAREHOUSE_ACCESS_REQUIRED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.warehouses
    WHERE id = p_warehouse_id AND company_id = v_company_id AND is_active
  ) THEN RAISE EXCEPTION 'WAREHOUSE_NOT_FOUND'; END IF;

  SELECT metadata INTO v_existing FROM audit.operational_events
  WHERE company_id = v_company_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN RETURN v_existing; END IF;

  SELECT * INTO v_product FROM public.products
  WHERE id = p_product_id AND company_id = v_company_id AND is_active
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_FOUND'; END IF;

  SELECT COALESCE(quantity, 0) INTO v_before
  FROM public.inventory_balances
  WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;
  v_before := COALESCE(v_before, 0);

  v_movement_id := public.post_stock_movement(
    p_company_id := v_company_id,
    p_product_id := p_product_id,
    p_warehouse_id := p_warehouse_id,
    p_movement_type := p_movement_type,
    p_quantity_in := CASE WHEN p_movement_type = 'direct_entry' THEN p_quantity ELSE 0 END,
    p_quantity_out := CASE WHEN p_movement_type = 'direct_exit' THEN p_quantity ELSE 0 END,
    p_unit_cost := COALESCE(v_product.avg_cost, 0),
    p_legacy_ref := NULLIF(TRIM(p_reference), '')
  );

  SELECT COALESCE(quantity, 0) INTO v_after
  FROM public.inventory_balances
  WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;

  v_existing := jsonb_build_object(
    'movement_id', v_movement_id,
    'stock_before', v_before,
    'stock_after', COALESCE(v_after, 0),
    'reference', NULLIF(TRIM(p_reference), '')
  );

  INSERT INTO audit.operational_events (
    company_id, user_id, warehouse_id, event_type, resource_type, resource_id,
    reason, idempotency_key, metadata
  ) VALUES (
    v_company_id, auth.uid(), p_warehouse_id,
    CASE WHEN p_movement_type = 'direct_entry' THEN 'DIRECT_STOCK_ENTRY' ELSE 'DIRECT_STOCK_EXIT' END,
    'stock_movement', v_movement_id, TRIM(p_reason), p_idempotency_key,
    v_existing || jsonb_build_object('notes', NULLIF(TRIM(p_notes), ''))
  );
  RETURN v_existing;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_login_context() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_current_user_context() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_first_login_password_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_access_denied(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_dashboard_metrics() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.post_operational_stock_movement_v2(UUID, UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_public_login_context() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_first_login_password_change() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_access_denied(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_operational_stock_movement_v2(UUID, UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMIT;
