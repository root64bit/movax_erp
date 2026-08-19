-- Migration: 20260728280000_012_frontend_operational_api.sql
-- Purpose: authenticated browser-safe operational RPCs for the React application.
-- This migration does not import legacy data and does not change SYSTEM_MODE.

BEGIN;

CREATE OR REPLACE FUNCTION public.require_operational_mode()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_mode TEXT;
BEGIN
    SELECT setting_value INTO v_mode
    FROM public.system_settings
    WHERE setting_key = 'SYSTEM_MODE';

    IF v_mode NOT IN ('PILOT', 'LIVE') THEN
        RAISE EXCEPTION 'OPERATIONAL_MODE_REQUIRED: Current mode is %.', COALESCE(v_mode, 'UNSET');
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_operational_product(p_product JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_company_id UUID;
    v_product_id UUID;
    v_unit_id UUID;
    v_tax_code_id UUID;
BEGIN
    PERFORM public.require_operational_mode();
    IF auth.uid() IS NULL OR NOT public.has_permission('products.create') THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: products.create';
    END IF;

    v_company_id := public.get_user_company_id();

    SELECT id INTO v_unit_id
    FROM public.units_of_measure
    WHERE company_id = v_company_id
      AND abbreviation = COALESCE(NULLIF(TRIM(p_product->>'unit'), ''), 'UN')
    LIMIT 1;

    SELECT id INTO v_tax_code_id
    FROM public.tax_codes
    WHERE company_id = v_company_id AND is_active
    ORDER BY rate DESC, code
    LIMIT 1;

    IF v_unit_id IS NULL OR v_tax_code_id IS NULL THEN
        RAISE EXCEPTION 'REFERENCE_DATA_MISSING: Unit or active tax code.';
    END IF;

    INSERT INTO public.products (
        company_id, code, description, unit_id, tax_code_id, min_stock,
        avg_cost, profit_pct, sale_price_excl, sale_price_incl, notes,
        created_by, updated_by
    ) VALUES (
        v_company_id,
        UPPER(TRIM(p_product->>'code')),
        TRIM(p_product->>'description'),
        v_unit_id,
        v_tax_code_id,
        COALESCE((p_product->>'min_stock')::NUMERIC, 0),
        COALESCE((p_product->>'cost_price')::NUMERIC, 0),
        COALESCE((p_product->>'profit_margin')::NUMERIC, 0),
        COALESCE((p_product->>'sale_price_excl')::NUMERIC, 0),
        COALESCE((p_product->>'sale_price_incl')::NUMERIC, 0),
        NULLIF(TRIM(p_product->>'notes'), ''),
        auth.uid(),
        auth.uid()
    )
    RETURNING id INTO v_product_id;

    RETURN v_product_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.post_operational_stock_movement(
    p_product_id UUID,
    p_movement_type TEXT,
    p_quantity NUMERIC,
    p_document_reference TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_company_id UUID;
    v_warehouse_id UUID;
    v_cost NUMERIC(15,2);
BEGIN
    PERFORM public.require_operational_mode();
    IF auth.uid() IS NULL OR NOT (
        (p_movement_type = 'direct_entry' AND public.has_permission('stock.entry.confirm'))
        OR
        (p_movement_type = 'direct_exit' AND public.has_permission('stock.exit.confirm'))
    ) THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: stock movement';
    END IF;

    IF p_quantity <= 0 OR p_movement_type NOT IN ('direct_entry', 'direct_exit') THEN
        RAISE EXCEPTION 'INVALID_STOCK_MOVEMENT';
    END IF;

    v_company_id := public.get_user_company_id();
    SELECT avg_cost INTO v_cost
    FROM public.products
    WHERE id = p_product_id AND company_id = v_company_id AND is_active;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PRODUCT_NOT_FOUND';
    END IF;

    SELECT w.id INTO v_warehouse_id
    FROM public.warehouses w
    WHERE w.company_id = v_company_id
      AND w.is_active
      AND (
        public.has_warehouse_access(w.id)
        OR NOT EXISTS (
            SELECT 1 FROM public.warehouse_access wa WHERE wa.user_id = auth.uid()
        )
      )
    ORDER BY w.is_default DESC, w.code
    LIMIT 1;

    IF v_warehouse_id IS NULL THEN
        RAISE EXCEPTION 'WAREHOUSE_ACCESS_REQUIRED';
    END IF;

    RETURN public.post_stock_movement(
        p_company_id := v_company_id,
        p_product_id := p_product_id,
        p_warehouse_id := v_warehouse_id,
        p_movement_type := p_movement_type,
        p_quantity_in := CASE WHEN p_movement_type = 'direct_entry' THEN p_quantity ELSE 0 END,
        p_quantity_out := CASE WHEN p_movement_type = 'direct_exit' THEN p_quantity ELSE 0 END,
        p_unit_cost := COALESCE(v_cost, 0),
        p_legacy_ref := NULLIF(TRIM(p_document_reference), '')
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_and_confirm_customer_sale(
    p_customer_id UUID,
    p_document_date DATE,
    p_payment_term_code TEXT,
    p_items JSONB,
    p_idempotency_key TEXT
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
    v_item JSONB;
    v_product public.products;
    v_tax_rate NUMERIC(9,4);
    v_discount_pct NUMERIC(9,4);
    v_quantity NUMERIC(18,3);
    v_unit_price NUMERIC(18,4);
    v_gross NUMERIC(18,4);
    v_discount NUMERIC(18,2);
    v_net NUMERIC(18,2);
    v_tax NUMERIC(18,2);
    v_total NUMERIC(18,2);
    v_line_number INTEGER := 0;
    v_result public.documents;
BEGIN
    PERFORM public.require_operational_mode();
    IF auth.uid() IS NULL
       OR NOT public.has_permission('sales.create')
       OR NOT public.has_permission('sales.confirm') THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: sales.create and sales.confirm required';
    END IF;
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'SALE_LINES_REQUIRED';
    END IF;
    IF NULLIF(TRIM(p_idempotency_key), '') IS NULL THEN
        RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED';
    END IF;

    SELECT * INTO v_result
    FROM public.documents
    WHERE idempotency_key = p_idempotency_key
      AND company_id = public.get_user_company_id();
    IF FOUND THEN
        RETURN v_result;
    END IF;

    v_company_id := public.get_user_company_id();
    IF NOT EXISTS (
        SELECT 1 FROM public.customers
        WHERE id = p_customer_id AND company_id = v_company_id AND active
    ) THEN
        RAISE EXCEPTION 'CUSTOMER_NOT_FOUND';
    END IF;

    SELECT b.id INTO v_branch_id
    FROM public.branches b
    WHERE b.company_id = v_company_id AND b.is_active
      AND (
        public.has_branch_access(b.id)
        OR NOT EXISTS (SELECT 1 FROM public.branch_access ba WHERE ba.user_id = auth.uid())
      )
    ORDER BY b.code LIMIT 1;

    SELECT w.id INTO v_warehouse_id
    FROM public.warehouses w
    WHERE w.company_id = v_company_id AND w.is_active
      AND (
        public.has_warehouse_access(w.id)
        OR NOT EXISTS (SELECT 1 FROM public.warehouse_access wa WHERE wa.user_id = auth.uid())
      )
    ORDER BY w.is_default DESC, w.code LIMIT 1;

    SELECT id INTO v_period_id
    FROM public.fiscal_periods
    WHERE company_id = v_company_id
      AND p_document_date BETWEEN start_date AND end_date
      AND status = 'open'
    ORDER BY start_date DESC LIMIT 1;

    SELECT id INTO v_document_type_id
    FROM public.document_types
    WHERE company_id = v_company_id AND code = 'CUSTOMER_INVOICE' AND active;

    SELECT id INTO v_payment_term_id
    FROM public.payment_terms
    WHERE company_id = v_company_id AND code = p_payment_term_code AND active;

    IF v_branch_id IS NULL OR v_warehouse_id IS NULL OR v_period_id IS NULL
       OR v_document_type_id IS NULL OR v_payment_term_id IS NULL THEN
        RAISE EXCEPTION 'OPERATIONAL_REFERENCE_DATA_INCOMPLETE';
    END IF;

    INSERT INTO public.documents (
        company_id, branch_id, warehouse_id, document_type_id, fiscal_period_id,
        document_date, due_date, customer_id, payment_term_id, status,
        idempotency_key, created_by, updated_by
    ) VALUES (
        v_company_id, v_branch_id, v_warehouse_id, v_document_type_id, v_period_id,
        p_document_date,
        p_document_date + (
            SELECT payment_days FROM public.payment_terms WHERE id = v_payment_term_id
        ),
        p_customer_id, v_payment_term_id, 'DRAFT',
        p_idempotency_key, auth.uid(), auth.uid()
    )
    RETURNING id INTO v_document_id;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
    LOOP
        v_line_number := v_line_number + 1;
        SELECT * INTO v_product
        FROM public.products
        WHERE id = (v_item->>'article_id')::UUID
          AND company_id = v_company_id
          AND is_active
        FOR SHARE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'PRODUCT_NOT_FOUND: %', v_item->>'article_id';
        END IF;

        SELECT rate INTO v_tax_rate FROM public.tax_codes WHERE id = v_product.tax_code_id;
        v_quantity := (v_item->>'quantity')::NUMERIC;
        v_discount_pct := COALESCE((v_item->>'discount_percent')::NUMERIC, 0);
        IF v_quantity <= 0 OR v_discount_pct < 0 OR v_discount_pct > 100 THEN
            RAISE EXCEPTION 'INVALID_SALE_LINE: %', v_line_number;
        END IF;
        IF v_discount_pct > 0 AND NOT public.has_permission('sales.apply_discount') THEN
            RAISE EXCEPTION 'PERMISSION_DENIED: sales.apply_discount';
        END IF;

        v_unit_price := v_product.sale_price_excl;
        v_gross := v_quantity * v_unit_price;
        v_discount := ROUND(v_gross * v_discount_pct / 100, 2);
        v_net := ROUND(v_gross - v_discount, 2);
        v_tax := ROUND(v_net * COALESCE(v_tax_rate, 0) / 100, 2);
        v_total := v_net + v_tax;

        INSERT INTO public.document_lines (
            company_id, document_id, line_number, product_id,
            product_code_snapshot, description_snapshot, unit_code_snapshot,
            quantity, unit_price, discount_percentage, discount_amount,
            tax_code_id, tax_code_snapshot, tax_rate_snapshot,
            net_amount, tax_amount, total_amount, unit_cost_snapshot
        ) VALUES (
            v_company_id, v_document_id, v_line_number, v_product.id,
            v_product.code, v_product.description,
            (SELECT abbreviation FROM public.units_of_measure WHERE id = v_product.unit_id),
            v_quantity, v_unit_price, v_discount_pct, v_discount,
            v_product.tax_code_id,
            (SELECT code FROM public.tax_codes WHERE id = v_product.tax_code_id),
            COALESCE(v_tax_rate, 0), v_net, v_tax, v_total, v_product.avg_cost
        );
    END LOOP;

    SELECT * INTO v_result
    FROM private.confirm_customer_document(v_document_id, p_idempotency_key);
    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_and_confirm_customer_payment(
    p_customer_id UUID,
    p_document_id UUID,
    p_method_code TEXT,
    p_amount NUMERIC,
    p_reference TEXT,
    p_idempotency_key TEXT
)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_document public.documents;
    v_method public.payment_methods;
    v_payment_id UUID;
    v_result public.payments;
BEGIN
    PERFORM public.require_operational_mode();
    IF auth.uid() IS NULL
       OR NOT public.has_permission('payments.receive')
       OR NOT public.has_permission('payments.allocate') THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: payments.receive and payments.allocate required';
    END IF;
    IF p_amount <= 0 OR NULLIF(TRIM(p_idempotency_key), '') IS NULL THEN
        RAISE EXCEPTION 'INVALID_PAYMENT';
    END IF;

    SELECT * INTO v_result
    FROM public.payments
    WHERE company_id = public.get_user_company_id()
      AND idempotency_key = p_idempotency_key;
    IF FOUND THEN
        RETURN v_result;
    END IF;

    SELECT * INTO v_document
    FROM public.documents
    WHERE id = p_document_id
      AND company_id = public.get_user_company_id()
      AND customer_id = p_customer_id
      AND status IN ('CONFIRMED', 'PARTIALLY_PAID', 'OVERDUE')
    FOR UPDATE;
    IF NOT FOUND OR p_amount > v_document.outstanding_amount THEN
        RAISE EXCEPTION 'INVALID_PAYMENT_DOCUMENT_OR_AMOUNT';
    END IF;

    SELECT * INTO v_method
    FROM public.payment_methods
    WHERE (company_id = v_document.company_id OR company_id IS NULL)
      AND code = p_method_code
      AND active
      AND allows_customer_receipt
    ORDER BY company_id NULLS LAST
    LIMIT 1;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PAYMENT_METHOD_NOT_FOUND';
    END IF;
    IF v_method.requires_reference AND NULLIF(TRIM(p_reference), '') IS NULL THEN
        RAISE EXCEPTION 'PAYMENT_REFERENCE_REQUIRED';
    END IF;

    INSERT INTO public.payments (
        company_id, branch_id, fiscal_period_id, payment_date, direction,
        customer_id, total_amount, status, external_reference, description,
        idempotency_key, created_by, updated_by
    ) VALUES (
        v_document.company_id, v_document.branch_id, v_document.fiscal_period_id,
        CURRENT_DATE, 'CUSTOMER_RECEIPT', p_customer_id, p_amount, 'DRAFT',
        NULLIF(TRIM(p_reference), ''), 'Recebimento de ' || v_document.display_number,
        p_idempotency_key, auth.uid(), auth.uid()
    )
    RETURNING id INTO v_payment_id;

    INSERT INTO public.payment_method_entries (
        company_id, payment_id, line_number, payment_method_id, amount, reference
    ) VALUES (
        v_document.company_id, v_payment_id, 1, v_method.id, p_amount,
        NULLIF(TRIM(p_reference), '')
    );

    PERFORM private.confirm_customer_payment(v_payment_id, p_idempotency_key, 'NONE');
    PERFORM private.allocate_payment(v_payment_id, p_document_id, p_amount);

    SELECT * INTO v_result FROM public.payments WHERE id = v_payment_id;
    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.require_operational_mode() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_operational_product(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.post_operational_stock_movement(UUID, TEXT, NUMERIC, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_and_confirm_customer_sale(UUID, DATE, TEXT, JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_and_confirm_customer_payment(UUID, UUID, TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_operational_product(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_operational_stock_movement(UUID, TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_and_confirm_customer_sale(UUID, DATE, TEXT, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_and_confirm_customer_payment(UUID, UUID, TEXT, NUMERIC, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION private.confirm_customer_document(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.confirm_supplier_document(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.confirm_customer_payment(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.confirm_supplier_payment(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.allocate_payment(UUID, UUID, NUMERIC, TEXT) FROM PUBLIC;

COMMIT;
