-- MOVAX ERP / POS
-- Migration 058: SaaS Tenant Provisioning, Subscription Overview and Invoicing.

BEGIN;

CREATE TABLE IF NOT EXISTS public.license_billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) NOT NULL,
  period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  period_end TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  plan_code VARCHAR(30) NOT NULL REFERENCES public.subscription_plans(code),
  amount_mzn NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'M_PESA',
  payment_reference VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'PAID' CHECK (status IN ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED')),
  receipt_url TEXT,
  paid_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.license_billing_invoices ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.license_billing_invoices TO authenticated;
GRANT ALL ON public.license_billing_invoices TO service_role;

DROP POLICY IF EXISTS license_billing_invoices_select ON public.license_billing_invoices;
CREATE POLICY license_billing_invoices_select ON public.license_billing_invoices
FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id());

-- Function: get_company_license_overview_v1
CREATE OR REPLACE FUNCTION public.get_company_license_overview_v1()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS \$\$
DECLARE
  v_company_id UUID;
  v_subscription public.company_subscriptions;
  v_plan public.subscription_plans;
  v_users_count INTEGER := 0;
  v_branches_count INTEGER := 0;
  v_warehouses_count INTEGER := 0;
  v_terminals_count INTEGER := 0;
  v_addons JSONB;
  v_invoices JSONB;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  v_company_id := public.get_user_company_id();
  IF v_company_id IS NULL THEN RAISE EXCEPTION 'COMPANY_NOT_FOUND'; END IF;

  SELECT * INTO v_subscription
  FROM public.company_subscriptions
  WHERE company_id = v_company_id;

  IF NOT FOUND THEN
    SELECT * INTO v_plan FROM public.subscription_plans WHERE code = 'BUSINESS';
    v_subscription.plan_code := 'BUSINESS';
    v_subscription.status := 'ACTIVE';
    v_subscription.starts_at := now();
    v_subscription.expires_at := now() + INTERVAL '30 days';
  ELSE
    SELECT * INTO v_plan FROM public.subscription_plans WHERE code = v_subscription.plan_code;
  END IF;

  SELECT count(*) INTO v_users_count FROM public.user_profiles WHERE company_id = v_company_id AND is_active = true;
  SELECT count(*) INTO v_branches_count FROM public.branches WHERE company_id = v_company_id AND is_active = true;
  SELECT count(*) INTO v_warehouses_count FROM public.warehouses WHERE company_id = v_company_id AND is_active = true;
  SELECT count(*) INTO v_terminals_count FROM public.pos_terminals WHERE company_id = v_company_id AND is_active = true;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', ca.id,
    'addon_code', ca.addon_code,
    'is_active', ca.is_active,
    'starts_at', ca.starts_at,
    'expires_at', ca.expires_at
  )), '[]'::jsonb)
  INTO v_addons
  FROM public.company_addons ca
  WHERE ca.company_id = v_company_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', lbi.id,
    'invoice_number', lbi.invoice_number,
    'period_start', lbi.period_start,
    'period_end', lbi.period_end,
    'plan_code', lbi.plan_code,
    'amount_mzn', lbi.amount_mzn,
    'payment_method', lbi.payment_method,
    'payment_reference', lbi.payment_reference,
    'status', lbi.status,
    'paid_at', lbi.paid_at
  ) ORDER BY lbi.created_at DESC), '[]'::jsonb)
  INTO v_invoices
  FROM public.license_billing_invoices lbi
  WHERE lbi.company_id = v_company_id;

  RETURN jsonb_build_object(
    'plan', jsonb_build_object(
      'code', v_plan.code,
      'name', v_plan.name,
      'description', v_plan.description,
      'included_features', v_plan.included_features,
      'max_users', COALESCE(v_subscription.max_users_override, v_plan.max_users),
      'max_branches', COALESCE(v_subscription.max_branches_override, v_plan.max_branches),
      'max_warehouses', COALESCE(v_subscription.max_warehouses_override, v_plan.max_warehouses),
      'max_pos_terminals', COALESCE(v_subscription.max_pos_terminals_override, v_plan.max_pos_terminals)
    ),
    'subscription', jsonb_build_object(
      'status', v_subscription.status,
      'starts_at', v_subscription.starts_at,
      'expires_at', v_subscription.expires_at,
      'days_remaining', GREATEST(0, EXTRACT(DAY FROM (COALESCE(v_subscription.expires_at, now() + INTERVAL '30 days') - now()))::INTEGER)
    ),
    'usage', jsonb_build_object(
      'users_count', v_users_count,
      'branches_count', v_branches_count,
      'warehouses_count', v_warehouses_count,
      'pos_terminals_count', v_terminals_count
    ),
    'addons', v_addons,
    'invoices', v_invoices
  );
END;
\$\$;

REVOKE ALL ON FUNCTION public.get_company_license_overview_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_company_license_overview_v1() TO authenticated;

-- Function: upgrade_subscription_plan_v1
CREATE OR REPLACE FUNCTION public.upgrade_subscription_plan_v1(
  p_plan_code VARCHAR,
  p_cycle VARCHAR DEFAULT 'MONTHLY',
  p_payment_method VARCHAR DEFAULT 'M_PESA',
  p_payment_reference VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS \$\$
DECLARE
  v_company_id UUID;
  v_plan public.subscription_plans;
  v_amount NUMERIC(12,2);
  v_inv_num VARCHAR(50);
  v_new_expires TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF NOT public.has_permission('settings.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  v_company_id := public.get_user_company_id();

  SELECT * INTO v_plan FROM public.subscription_plans WHERE code = UPPER(TRIM(p_plan_code));
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_PLAN_CODE'; END IF;

  IF UPPER(p_plan_code) = 'STARTER' THEN
    v_amount := CASE WHEN UPPER(p_cycle) = 'ANNUAL' THEN 45900.00 ELSE 4500.00 END;
  ELSIF UPPER(p_plan_code) = 'BUSINESS' THEN
    v_amount := CASE WHEN UPPER(p_cycle) = 'ANNUAL' THEN 90780.00 ELSE 8900.00 END;
  ELSIF UPPER(p_plan_code) = 'PRO' THEN
    v_amount := CASE WHEN UPPER(p_cycle) = 'ANNUAL' THEN 141780.00 ELSE 13900.00 END;
  ELSE
    v_amount := 0.00;
  END IF;

  v_new_expires := CASE WHEN UPPER(p_cycle) = 'ANNUAL' THEN now() + INTERVAL '365 days' ELSE now() + INTERVAL '30 days' END;

  INSERT INTO public.company_subscriptions (
    company_id, plan_code, status, starts_at, expires_at, updated_at
  ) VALUES (
    v_company_id, v_plan.code, 'ACTIVE', now(), v_new_expires, now()
  ) ON CONFLICT (company_id) DO UPDATE SET
    plan_code = EXCLUDED.plan_code,
    status = 'ACTIVE',
    expires_at = EXCLUDED.expires_at,
    updated_at = now();

  v_inv_num := 'SUB-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::text from 1 for 6));

  INSERT INTO public.license_billing_invoices (
    company_id, invoice_number, period_start, period_end, plan_code, amount_mzn, payment_method, payment_reference, status
  ) VALUES (
    v_company_id, v_inv_num, now(), v_new_expires, v_plan.code, v_amount, p_payment_method, p_payment_reference, 'PAID'
  );

  RETURN jsonb_build_object(
    'success', true,
    'plan_code', v_plan.code,
    'expires_at', v_new_expires,
    'invoice_number', v_inv_num,
    'amount_mzn', v_amount
  );
END;
\$\$;

REVOKE ALL ON FUNCTION public.upgrade_subscription_plan_v1(VARCHAR, VARCHAR, VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upgrade_subscription_plan_v1(VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO authenticated;

-- Function: toggle_company_addon_v1
CREATE OR REPLACE FUNCTION public.toggle_company_addon_v1(
  p_addon_code VARCHAR,
  p_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS \$\$
DECLARE
  v_company_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF NOT public.has_permission('settings.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  v_company_id := public.get_user_company_id();

  INSERT INTO public.company_addons (
    company_id, addon_code, is_active, starts_at
  ) VALUES (
    v_company_id, UPPER(TRIM(p_addon_code)), p_active, now()
  ) ON CONFLICT (company_id, addon_code) DO UPDATE SET
    is_active = EXCLUDED.is_active;

  RETURN jsonb_build_object('success', true, 'addon_code', p_addon_code, 'is_active', p_active);
END;
\$\$;

REVOKE ALL ON FUNCTION public.toggle_company_addon_v1(VARCHAR, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_company_addon_v1(VARCHAR, BOOLEAN) TO authenticated;

COMMIT;
