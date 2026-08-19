-- Migration: 20260806120000_033_quotations_and_document_numbering_closure.sql
-- Description: Seed CUSTOMER_QUOTATION document type, standardize document numbering prefixes (FT, VD, GR, COT),
-- create atomic RPC for quotations, and provide database purge capability for production launch.

BEGIN;

-- 1. Seed CUSTOMER_QUOTATION into document_types if not present
INSERT INTO public.document_types (
    company_id, code, name, direction, party_type, affects_stock, stock_direction,
    affects_customer_account, affects_supplier_account, requires_customer, requires_supplier, active
)
SELECT 
    c.id, 'CUSTOMER_QUOTATION', 'Cotação', 'CUSTOMER', 'CUSTOMER', false, 'NONE',
    false, false, false, false, true
FROM public.companies c
ON CONFLICT (company_id, code) DO NOTHING;

-- 2. Update private.confirm_customer_document to use standard Portuguese ERP prefixes
CREATE OR REPLACE FUNCTION private.confirm_customer_document(
    p_document_id UUID,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS public.documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_doc public.documents;
    v_doc_type public.document_types;
    v_next_num BIGINT;
    v_prefix TEXT;
    v_display_num TEXT;
    v_line RECORD;
    v_stock_posted BOOLEAN := false;
BEGIN
    SELECT * INTO v_doc FROM public.documents WHERE id = p_document_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'DOCUMENT_NOT_FOUND: Document ID % does not exist.', p_document_id;
    END IF;

    IF v_doc.status <> 'DRAFT' THEN
        IF v_doc.idempotency_key IS NOT NULL AND v_doc.idempotency_key = p_idempotency_key THEN
            RETURN v_doc;
        ELSE
            RAISE EXCEPTION 'INVALID_STATUS: Document % is already %.', p_document_id, v_doc.status;
        END IF;
    END IF;

    SELECT * INTO v_doc_type FROM public.document_types WHERE id = v_doc.document_type_id;

    PERFORM public.recalculate_document(p_document_id);
    SELECT * INTO v_doc FROM public.documents WHERE id = p_document_id;

    v_next_num := private.next_document_number(
        v_doc.company_id, v_doc.document_type_id, v_doc.fiscal_period_id, v_doc.series
    );

    v_prefix := CASE 
        WHEN v_doc_type.code = 'CUSTOMER_INVOICE' THEN 'FT'
        WHEN v_doc_type.code = 'CASH_SALE' THEN 'VD'
        WHEN v_doc_type.code = 'CUSTOMER_DELIVERY_NOTE' THEN 'GR'
        WHEN v_doc_type.code IN ('CUSTOMER_QUOTATION', 'QUOTATION', 'COT') THEN 'COT'
        WHEN v_doc_type.code = 'CUSTOMER_CREDIT_NOTE' THEN 'NC'
        ELSE v_doc_type.code
    END;

    v_display_num := v_prefix || '-' || TO_CHAR(v_doc.document_date, 'YYYY') || '/' || LPAD(v_next_num::TEXT, 6, '0');

    -- Take Line Snapshots & Post Stock
    FOR v_line IN SELECT * FROM public.document_lines WHERE document_id = p_document_id LOOP
        IF v_line.stock_effect_enabled AND NOT v_doc.stock_posted THEN
            IF v_doc_type.stock_direction = 'OUT' THEN
                PERFORM public.post_stock_movement(
                    p_company_id := v_doc.company_id,
                    p_product_id := v_line.product_id,
                    p_warehouse_id := v_doc.warehouse_id,
                    p_movement_type := 'sales_exit',
                    p_quantity_in := 0,
                    p_quantity_out := v_line.quantity,
                    p_unit_cost := COALESCE(v_line.unit_cost_snapshot, 0),
                    p_source_document_id := v_doc.id,
                    p_source_document_line_id := v_line.id,
                    p_customer_id := v_doc.customer_id
                );
                v_stock_posted := true;
            ELSIF v_doc_type.stock_direction = 'IN' THEN
                PERFORM public.post_stock_movement(
                    p_company_id := v_doc.company_id,
                    p_product_id := v_line.product_id,
                    p_warehouse_id := v_doc.warehouse_id,
                    p_movement_type := 'customer_return',
                    p_quantity_in := v_line.quantity,
                    p_quantity_out := 0,
                    p_unit_cost := COALESCE(v_line.unit_cost_snapshot, 0),
                    p_source_document_id := v_doc.id,
                    p_source_document_line_id := v_line.id,
                    p_customer_id := v_doc.customer_id
                );
                v_stock_posted := true;
            END IF;
        END IF;
    END LOOP;

    -- Financial Ledger Posting
    IF v_doc_type.affects_customer_account AND NOT v_doc.financial_posted AND v_doc.customer_id IS NOT NULL THEN
        INSERT INTO public.ledger_entries (
            company_id, branch_id, party_type, customer_id, entry_date, due_date,
            entry_type, debit_amount, credit_amount, outstanding_amount, source_document_id, status, created_by
        ) VALUES (
            v_doc.company_id, v_doc.branch_id, 'CUSTOMER', v_doc.customer_id, v_doc.document_date, v_doc.due_date,
            'INVOICE', v_doc.grand_total, 0, v_doc.grand_total, v_doc.id, 'CONFIRMED', v_doc.created_by
        );
        UPDATE public.customers
        SET current_balance = current_balance + v_doc.grand_total,
            updated_at = now()
        WHERE id = v_doc.customer_id;
    END IF;

    UPDATE public.documents
    SET document_number = v_next_num,
        display_number = v_display_num,
        status = 'CONFIRMED',
        stock_posted = v_stock_posted,
        financial_posted = CASE WHEN v_doc_type.affects_customer_account AND v_doc.customer_id IS NOT NULL THEN true ELSE false END,
        updated_by = COALESCE(auth.uid(), v_doc.created_by),
        updated_at = now()
    WHERE id = p_document_id
    RETURNING * INTO v_doc;

    RETURN v_doc;
END;
$$;

-- 3. Create Atomic Quotation Creation RPC
CREATE OR REPLACE FUNCTION public.create_and_confirm_customer_quotation(
    p_customer_id UUID,
    p_document_date DATE,
    p_items JSONB,
    p_notes TEXT,
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
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
    END IF;

    IF NULLIF(TRIM(p_idempotency_key), '') IS NULL THEN
        RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED';
    END IF;

    v_company_id := public.get_user_company_id();

    SELECT b.id INTO v_branch_id
    FROM public.branches b
    WHERE b.company_id = v_company_id AND b.is_active
    ORDER BY b.code LIMIT 1;

    SELECT w.id INTO v_warehouse_id
    FROM public.warehouses w
    WHERE w.company_id = v_company_id AND w.is_active
    ORDER BY w.is_default DESC, w.code LIMIT 1;

    SELECT id INTO v_period_id
    FROM public.fiscal_periods
    WHERE company_id = v_company_id
      AND p_document_date BETWEEN start_date AND end_date
      AND status = 'open'
    ORDER BY start_date DESC LIMIT 1;

    SELECT id INTO v_document_type_id
    FROM public.document_types
    WHERE company_id = v_company_id AND code = 'CUSTOMER_QUOTATION' AND active;

    SELECT id INTO v_payment_term_id
    FROM public.payment_terms
    WHERE company_id = v_company_id AND active LIMIT 1;

    INSERT INTO public.documents (
        company_id, branch_id, warehouse_id, document_type_id, fiscal_period_id,
        document_date, due_date, customer_id, payment_term_id, status,
        notes, idempotency_key, created_by, updated_by
    ) VALUES (
        v_company_id, v_branch_id, v_warehouse_id, v_document_type_id, v_period_id,
        p_document_date, p_document_date + 15,
        p_customer_id, v_payment_term_id, 'DRAFT',
        p_notes, p_idempotency_key, auth.uid(), auth.uid()
    ) RETURNING id INTO v_document_id;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
    LOOP
        v_line_number := v_line_number + 1;
        SELECT * INTO v_product
        FROM public.products
        WHERE id = (v_item->>'article_id')::UUID
          AND company_id = v_company_id
        FOR SHARE;

        v_quantity := (v_item->>'quantity')::NUMERIC;
        v_unit_price := COALESCE((v_item->>'unit_price')::NUMERIC, v_product.sale_price_excl);
        v_discount_pct := COALESCE((v_item->>'discount_percent')::NUMERIC, 0);
        v_tax_rate := COALESCE((v_item->>'iva_percent')::NUMERIC, 16);

        v_gross := v_quantity * v_unit_price;
        v_discount := ROUND(v_gross * v_discount_pct / 100, 2);
        v_net := ROUND(v_gross - v_discount, 2);
        v_tax := ROUND(v_net * v_tax_rate / 100, 2);
        v_total := v_net + v_tax;

        INSERT INTO public.document_lines (
            company_id, document_id, line_number, product_id,
            product_code_snapshot, description_snapshot, unit_code_snapshot,
            quantity, unit_price, discount_percentage, discount_amount,
            tax_rate_snapshot, net_amount, tax_amount, total_amount, unit_cost_snapshot, stock_effect_enabled
        ) VALUES (
            v_company_id, v_document_id, v_line_number, v_product.id,
            COALESCE(v_product.code, v_item->>'code', 'ITEM'),
            COALESCE(v_product.description, v_item->>'description', 'Artigo'),
            'UN',
            v_quantity, v_unit_price, v_discount_pct, v_discount,
            v_tax_rate, v_net, v_tax, v_total, COALESCE(v_product.avg_cost, 0), false
        );
    END LOOP;

    SELECT * INTO v_result
    FROM private.confirm_customer_document(v_document_id, p_idempotency_key);
    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_and_confirm_customer_quotation(UUID, DATE, JSONB, TEXT, TEXT) TO authenticated;

-- 4. RPC to Purge ALL Test Transactions and Reset Sequences
CREATE OR REPLACE FUNCTION public.purge_all_test_transactions()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
BEGIN
    DELETE FROM public.document_lines;
    DELETE FROM public.document_links;
    DELETE FROM public.payment_allocations;
    DELETE FROM public.payments;
    DELETE FROM public.ledger_entries;
    DELETE FROM public.stock_movements;
    DELETE FROM public.documents;
    DELETE FROM public.document_sequences;
    UPDATE public.products SET stock = 0;
    UPDATE public.customers SET current_balance = 0;
    UPDATE public.suppliers SET current_balance = 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_all_test_transactions() TO authenticated;

COMMIT;
