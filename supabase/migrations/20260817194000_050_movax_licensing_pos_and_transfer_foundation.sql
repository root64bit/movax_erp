-- MOVAX ERP / POS
-- Modular SaaS licensing, POS terminal identity and canonical transfer workflow.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Subscription plans and tenant subscriptions.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  code VARCHAR(30) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  max_users INTEGER,
  max_branches INTEGER,
  max_warehouses INTEGER,
  max_pos_terminals INTEGER,
  included_features TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.company_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_code VARCHAR(30) NOT NULL REFERENCES public.subscription_plans(code),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('TRIAL','ACTIVE','PAST_DUE','SUSPENDED','CANCELLED')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  max_users_override INTEGER,
  max_branches_override INTEGER,
  max_warehouses_override INTEGER,
  max_pos_terminals_override INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_company_subscription UNIQUE (company_id)
);

CREATE TABLE IF NOT EXISTS public.company_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  addon_code VARCHAR(50) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_company_addon UNIQUE (company_id, addon_code)
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_addons ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.subscription_plans TO authenticated;
GRANT SELECT ON public.company_subscriptions, public.company_addons TO authenticated;
GRANT ALL ON public.subscription_plans, public.company_subscriptions, public.company_addons TO service_role;

DROP POLICY IF EXISTS subscription_plans_select ON public.subscription_plans;
CREATE POLICY subscription_plans_select ON public.subscription_plans
FOR SELECT TO authenticated USING (is_active);

DROP POLICY IF EXISTS company_subscriptions_select ON public.company_subscriptions;
CREATE POLICY company_subscriptions_select ON public.company_subscriptions
FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS company_addons_select ON public.company_addons;
CREATE POLICY company_addons_select ON public.company_addons
FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());

INSERT INTO public.subscription_plans (
  code, name, description, max_users, max_branches, max_warehouses, max_pos_terminals, included_features
) VALUES
  ('STARTER', 'Starter', 'Operação base para pequenos negócios', 3, 1, 1, 1, ARRAY['CORE']),
  ('BUSINESS', 'Business', 'Operação comercial com stock, compras e financeiro', 7, 1, 2, 2, ARRAY['CORE','ADVANCED_STOCK','PURCHASES','FINANCIAL']),
  ('PRO', 'Pro', 'Operação multi-filial com BI e segurança avançada', 15, 2, 6, 6, ARRAY['CORE','ADVANCED_STOCK','PURCHASES','FINANCIAL','BI_PRO','MULTI_BRANCH','SECURITY_PRO']),
  ('ENTERPRISE', 'Enterprise', 'Licenciamento completo e limites personalizados', NULL, NULL, NULL, NULL, ARRAY['CORE','ADVANCED_STOCK','PURCHASES','FINANCIAL','BI_PRO','MULTI_BRANCH','SECURITY_PRO','SUPERMARKET_POS','BUTCHER_MODULE','OFFLINE_SYNC','LOCAL_PAYMENTS'])
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  max_users = EXCLUDED.max_users,
  max_branches = EXCLUDED.max_branches,
  max_warehouses = EXCLUDED.max_warehouses,
  max_pos_terminals = EXCLUDED.max_pos_terminals,
  included_features = EXCLUDED.included_features,
  updated_at = now();

-- Preserve all functionality for existing tenants during migration. Commercial
-- downgrades can be performed explicitly after acceptance.
INSERT INTO public.company_subscriptions (company_id, plan_code, status)
SELECT c.id, 'ENTERPRISE', 'ACTIVE'
FROM public.companies c
ON CONFLICT (company_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_company_entitlements()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id UUID;
  v_plan public.subscription_plans;
  v_subscription public.company_subscriptions;
  v_features TEXT[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  v_company_id := public.get_user_company_id();

  SELECT * INTO v_subscription
  FROM public.company_subscriptions cs
  WHERE cs.company_id = v_company_id;

  IF NOT FOUND OR v_subscription.status NOT IN ('TRIAL','ACTIVE') OR (v_subscription.expires_at IS NOT NULL AND v_subscription.expires_at < now()) THEN
    RETURN jsonb_build_object(
      'status', COALESCE(v_subscription.status, 'NONE'),
      'plan', 'NONE',
      'features', '[]'::jsonb,
      'limits', jsonb_build_object('users',0,'branches',0,'warehouses',0,'pos_terminals',0)
    );
  END IF;

  SELECT * INTO v_plan FROM public.subscription_plans WHERE code = v_subscription.plan_code AND is_active;
  v_features := COALESCE(v_plan.included_features, '{}'::TEXT[]);

  SELECT ARRAY(
    SELECT DISTINCT feature
    FROM unnest(
      v_features || COALESCE((
        SELECT array_agg(ca.addon_code)
        FROM public.company_addons ca
        WHERE ca.company_id = v_company_id
          AND ca.is_active
          AND (ca.expires_at IS NULL OR ca.expires_at >= now())
      ), '{}'::TEXT[])
    ) AS feature
    ORDER BY feature
  ) INTO v_features;

  RETURN jsonb_build_object(
    'status', v_subscription.status,
    'plan', v_subscription.plan_code,
    'features', to_jsonb(v_features),
    'limits', jsonb_build_object(
      'users', COALESCE(v_subscription.max_users_override, v_plan.max_users),
      'branches', COALESCE(v_subscription.max_branches_override, v_plan.max_branches),
      'warehouses', COALESCE(v_subscription.max_warehouses_override, v_plan.max_warehouses),
      'pos_terminals', COALESCE(v_subscription.max_pos_terminals_override, v_plan.max_pos_terminals)
    ),
    'expires_at', v_subscription.expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_company_entitlements() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_company_entitlements() TO authenticated;

CREATE OR REPLACE FUNCTION public.has_feature(p_feature TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((public.get_company_entitlements()->'features') ? UPPER(TRIM(p_feature)), false);
$$;

REVOKE ALL ON FUNCTION public.has_feature(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_feature(TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. POS terminals: stable terminal identity, warehouse and fiscal series.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pos_terminals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  default_warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  terminal_code VARCHAR(50) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  invoice_series_prefix VARCHAR(30) NOT NULL,
  device_fingerprint VARCHAR(200),
  last_seen_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_pos_terminal_code UNIQUE (company_id, branch_id, terminal_code),
  CONSTRAINT uq_pos_terminal_series UNIQUE (company_id, invoice_series_prefix)
);

ALTER TABLE public.pos_terminals ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.pos_terminals TO authenticated;
GRANT ALL ON public.pos_terminals TO service_role;

DROP POLICY IF EXISTS pos_terminals_select ON public.pos_terminals;
CREATE POLICY pos_terminals_select ON public.pos_terminals
FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS pos_terminals_write ON public.pos_terminals;
CREATE POLICY pos_terminals_write ON public.pos_terminals
FOR ALL TO authenticated
USING (company_id = public.get_user_company_id() AND public.has_permission('settings.manage'))
WITH CHECK (
  company_id = public.get_user_company_id()
  AND public.has_permission('settings.manage')
  AND EXISTS (SELECT 1 FROM public.branches b WHERE b.id = branch_id AND b.company_id = public.get_user_company_id())
  AND EXISTS (SELECT 1 FROM public.warehouses w WHERE w.id = default_warehouse_id AND w.company_id = public.get_user_company_id())
);

-- -----------------------------------------------------------------------------
-- 3. Canonical stock transfer state machine.
-- -----------------------------------------------------------------------------
ALTER TABLE public.stock_transfers
  ADD COLUMN IF NOT EXISTS transfer_number VARCHAR(60),
  ADD COLUMN IF NOT EXISTS dispatched_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS received_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

UPDATE public.stock_transfers SET status = 'PENDING' WHERE status = 'draft';
UPDATE public.stock_transfers SET status = 'IN_TRANSIT' WHERE status = 'confirmed';
UPDATE public.stock_transfers SET status = 'RECEIVED' WHERE status = 'received';
UPDATE public.stock_transfers SET status = 'CANCELLED' WHERE status = 'cancelled';

DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  SELECT conname INTO v_constraint
  FROM pg_constraint
  WHERE conrelid = 'public.stock_transfers'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%';
  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.stock_transfers DROP CONSTRAINT %I', v_constraint);
  END IF;
END $$;

ALTER TABLE public.stock_transfers
  ALTER COLUMN status SET DEFAULT 'PENDING';

ALTER TABLE public.stock_transfers
  ADD CONSTRAINT stock_transfers_status_check
  CHECK (status IN ('PENDING','IN_TRANSIT','RECEIVED','CANCELLED'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_transfer_number
ON public.stock_transfers(company_id, transfer_number)
WHERE transfer_number IS NOT NULL;

COMMIT;
