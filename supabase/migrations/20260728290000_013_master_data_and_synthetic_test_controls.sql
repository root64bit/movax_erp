-- Migration: 20260728290000_013_master_data_and_synthetic_test_controls.sql
-- Purpose: operational customer/supplier APIs and rollback-only synthetic test control.
-- Does not change SYSTEM_MODE.

BEGIN;

CREATE OR REPLACE FUNCTION public.require_operational_mode()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_mode TEXT;
    v_synthetic_test BOOLEAN;
BEGIN
    SELECT setting_value INTO v_mode
    FROM public.system_settings
    WHERE setting_key = 'SYSTEM_MODE';

    v_synthetic_test :=
        COALESCE(current_setting('app.synthetic_test_mode', true), 'off') = 'on';

    IF v_mode IN ('PILOT', 'LIVE') THEN
        RETURN;
    END IF;

    IF v_mode = 'MIGRATION'
       AND v_synthetic_test
       AND auth.uid() IS NOT NULL
       AND public.has_permission('migration.manage') THEN
        RETURN;
    END IF;

    RAISE EXCEPTION 'OPERATIONAL_MODE_REQUIRED: Current mode is %.', COALESCE(v_mode, 'UNSET');
END;
$$;

COMMENT ON FUNCTION public.require_operational_mode() IS
'Allows normal operations only in PILOT/LIVE. MIGRATION is allowed solely for migration administrators inside sessions that explicitly SET LOCAL app.synthetic_test_mode = on; test transactions must be rolled back.';

CREATE OR REPLACE FUNCTION public.create_operational_customer(p_customer JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_company_id UUID;
    v_customer_id UUID;
    v_payment_term_id UUID;
BEGIN
    PERFORM public.require_operational_mode();
    IF auth.uid() IS NULL OR NOT public.has_permission('customers.create') THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: customers.create';
    END IF;

    v_company_id := public.get_user_company_id();
    SELECT id INTO v_payment_term_id
    FROM public.payment_terms
    WHERE company_id = v_company_id
      AND code = COALESCE(NULLIF(TRIM(p_customer->>'payment_term_code'), ''), 'DINHEIRO')
      AND active
    LIMIT 1;
    IF v_payment_term_id IS NULL THEN
        RAISE EXCEPTION 'PAYMENT_TERM_NOT_FOUND';
    END IF;

    INSERT INTO public.customers (
        company_id, customer_number, name, trade_name, tax_number, telephone,
        mobile_phone, email, payment_term_id, credit_limit, notes,
        created_by, updated_by
    ) VALUES (
        v_company_id,
        UPPER(TRIM(p_customer->>'number')),
        TRIM(p_customer->>'name'),
        NULLIF(TRIM(p_customer->>'trade_name'), ''),
        NULLIF(TRIM(p_customer->>'tax_number'), ''),
        NULLIF(TRIM(p_customer->>'telephone'), ''),
        NULLIF(TRIM(p_customer->>'mobile_phone'), ''),
        NULLIF(LOWER(TRIM(p_customer->>'email')), ''),
        v_payment_term_id,
        COALESCE((p_customer->>'credit_limit')::NUMERIC, 0),
        NULLIF(TRIM(p_customer->>'notes'), ''),
        auth.uid(),
        auth.uid()
    )
    RETURNING id INTO v_customer_id;

    IF NULLIF(TRIM(p_customer->>'address'), '') IS NOT NULL THEN
        INSERT INTO public.customer_addresses (
            company_id, customer_id, address_type, address_line_1,
            city, country_code, is_primary
        ) VALUES (
            v_company_id, v_customer_id, 'GENERAL',
            TRIM(p_customer->>'address'),
            NULLIF(TRIM(p_customer->>'city'), ''),
            'MZ', true
        );
    END IF;

    RETURN v_customer_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_operational_supplier(p_supplier JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_company_id UUID;
    v_supplier_id UUID;
    v_payment_term_id UUID;
BEGIN
    PERFORM public.require_operational_mode();
    IF auth.uid() IS NULL OR NOT public.has_permission('suppliers.create') THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: suppliers.create';
    END IF;

    v_company_id := public.get_user_company_id();
    SELECT id INTO v_payment_term_id
    FROM public.payment_terms
    WHERE company_id = v_company_id
      AND code = COALESCE(NULLIF(TRIM(p_supplier->>'payment_term_code'), ''), 'DINHEIRO')
      AND active
    LIMIT 1;
    IF v_payment_term_id IS NULL THEN
        RAISE EXCEPTION 'PAYMENT_TERM_NOT_FOUND';
    END IF;

    INSERT INTO public.suppliers (
        company_id, supplier_number, name, trade_name, tax_number, telephone,
        mobile_phone, email, payment_term_id, credit_limit, contact_person,
        notes, created_by, updated_by
    ) VALUES (
        v_company_id,
        UPPER(TRIM(p_supplier->>'number')),
        TRIM(p_supplier->>'name'),
        NULLIF(TRIM(p_supplier->>'trade_name'), ''),
        NULLIF(TRIM(p_supplier->>'tax_number'), ''),
        NULLIF(TRIM(p_supplier->>'telephone'), ''),
        NULLIF(TRIM(p_supplier->>'mobile_phone'), ''),
        NULLIF(LOWER(TRIM(p_supplier->>'email')), ''),
        v_payment_term_id,
        COALESCE((p_supplier->>'credit_limit')::NUMERIC, 0),
        NULLIF(TRIM(p_supplier->>'contact_person'), ''),
        NULLIF(TRIM(p_supplier->>'notes'), ''),
        auth.uid(),
        auth.uid()
    )
    RETURNING id INTO v_supplier_id;

    IF NULLIF(TRIM(p_supplier->>'address'), '') IS NOT NULL THEN
        INSERT INTO public.supplier_addresses (
            company_id, supplier_id, address_type, address_line_1,
            city, country_code, is_primary
        ) VALUES (
            v_company_id, v_supplier_id, 'GENERAL',
            TRIM(p_supplier->>'address'),
            NULLIF(TRIM(p_supplier->>'city'), ''),
            'MZ', true
        );
    END IF;

    RETURN v_supplier_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_operational_customer(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_operational_supplier(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_operational_customer(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_operational_supplier(JSONB) TO authenticated;

COMMIT;
