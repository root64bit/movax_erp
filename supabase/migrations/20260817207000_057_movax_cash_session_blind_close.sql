-- Migration: 20260817207000_057_movax_cash_session_blind_close.sql
-- Purpose: simple POS cash shift lifecycle for Mozambique retail:
-- open drawer -> reinforcement/withdrawal -> blind physical close -> variance audit.

BEGIN;

INSERT INTO public.permissions (code, module, description) VALUES
  ('cash.session.view', 'Cash', 'View own cash shifts and drawer status'),
  ('cash.session.open', 'Cash', 'Open a cash shift'),
  ('cash.session.move', 'Cash', 'Register drawer reinforcement and withdrawal'),
  ('cash.session.close', 'Cash', 'Blind-close own cash shift')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code IN ('ADMIN', 'MANAGER', 'CASHIER')
  AND p.code IN ('cash.session.view', 'cash.session.open', 'cash.session.move', 'cash.session.close')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  pos_terminal_id UUID REFERENCES public.pos_terminals(id) ON DELETE SET NULL,
  opened_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  opening_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (opening_amount >= 0),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  closed_by UUID REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  closed_at TIMESTAMPTZ,
  declared_closing_amount NUMERIC(18,2) CHECK (declared_closing_amount >= 0),
  expected_closing_amount NUMERIC(18,2),
  variance_amount NUMERIC(18,2),
  closing_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_session_one_open_per_operator
  ON public.cash_sessions (company_id, opened_by)
  WHERE status = 'OPEN';
CREATE INDEX IF NOT EXISTS idx_cash_sessions_company_opened
  ON public.cash_sessions (company_id, opened_at DESC);

CREATE TABLE IF NOT EXISTS public.cash_session_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  cash_session_id UUID NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('REINFORCEMENT', 'WITHDRAWAL')),
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  note TEXT,
  created_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cash_session_movements_session
  ON public.cash_session_movements (cash_session_id, created_at);

ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_session_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cash_sessions_select ON public.cash_sessions;
CREATE POLICY cash_sessions_select ON public.cash_sessions
FOR SELECT TO authenticated USING (
  company_id = public.get_user_company_id()
  AND public.has_permission('cash.session.view')
  AND (opened_by = auth.uid() OR public.has_permission('settings.manage'))
);

DROP POLICY IF EXISTS cash_session_movements_select ON public.cash_session_movements;
CREATE POLICY cash_session_movements_select ON public.cash_session_movements
FOR SELECT TO authenticated USING (
  company_id = public.get_user_company_id()
  AND EXISTS (
    SELECT 1 FROM public.cash_sessions cs
    WHERE cs.id = cash_session_id
      AND (cs.opened_by = auth.uid() OR public.has_permission('settings.manage'))
  )
);

GRANT SELECT ON public.cash_sessions, public.cash_session_movements TO authenticated;
GRANT ALL ON public.cash_sessions, public.cash_session_movements TO service_role;

CREATE OR REPLACE FUNCTION public.open_cash_session_v1(p_opening_amount NUMERIC DEFAULT 0)
RETURNS public.cash_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_company_id UUID;
  v_profile public.user_profiles;
  v_warehouse public.warehouses;
  v_result public.cash_sessions;
BEGIN
  PERFORM public.require_operational_mode();
  IF auth.uid() IS NULL OR NOT public.has_permission('cash.session.open') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: cash.session.open required';
  END IF;
  IF COALESCE(p_opening_amount, 0) < 0 THEN
    RAISE EXCEPTION 'INVALID_OPENING_AMOUNT';
  END IF;

  v_company_id := public.get_user_company_id();
  IF EXISTS (
    SELECT 1 FROM public.cash_sessions
    WHERE company_id = v_company_id AND opened_by = auth.uid() AND status = 'OPEN'
  ) THEN
    RAISE EXCEPTION 'CASH_SESSION_ALREADY_OPEN';
  END IF;

  SELECT * INTO v_profile FROM public.user_profiles WHERE id = auth.uid();
  SELECT * INTO v_warehouse
  FROM public.warehouses w
  WHERE w.company_id = v_company_id
    AND w.is_active
    AND (
      (w.id = v_profile.default_warehouse_id AND (public.has_warehouse_access(w.id) OR public.has_permission('settings.manage')))
      OR (v_profile.default_warehouse_id IS NULL AND public.has_warehouse_access(w.id))
      OR public.has_permission('settings.manage')
    )
  ORDER BY (w.id = v_profile.default_warehouse_id) DESC, w.is_default DESC, w.code
  LIMIT 1;

  IF v_warehouse.id IS NULL THEN
    RAISE EXCEPTION 'ACTIVE_WAREHOUSE_REQUIRED';
  END IF;

  INSERT INTO public.cash_sessions (
    company_id, branch_id, warehouse_id, pos_terminal_id, opened_by, opening_amount
  ) VALUES (
    v_company_id, v_warehouse.branch_id, v_warehouse.id, v_profile.default_pos_terminal_id,
    auth.uid(), ROUND(COALESCE(p_opening_amount, 0), 2)
  ) RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_cash_session_movement_v1(
  p_movement_type TEXT,
  p_amount NUMERIC,
  p_note TEXT DEFAULT NULL
)
RETURNS public.cash_session_movements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_session public.cash_sessions;
  v_result public.cash_session_movements;
  v_type TEXT := UPPER(TRIM(COALESCE(p_movement_type, '')));
BEGIN
  PERFORM public.require_operational_mode();
  IF auth.uid() IS NULL OR NOT public.has_permission('cash.session.move') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: cash.session.move required';
  END IF;
  IF v_type NOT IN ('REINFORCEMENT', 'WITHDRAWAL') OR COALESCE(p_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'INVALID_CASH_MOVEMENT';
  END IF;
  IF v_type = 'WITHDRAWAL' AND NULLIF(TRIM(COALESCE(p_note, '')), '') IS NULL THEN
    RAISE EXCEPTION 'WITHDRAWAL_REASON_REQUIRED';
  END IF;

  SELECT * INTO v_session
  FROM public.cash_sessions
  WHERE company_id = public.get_user_company_id()
    AND opened_by = auth.uid()
    AND status = 'OPEN'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CASH_SESSION_NOT_OPEN';
  END IF;

  INSERT INTO public.cash_session_movements (
    company_id, cash_session_id, movement_type, amount, note, created_by
  ) VALUES (
    v_session.company_id, v_session.id, v_type, ROUND(p_amount, 2), NULLIF(TRIM(COALESCE(p_note, '')), ''), auth.uid()
  ) RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.close_cash_session_v1(
  p_declared_amount NUMERIC,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.cash_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_session public.cash_sessions;
  v_cash_receipts NUMERIC(18,2) := 0;
  v_cash_payments NUMERIC(18,2) := 0;
  v_reinforcements NUMERIC(18,2) := 0;
  v_withdrawals NUMERIC(18,2) := 0;
  v_expected NUMERIC(18,2);
  v_result public.cash_sessions;
BEGIN
  PERFORM public.require_operational_mode();
  IF auth.uid() IS NULL OR NOT public.has_permission('cash.session.close') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: cash.session.close required';
  END IF;
  IF COALESCE(p_declared_amount, -1) < 0 THEN
    RAISE EXCEPTION 'INVALID_DECLARED_AMOUNT';
  END IF;

  SELECT * INTO v_session
  FROM public.cash_sessions
  WHERE company_id = public.get_user_company_id()
    AND opened_by = auth.uid()
    AND status = 'OPEN'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CASH_SESSION_NOT_OPEN';
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN p.direction = 'CUSTOMER_RECEIPT' THEN pme.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN p.direction = 'SUPPLIER_PAYMENT' THEN pme.amount ELSE 0 END), 0)
  INTO v_cash_receipts, v_cash_payments
  FROM public.payments p
  JOIN public.payment_method_entries pme ON pme.payment_id = p.id
  JOIN public.payment_methods pm ON pm.id = pme.payment_method_id
  WHERE p.company_id = v_session.company_id
    AND p.branch_id = v_session.branch_id
    AND p.created_by = v_session.opened_by
    AND p.created_at >= v_session.opened_at
    AND p.status NOT IN ('DRAFT', 'CANCELLED', 'REVERSED')
    AND pm.method_type = 'CASH';

  SELECT
    COALESCE(SUM(amount) FILTER (WHERE movement_type = 'REINFORCEMENT'), 0),
    COALESCE(SUM(amount) FILTER (WHERE movement_type = 'WITHDRAWAL'), 0)
  INTO v_reinforcements, v_withdrawals
  FROM public.cash_session_movements
  WHERE cash_session_id = v_session.id;

  v_expected := ROUND(
    v_session.opening_amount + v_cash_receipts - v_cash_payments + v_reinforcements - v_withdrawals,
    2
  );

  UPDATE public.cash_sessions
  SET status = 'CLOSED',
      closed_by = auth.uid(),
      closed_at = now(),
      declared_closing_amount = ROUND(p_declared_amount, 2),
      expected_closing_amount = v_expected,
      variance_amount = ROUND(p_declared_amount - v_expected, 2),
      closing_notes = NULLIF(TRIM(COALESCE(p_notes, '')), ''),
      updated_at = now()
  WHERE id = v_session.id
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.open_cash_session_v1(NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_cash_session_movement_v1(TEXT, NUMERIC, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.close_cash_session_v1(NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_cash_session_v1(NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_cash_session_movement_v1(TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_cash_session_v1(NUMERIC, TEXT) TO authenticated;

COMMIT;
