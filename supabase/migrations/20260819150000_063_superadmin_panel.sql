BEGIN;

-- 1. Create table subscription_payments
CREATE TABLE IF NOT EXISTS public.subscription_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    plan_code text NOT NULL,
    amount numeric(15,2) NOT NULL,
    method text NOT NULL,
    reference text,
    status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED', 'REFUNDED')),
    provider text,
    paid_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.subscription_payments TO authenticated;
GRANT ALL ON public.subscription_payments TO service_role;

DROP POLICY IF EXISTS subscription_payments_select_policy ON public.subscription_payments;
CREATE POLICY subscription_payments_select_policy ON public.subscription_payments
    FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());

-- 2. get_superadmin_dashboard_v1
CREATE OR REPLACE FUNCTION public.get_superadmin_dashboard_v1()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_active_companies int;
    v_revenue_this_month numeric(15,2);
    v_active_subscriptions int;
    v_pending_payments int;
    v_companies_by_plan jsonb;
    v_recent_activity jsonb;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = auth.uid() AND r.code = 'SUPER_ADMIN'
    ) THEN
        RAISE EXCEPTION 'PERMISSION_DENIED';
    END IF;

    SELECT count(*) INTO v_active_companies FROM public.companies WHERE is_active = true;
    
    SELECT COALESCE(sum(amount), 0) INTO v_revenue_this_month
    FROM public.subscription_payments
    WHERE status = 'CONFIRMED' AND date_trunc('month', paid_at) = date_trunc('month', now());
    
    SELECT count(*) INTO v_active_subscriptions
    FROM public.company_subscriptions WHERE status = 'ACTIVE';
    
    SELECT count(*) INTO v_pending_payments
    FROM public.subscription_payments WHERE status = 'PENDING';
    
    SELECT COALESCE(jsonb_agg(jsonb_build_object('plan', plan_code, 'count', cnt)), '[]'::jsonb)
    INTO v_companies_by_plan
    FROM (
        SELECT plan_code, count(*) as cnt
        FROM public.company_subscriptions
        GROUP BY plan_code
    ) sub;
    
    SELECT COALESCE(jsonb_agg(row_to_json(act)), '[]'::jsonb)
    INTO v_recent_activity
    FROM (
        SELECT sp.id, c.name as company_name, sp.plan_code as description, sp.amount, sp.status, sp.created_at
        FROM public.subscription_payments sp
        JOIN public.companies c ON c.id = sp.company_id
        ORDER BY sp.created_at DESC
        LIMIT 10
    ) act;
    
    RETURN jsonb_build_object(
        'active_companies', v_active_companies,
        'revenue_this_month', v_revenue_this_month,
        'active_subscriptions', v_active_subscriptions,
        'pending_payments', v_pending_payments,
        'companies_by_plan', v_companies_by_plan,
        'recent_activity', v_recent_activity
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_superadmin_dashboard_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_superadmin_dashboard_v1() TO authenticated;

-- 3. get_superadmin_companies_v1
CREATE OR REPLACE FUNCTION public.get_superadmin_companies_v1()
RETURNS SETOF JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = auth.uid() AND r.code = 'SUPER_ADMIN'
    ) THEN
        RAISE EXCEPTION 'PERMISSION_DENIED';
    END IF;
    
    RETURN QUERY
    SELECT row_to_json(t)
    FROM (
        SELECT 
            c.id, c.name, c.tax_number, c.tenant_code, c.email, c.phone, c.city, c.is_active,
            cs.plan_code, cs.status as plan_status,
            (SELECT count(*) FROM public.user_profiles WHERE company_id = c.id) as user_count,
            (SELECT count(*) FROM public.branches WHERE company_id = c.id) as branch_count,
            (SELECT count(*) FROM public.warehouses WHERE company_id = c.id) as warehouse_count,
            (SELECT count(*) FROM public.pos_terminals WHERE company_id = c.id) as pos_terminal_count,
            cs.starts_at as subscription_starts_at,
            cs.expires_at as subscription_expires_at,
            (SELECT amount FROM public.subscription_payments sp WHERE sp.company_id = c.id AND sp.status = 'CONFIRMED' ORDER BY paid_at DESC LIMIT 1) as last_payment_amount,
            (SELECT paid_at FROM public.subscription_payments sp WHERE sp.company_id = c.id AND sp.status = 'CONFIRMED' ORDER BY paid_at DESC LIMIT 1) as last_payment_date
        FROM public.companies c
        LEFT JOIN public.company_subscriptions cs ON cs.company_id = c.id
    ) t;
END;
$$;

REVOKE ALL ON FUNCTION public.get_superadmin_companies_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_superadmin_companies_v1() TO authenticated;

-- 4. get_superadmin_payments_v1
CREATE OR REPLACE FUNCTION public.get_superadmin_payments_v1(p_status text DEFAULT NULL, p_method text DEFAULT NULL, p_company_id uuid DEFAULT NULL)
RETURNS SETOF JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = auth.uid() AND r.code = 'SUPER_ADMIN'
    ) THEN
        RAISE EXCEPTION 'PERMISSION_DENIED';
    END IF;
    
    RETURN QUERY
    SELECT row_to_json(t)
    FROM (
        SELECT 
            sp.id, c.name as company_name, sp.plan_code, sp.method, sp.reference, sp.amount, sp.status, sp.paid_at, sp.created_at
        FROM public.subscription_payments sp
        JOIN public.companies c ON c.id = sp.company_id
        WHERE (p_status IS NULL OR sp.status = p_status)
            AND (p_method IS NULL OR sp.method = p_method)
            AND (p_company_id IS NULL OR sp.company_id = p_company_id)
        ORDER BY sp.created_at DESC
    ) t;
END;
$$;

REVOKE ALL ON FUNCTION public.get_superadmin_payments_v1(text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_superadmin_payments_v1(text, text, uuid) TO authenticated;

-- 5. get_superadmin_revenue_chart_v1
CREATE OR REPLACE FUNCTION public.get_superadmin_revenue_chart_v1(p_months int DEFAULT 12)
RETURNS SETOF JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = auth.uid() AND r.code = 'SUPER_ADMIN'
    ) THEN
        RAISE EXCEPTION 'PERMISSION_DENIED';
    END IF;
    
    RETURN QUERY
    SELECT row_to_json(t)
    FROM (
        SELECT 
            EXTRACT(MONTH FROM paid_at)::int as month,
            EXTRACT(YEAR FROM paid_at)::int as year,
            SUM(amount) as total
        FROM public.subscription_payments
        WHERE status = 'CONFIRMED' AND paid_at >= (now() - (p_months || ' months')::interval)
        GROUP BY year, month
        ORDER BY year, month
    ) t;
END;
$$;

REVOKE ALL ON FUNCTION public.get_superadmin_revenue_chart_v1(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_superadmin_revenue_chart_v1(int) TO authenticated;

-- 6. Add seed data
INSERT INTO public.subscription_payments (company_id, plan_code, amount, method, reference, status, paid_at)
SELECT id, 'PRO', 13900.00, 'M-Pesa', 'MPESA123', 'CONFIRMED', now()
FROM public.companies WHERE tenant_code = '1001'
ON CONFLICT DO NOTHING;

INSERT INTO public.subscription_payments (company_id, plan_code, amount, method, reference, status, paid_at)
SELECT id, 'INTERNAL', 0.00, 'internal', 'INT-001', 'CONFIRMED', now()
FROM public.companies WHERE tenant_code = '0001'
ON CONFLICT DO NOTHING;

COMMIT;
