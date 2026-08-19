-- MOVAX ERP / POS
-- Persisted operational context: user -> branch -> warehouse -> POS terminal.
-- Prevents sales from silently posting stock to the first warehouse in the tenant.

BEGIN;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS default_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_pos_terminal_id UUID REFERENCES public.pos_terminals(id) ON DELETE SET NULL;

UPDATE public.user_profiles up
SET default_branch_id = COALESCE(
      up.default_branch_id,
      (SELECT ba.branch_id FROM public.branch_access ba JOIN public.branches b ON b.id=ba.branch_id WHERE ba.user_id=up.id AND b.is_active ORDER BY b.is_main DESC, b.code LIMIT 1)
    ),
    default_warehouse_id = COALESCE(
      up.default_warehouse_id,
      (SELECT wa.warehouse_id FROM public.warehouse_access wa JOIN public.warehouses w ON w.id=wa.warehouse_id WHERE wa.user_id=up.id AND w.is_active ORDER BY w.is_default DESC, w.code LIMIT 1)
    );

CREATE OR REPLACE FUNCTION public.set_operational_context_v1(
  p_warehouse_id UUID,
  p_pos_terminal_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id UUID;
  v_warehouse public.warehouses;
  v_branch public.branches;
  v_terminal public.pos_terminals;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  v_company_id := public.get_user_company_id();

  SELECT * INTO v_warehouse
  FROM public.warehouses w
  WHERE w.id = p_warehouse_id
    AND w.company_id = v_company_id
    AND w.is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'WAREHOUSE_NOT_FOUND'; END IF;
  IF NOT (public.has_warehouse_access(v_warehouse.id) OR public.has_permission('settings.manage')) THEN
    RAISE EXCEPTION 'WAREHOUSE_ACCESS_DENIED';
  END IF;

  IF v_warehouse.branch_id IS NOT NULL THEN
    SELECT * INTO v_branch
    FROM public.branches b
    WHERE b.id = v_warehouse.branch_id AND b.company_id = v_company_id AND b.is_active;
  END IF;

  IF v_branch.id IS NULL THEN
    SELECT * INTO v_branch
    FROM public.branches b
    WHERE b.company_id = v_company_id
      AND b.is_active
      AND (public.has_branch_access(b.id) OR public.has_permission('settings.manage'))
    ORDER BY b.is_main DESC, b.code
    LIMIT 1;
  END IF;
  IF v_branch.id IS NULL THEN RAISE EXCEPTION 'BRANCH_CONTEXT_NOT_FOUND'; END IF;

  IF p_pos_terminal_id IS NOT NULL THEN
    SELECT * INTO v_terminal
    FROM public.pos_terminals pt
    WHERE pt.id = p_pos_terminal_id
      AND pt.company_id = v_company_id
      AND pt.is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'POS_TERMINAL_NOT_FOUND'; END IF;
    IF v_terminal.default_warehouse_id <> v_warehouse.id OR v_terminal.branch_id <> v_branch.id THEN
      RAISE EXCEPTION 'POS_TERMINAL_CONTEXT_MISMATCH';
    END IF;
  ELSE
    SELECT * INTO v_terminal
    FROM public.pos_terminals pt
    WHERE pt.company_id = v_company_id
      AND pt.default_warehouse_id = v_warehouse.id
      AND pt.branch_id = v_branch.id
      AND pt.is_active
    ORDER BY pt.terminal_code
    LIMIT 1;
  END IF;

  UPDATE public.user_profiles
  SET default_branch_id = v_branch.id,
      default_warehouse_id = v_warehouse.id,
      default_pos_terminal_id = CASE WHEN v_terminal.id IS NULL THEN NULL ELSE v_terminal.id END,
      updated_at = now()
  WHERE id = auth.uid() AND company_id = v_company_id;

  RETURN jsonb_build_object(
    'branch', jsonb_build_object('id',v_branch.id,'code',v_branch.code,'name',v_branch.name),
    'warehouse', jsonb_build_object('id',v_warehouse.id,'code',v_warehouse.code,'name',v_warehouse.name),
    'pos_terminal', CASE WHEN v_terminal.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id',v_terminal.id,'code',v_terminal.terminal_code,'name',v_terminal.display_name,'series_prefix',v_terminal.invoice_series_prefix
    ) END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_operational_context_v1(UUID,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_operational_context_v1(UUID,UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_current_user_context()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile public.user_profiles;
  v_branch public.branches;
  v_warehouse public.warehouses;
  v_terminal public.pos_terminals;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;

  SELECT * INTO v_profile FROM public.user_profiles WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'USER_PROFILE_NOT_FOUND'; END IF;

  IF v_profile.default_warehouse_id IS NOT NULL THEN
    SELECT * INTO v_warehouse
    FROM public.warehouses w
    WHERE w.id=v_profile.default_warehouse_id
      AND w.company_id=v_profile.company_id
      AND w.is_active
      AND (public.has_warehouse_access(w.id) OR public.has_permission('settings.manage'));
  END IF;

  IF v_warehouse.id IS NULL THEN
    SELECT * INTO v_warehouse
    FROM public.warehouses w
    WHERE w.company_id=v_profile.company_id
      AND w.is_active
      AND (public.has_warehouse_access(w.id) OR public.has_permission('settings.manage'))
    ORDER BY w.is_default DESC, w.code
    LIMIT 1;
  END IF;

  IF v_profile.default_branch_id IS NOT NULL THEN
    SELECT * INTO v_branch
    FROM public.branches b
    WHERE b.id=v_profile.default_branch_id
      AND b.company_id=v_profile.company_id
      AND b.is_active
      AND (public.has_branch_access(b.id) OR public.has_permission('settings.manage'));
  END IF;

  IF v_branch.id IS NULL AND v_warehouse.branch_id IS NOT NULL THEN
    SELECT * INTO v_branch FROM public.branches b
    WHERE b.id=v_warehouse.branch_id AND b.company_id=v_profile.company_id AND b.is_active;
  END IF;

  IF v_branch.id IS NULL THEN
    SELECT * INTO v_branch
    FROM public.branches b
    WHERE b.company_id=v_profile.company_id
      AND b.is_active
      AND (public.has_branch_access(b.id) OR public.has_permission('settings.manage'))
    ORDER BY b.is_main DESC, b.code
    LIMIT 1;
  END IF;

  IF v_profile.default_pos_terminal_id IS NOT NULL THEN
    SELECT * INTO v_terminal
    FROM public.pos_terminals pt
    WHERE pt.id=v_profile.default_pos_terminal_id
      AND pt.company_id=v_profile.company_id
      AND pt.is_active
      AND (v_warehouse.id IS NULL OR pt.default_warehouse_id=v_warehouse.id);
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
      FROM public.branches b
      WHERE b.company_id=v_profile.company_id AND b.is_active
        AND (public.has_branch_access(b.id) OR public.has_permission('settings.manage'))
    ), '[]'::jsonb),
    'warehouses', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', w.id, 'code', w.code, 'name', w.name) ORDER BY w.code)
      FROM public.warehouses w
      WHERE w.company_id=v_profile.company_id AND w.is_active
        AND (public.has_warehouse_access(w.id) OR public.has_permission('settings.manage'))
    ), '[]'::jsonb),
    'active_branch', CASE WHEN v_branch.id IS NULL THEN NULL ELSE jsonb_build_object('id',v_branch.id,'code',v_branch.code,'name',v_branch.name) END,
    'active_warehouse', CASE WHEN v_warehouse.id IS NULL THEN NULL ELSE jsonb_build_object('id',v_warehouse.id,'code',v_warehouse.code,'name',v_warehouse.name) END,
    'active_pos_terminal', CASE WHEN v_terminal.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id',v_terminal.id,'code',v_terminal.terminal_code,'name',v_terminal.display_name,'series_prefix',v_terminal.invoice_series_prefix
    ) END,
    'system_mode', COALESCE((SELECT setting_value FROM public.system_settings WHERE setting_key='SYSTEM_MODE'),'UNKNOWN')
  );
END;
$$;

-- Existing client contract is preserved, but warehouse selection is now user-context aware.
CREATE OR REPLACE FUNCTION public.create_and_confirm_customer_sale_v2(
  p_customer_id UUID,
  p_document_date DATE,
  p_payment_term_code TEXT,
  p_items JSONB,
  p_idempotency_key TEXT,
  p_document_type_code TEXT DEFAULT 'CUSTOMER_INVOICE',
  p_notes TEXT DEFAULT NULL,
  p_general_discount NUMERIC DEFAULT 0
)
RETURNS public.documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_company_id UUID;
  v_branch_id UUID;
  v_warehouse_id UUID;
  v_period_id UUID;
  v_document_type_id UUID;
  v_payment_term_id UUID;
  v_document_id UUID;
  v_result public.documents;
  v_salesperson TEXT;
  v_profile public.user_profiles;
  v_terminal public.pos_terminals;
BEGIN
  PERFORM public.require_operational_mode();
  IF auth.uid() IS NULL OR NOT public.has_permission('sales.create') OR NOT public.has_permission('sales.confirm') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: sales.create and sales.confirm required';
  END IF;
  IF p_document_type_code NOT IN ('CUSTOMER_INVOICE','CASH_SALE','CUSTOMER_DELIVERY_NOTE') THEN
    RAISE EXCEPTION 'INVALID_DOCUMENT_TYPE';
  END IF;

  v_company_id := public.get_user_company_id();
  SELECT * INTO v_result FROM public.documents
  WHERE idempotency_key = p_idempotency_key AND company_id = v_company_id;
  IF FOUND THEN RETURN v_result; END IF;

  SELECT * INTO v_profile FROM public.user_profiles WHERE id=auth.uid() AND company_id=v_company_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'USER_PROFILE_NOT_FOUND_OR_INACTIVE'; END IF;

  IF v_profile.default_pos_terminal_id IS NOT NULL THEN
    SELECT * INTO v_terminal
    FROM public.pos_terminals pt
    WHERE pt.id=v_profile.default_pos_terminal_id AND pt.company_id=v_company_id AND pt.is_active;
    IF FOUND AND (public.has_warehouse_access(v_terminal.default_warehouse_id) OR public.has_permission('settings.manage')) THEN
      v_branch_id := v_terminal.branch_id;
      v_warehouse_id := v_terminal.default_warehouse_id;
    END IF;
  END IF;

  IF v_warehouse_id IS NULL AND v_profile.default_warehouse_id IS NOT NULL THEN
    SELECT w.id, COALESCE(w.branch_id, v_profile.default_branch_id)
    INTO v_warehouse_id, v_branch_id
    FROM public.warehouses w
    WHERE w.id=v_profile.default_warehouse_id
      AND w.company_id=v_company_id
      AND w.is_active
      AND (public.has_warehouse_access(w.id) OR public.has_permission('settings.manage'));
  END IF;

  IF v_warehouse_id IS NULL THEN
    SELECT w.id, COALESCE(w.branch_id, v_profile.default_branch_id)
    INTO v_warehouse_id, v_branch_id
    FROM public.warehouses w
    WHERE w.company_id=v_company_id
      AND w.is_active
      AND (public.has_warehouse_access(w.id) OR public.has_permission('settings.manage'))
    ORDER BY w.is_default DESC, w.code
    LIMIT 1;
  END IF;

  IF v_branch_id IS NULL THEN
    SELECT b.id INTO v_branch_id
    FROM public.branches b
    WHERE b.company_id=v_company_id AND b.is_active
      AND (public.has_branch_access(b.id) OR public.has_permission('settings.manage'))
    ORDER BY b.is_main DESC, b.code
    LIMIT 1;
  END IF;

  SELECT id INTO v_period_id FROM public.fiscal_periods WHERE company_id=v_company_id AND p_document_date BETWEEN start_date AND end_date AND status='open' ORDER BY start_date DESC LIMIT 1;
  SELECT id INTO v_document_type_id FROM public.document_types WHERE company_id=v_company_id AND code=p_document_type_code AND active;
  SELECT id INTO v_payment_term_id FROM public.payment_terms WHERE company_id=v_company_id AND code=COALESCE(NULLIF(TRIM(p_payment_term_code),''),'DINHEIRO') AND active;
  v_salesperson := v_profile.full_name;

  IF v_branch_id IS NULL OR v_warehouse_id IS NULL OR v_period_id IS NULL OR v_document_type_id IS NULL OR v_payment_term_id IS NULL THEN
    RAISE EXCEPTION 'OPERATIONAL_REFERENCE_DATA_INCOMPLETE';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id=p_customer_id AND company_id=v_company_id AND active) THEN
    RAISE EXCEPTION 'CUSTOMER_NOT_FOUND_OR_INACTIVE';
  END IF;

  INSERT INTO public.documents (
    company_id,branch_id,warehouse_id,document_type_id,fiscal_period_id,
    document_date,due_date,customer_id,payment_term_id,status,salesperson_name,
    notes,idempotency_key,created_by,updated_by,general_discount_amount
  ) VALUES (
    v_company_id,v_branch_id,v_warehouse_id,v_document_type_id,v_period_id,
    p_document_date,p_document_date+(SELECT payment_days FROM public.payment_terms WHERE id=v_payment_term_id),
    p_customer_id,v_payment_term_id,'DRAFT',COALESCE(v_salesperson,'Operador Movax'),
    p_notes,p_idempotency_key,auth.uid(),auth.uid(),GREATEST(COALESCE(p_general_discount,0),0)
  ) RETURNING id INTO v_document_id;

  PERFORM private.replace_document_lines_v2(v_document_id,v_company_id,p_items,p_general_discount);
  SELECT * INTO v_result FROM private.confirm_customer_document(v_document_id,p_idempotency_key);
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_and_confirm_customer_sale_v2(UUID,DATE,TEXT,JSONB,TEXT,TEXT,TEXT,NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_and_confirm_customer_sale_v2(UUID,DATE,TEXT,JSONB,TEXT,TEXT,TEXT,NUMERIC) TO authenticated;

COMMIT;
