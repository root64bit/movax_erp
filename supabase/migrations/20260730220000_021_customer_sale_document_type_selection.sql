-- Migration: 20260730220000_021_customer_sale_document_type_selection.sql
-- Purpose: Allow the frontend to specify which customer document type to create
-- (CUSTOMER_INVOICE, CASH_SALE, or CUSTOMER_DELIVERY_NOTE) instead of
-- always hardcoding CUSTOMER_INVOICE.

BEGIN;

-- Drop existing function signature to recreate with new parameter
DROP FUNCTION IF EXISTS public.create_and_confirm_customer_sale(UUID, DATE, TEXT, JSONB, TEXT);

CREATE OR REPLACE FUNCTION public.create_and_confirm_customer_sale(
    p_customer_id UUID,
    p_document_date DATE,
    p_payment_term_code TEXT,
    p_items JSONB,
    p_idempotency_key TEXT,
    p_document_type_code TEXT DEFAULT 'CUSTOMER_INVOICE'
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
    -- Validate document type code
    IF p_document_type_code NOT IN ('CUSTOMER_INVOICE', 'CASH_SALE', 'CUSTOMER_DELIVERY_NOTE') THEN
        RAISE EXCEPTION 'INVALID_DOCUMENT_TYPE: Must be CUSTOMER_INVOICE, CASH_SALE, or CUSTOMER_DELIVERY_NOTE';
    END IF;

    SELECT * INTO v_result
    FROM public.documents
    WHERE idempotency_key = p_idempotency_key
      AND company_id = public.get_user_company_id();
    IF FOUND THEN
        RETURN v_result;
    END IF;

    v_company_id := public.get_user_company_id();

    -- For CUSTOMER_INVOICE and CUSTOMER_DELIVERY_NOTE, customer is required
    -- For CASH_SALE, customer is optional (but we still accept it)
    IF p_document_type_code IN ('CUSTOMER_INVOICE', 'CUSTOMER_DELIVERY_NOTE') THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.customers
            WHERE id = p_customer_id AND company_id = v_company_id AND active
        ) THEN
            RAISE EXCEPTION 'CUSTOMER_NOT_FOUND';
        END IF;
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

    -- Use the requested document type code instead of hardcoded CUSTOMER_INVOICE
    SELECT id INTO v_document_type_id
    FROM public.document_types
    WHERE company_id = v_company_id AND code = p_document_type_code AND active;

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

REVOKE ALL ON FUNCTION public.create_and_confirm_customer_sale(UUID, DATE, TEXT, JSONB, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_and_confirm_customer_sale(UUID, DATE, TEXT, JSONB, TEXT, TEXT) TO authenticated;

COMMIT;
