-- Migration: 20260728230000_007a_document_engine_closure.sql
-- Description: PROD-WP08A corrective migration implementing credit/debit/return document generation RPCs, stock availability checks, and link validation.
-- Target Database: bkbcgndzsfylwsinxwbb (Production Pre-Live Mode)

BEGIN;

-- 1. CREATE CUSTOMER CREDIT NOTE FROM DOCUMENT
CREATE OR REPLACE FUNCTION private.create_customer_credit_note_from_document(
    p_source_document_id UUID,
    p_reason TEXT,
    p_return_stock BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_src public.documents;
    v_type_id UUID;
    v_new_doc_id UUID;
    v_line RECORD;
BEGIN
    SELECT * INTO v_src FROM public.documents WHERE id = p_source_document_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'SOURCE_NOT_FOUND: Source document ID % not found.', p_source_document_id;
    END IF;

    IF v_src.status NOT IN ('CONFIRMED', 'PAID', 'PARTIALLY_PAID') THEN
        RAISE EXCEPTION 'INVALID_SOURCE_STATUS: Cannot create credit note from document in status %.', v_src.status;
    END IF;

    SELECT id INTO v_type_id FROM public.document_types WHERE code = 'CUSTOMER_CREDIT_NOTE';

    -- Create DRAFT Credit Note
    INSERT INTO public.documents (
        company_id, branch_id, warehouse_id, document_type_id, fiscal_period_id,
        series, document_date, customer_id, payment_term_id, source_document_id,
        salesperson_name, notes, status, created_by
    ) VALUES (
        v_src.company_id, v_src.branch_id, v_src.warehouse_id, v_type_id, v_src.fiscal_period_id,
        v_src.series, CURRENT_DATE, v_src.customer_id, v_src.payment_term_id, v_src.id,
        v_src.salesperson_name, p_reason, 'DRAFT', COALESCE(auth.uid(), v_src.created_by)
    ) RETURNING id INTO v_new_doc_id;

    -- Copy Lines
    FOR v_line IN SELECT * FROM public.document_lines WHERE document_id = p_source_document_id LOOP
        INSERT INTO public.document_lines (
            company_id, document_id, line_number, product_id, product_code_snapshot,
            description_snapshot, unit_code_snapshot, quantity, unit_price,
            discount_percentage, discount_amount, tax_code_id, tax_code_snapshot,
            tax_rate_snapshot, net_amount, tax_amount, total_amount, unit_cost_snapshot,
            stock_effect_enabled, source_document_line_id
        ) VALUES (
            v_src.company_id, v_new_doc_id, v_line.line_number, v_line.product_id, v_line.product_code_snapshot,
            v_line.description_snapshot, v_line.unit_code_snapshot, v_line.quantity, v_line.unit_price,
            v_line.discount_percentage, v_line.discount_amount, v_line.tax_code_id, v_line.tax_code_snapshot,
            v_line.tax_rate_snapshot, v_line.net_amount, v_line.tax_amount, v_line.total_amount, v_line.unit_cost_snapshot,
            p_return_stock, v_line.id
        );
    END LOOP;

    -- Recalculate Totals
    PERFORM public.recalculate_document(v_new_doc_id);

    -- Create Document Link
    INSERT INTO public.document_links (
        company_id, source_document_id, target_document_id, link_type, created_by
    ) VALUES (
        v_src.company_id, v_src.id, v_new_doc_id, 'INVOICE_TO_CREDIT_NOTE', COALESCE(auth.uid(), v_src.created_by)
    );

    RETURN v_new_doc_id;
END;
$$;

-- UPDATE CONFIRM_CUSTOMER_DOCUMENT TO RESPECT LINE STOCK_EFFECT_ENABLED EVEN IF DOC TYPE DEFAULT IS FALSE (FOR CREDIT NOTES)
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
    v_display_num TEXT;
    v_line RECORD;
    v_new_bal NUMERIC(18,2);
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
    v_display_num := v_doc_type.code || ' ' || v_doc.series || '/' || LPAD(v_next_num::TEXT, 6, '0');

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
            v_doc_type.code, 
            CASE WHEN v_doc_type.code IN ('CUSTOMER_INVOICE', 'CASH_SALE', 'CUSTOMER_DEBIT_NOTE') THEN v_doc.grand_total ELSE 0.00 END,
            CASE WHEN v_doc_type.code = 'CUSTOMER_CREDIT_NOTE' THEN v_doc.grand_total ELSE 0.00 END,
            v_doc.grand_total, v_doc.id, 'CONFIRMED', COALESCE(auth.uid(), v_doc.created_by)
        );

        SELECT COALESCE(SUM(debit_amount - credit_amount), 0.00) INTO v_new_bal
        FROM public.ledger_entries WHERE customer_id = v_doc.customer_id AND status = 'CONFIRMED';
        
        UPDATE public.customers SET current_balance = v_new_bal, updated_at = now() WHERE id = v_doc.customer_id;
    END IF;

    INSERT INTO public.document_status_history (
        company_id, document_id, previous_status, new_status, reason, changed_by
    ) VALUES (
        v_doc.company_id, v_doc.id, 'DRAFT', 'CONFIRMED', 'Document confirmation', COALESCE(auth.uid(), v_doc.created_by)
    );

    UPDATE public.documents
    SET status = 'CONFIRMED',
        document_number = v_next_num,
        display_number = v_display_num,
        stock_posted = v_stock_posted OR stock_posted,
        financial_posted = CASE WHEN v_doc_type.affects_customer_account THEN true ELSE financial_posted END,
        confirmed_by = COALESCE(auth.uid(), v_doc.created_by),
        confirmed_at = now(),
        idempotency_key = COALESCE(p_idempotency_key, idempotency_key),
        updated_at = now()
    WHERE id = p_document_id
    RETURNING * INTO v_doc;

    RETURN v_doc;
END;
$$;

-- 2. CREATE CUSTOMER DEBIT NOTE FROM DOCUMENT
CREATE OR REPLACE FUNCTION private.create_customer_debit_note_from_document(
    p_source_document_id UUID,
    p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_src public.documents;
    v_type_id UUID;
    v_new_doc_id UUID;
    v_line RECORD;
BEGIN
    SELECT * INTO v_src FROM public.documents WHERE id = p_source_document_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'SOURCE_NOT_FOUND: Source document ID % not found.', p_source_document_id;
    END IF;

    SELECT id INTO v_type_id FROM public.document_types WHERE code = 'CUSTOMER_DEBIT_NOTE';

    INSERT INTO public.documents (
        company_id, branch_id, warehouse_id, document_type_id, fiscal_period_id,
        series, document_date, customer_id, payment_term_id, source_document_id,
        notes, status, created_by
    ) VALUES (
        v_src.company_id, v_src.branch_id, v_src.warehouse_id, v_type_id, v_src.fiscal_period_id,
        v_src.series, CURRENT_DATE, v_src.customer_id, v_src.payment_term_id, v_src.id,
        p_reason, 'DRAFT', COALESCE(auth.uid(), v_src.created_by)
    ) RETURNING id INTO v_new_doc_id;

    FOR v_line IN SELECT * FROM public.document_lines WHERE document_id = p_source_document_id LOOP
        INSERT INTO public.document_lines (
            company_id, document_id, line_number, product_id, product_code_snapshot,
            description_snapshot, unit_code_snapshot, quantity, unit_price,
            discount_percentage, discount_amount, tax_code_id, tax_code_snapshot,
            tax_rate_snapshot, net_amount, tax_amount, total_amount, unit_cost_snapshot,
            stock_effect_enabled, source_document_line_id
        ) VALUES (
            v_src.company_id, v_new_doc_id, v_line.line_number, v_line.product_id, v_line.product_code_snapshot,
            v_line.description_snapshot, v_line.unit_code_snapshot, v_line.quantity, v_line.unit_price,
            v_line.discount_percentage, v_line.discount_amount, v_line.tax_code_id, v_line.tax_code_snapshot,
            v_line.tax_rate_snapshot, v_line.net_amount, v_line.tax_amount, v_line.total_amount, v_line.unit_cost_snapshot,
            false, v_line.id
        );
    END LOOP;

    PERFORM public.recalculate_document(v_new_doc_id);

    INSERT INTO public.document_links (
        company_id, source_document_id, target_document_id, link_type, created_by
    ) VALUES (
        v_src.company_id, v_src.id, v_new_doc_id, 'INVOICE_TO_DEBIT_NOTE', COALESCE(auth.uid(), v_src.created_by)
    );

    RETURN v_new_doc_id;
END;
$$;

-- 3. CREATE SUPPLIER CREDIT ADVICE FROM DOCUMENT
CREATE OR REPLACE FUNCTION private.create_supplier_credit_advice_from_document(
    p_source_document_id UUID,
    p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_src public.documents;
    v_type_id UUID;
    v_new_doc_id UUID;
    v_line RECORD;
BEGIN
    SELECT * INTO v_src FROM public.documents WHERE id = p_source_document_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'SOURCE_NOT_FOUND: Source document ID % not found.', p_source_document_id;
    END IF;

    SELECT id INTO v_type_id FROM public.document_types WHERE code = 'SUPPLIER_CREDIT_ADVICE';

    INSERT INTO public.documents (
        company_id, branch_id, warehouse_id, document_type_id, fiscal_period_id,
        series, document_date, supplier_id, payment_term_id, source_document_id,
        notes, status, created_by
    ) VALUES (
        v_src.company_id, v_src.branch_id, v_src.warehouse_id, v_type_id, v_src.fiscal_period_id,
        v_src.series, CURRENT_DATE, v_src.supplier_id, v_src.payment_term_id, v_src.id,
        p_reason, 'DRAFT', COALESCE(auth.uid(), v_src.created_by)
    ) RETURNING id INTO v_new_doc_id;

    FOR v_line IN SELECT * FROM public.document_lines WHERE document_id = p_source_document_id LOOP
        INSERT INTO public.document_lines (
            company_id, document_id, line_number, product_id, product_code_snapshot,
            description_snapshot, unit_code_snapshot, quantity, unit_price,
            discount_percentage, discount_amount, tax_code_id, tax_code_snapshot,
            tax_rate_snapshot, net_amount, tax_amount, total_amount, unit_cost_snapshot,
            stock_effect_enabled, source_document_line_id
        ) VALUES (
            v_src.company_id, v_new_doc_id, v_line.line_number, v_line.product_id, v_line.product_code_snapshot,
            v_line.description_snapshot, v_line.unit_code_snapshot, v_line.quantity, v_line.unit_price,
            v_line.discount_percentage, v_line.discount_amount, v_line.tax_code_id, v_line.tax_code_snapshot,
            v_line.tax_rate_snapshot, v_line.net_amount, v_line.tax_amount, v_line.total_amount, v_line.unit_cost_snapshot,
            false, v_line.id
        );
    END LOOP;

    PERFORM public.recalculate_document(v_new_doc_id);

    INSERT INTO public.document_links (
        company_id, source_document_id, target_document_id, link_type, created_by
    ) VALUES (
        v_src.company_id, v_src.id, v_new_doc_id, 'SUPPLIER_INVOICE_TO_CREDIT', COALESCE(auth.uid(), v_src.created_by)
    );

    RETURN v_new_doc_id;
END;
$$;

-- 4. CREATE SUPPLIER DEBIT ADVICE FROM DOCUMENT
CREATE OR REPLACE FUNCTION private.create_supplier_debit_advice_from_document(
    p_source_document_id UUID,
    p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_src public.documents;
    v_type_id UUID;
    v_new_doc_id UUID;
    v_line RECORD;
BEGIN
    SELECT * INTO v_src FROM public.documents WHERE id = p_source_document_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'SOURCE_NOT_FOUND: Source document ID % not found.', p_source_document_id;
    END IF;

    SELECT id INTO v_type_id FROM public.document_types WHERE code = 'SUPPLIER_DEBIT_ADVICE';

    INSERT INTO public.documents (
        company_id, branch_id, warehouse_id, document_type_id, fiscal_period_id,
        series, document_date, supplier_id, payment_term_id, source_document_id,
        notes, status, created_by
    ) VALUES (
        v_src.company_id, v_src.branch_id, v_src.warehouse_id, v_type_id, v_src.fiscal_period_id,
        v_src.series, CURRENT_DATE, v_src.supplier_id, v_src.payment_term_id, v_src.id,
        p_reason, 'DRAFT', COALESCE(auth.uid(), v_src.created_by)
    ) RETURNING id INTO v_new_doc_id;

    FOR v_line IN SELECT * FROM public.document_lines WHERE document_id = p_source_document_id LOOP
        INSERT INTO public.document_lines (
            company_id, document_id, line_number, product_id, product_code_snapshot,
            description_snapshot, unit_code_snapshot, quantity, unit_price,
            discount_percentage, discount_amount, tax_code_id, tax_code_snapshot,
            tax_rate_snapshot, net_amount, tax_amount, total_amount, unit_cost_snapshot,
            stock_effect_enabled, source_document_line_id
        ) VALUES (
            v_src.company_id, v_new_doc_id, v_line.line_number, v_line.product_id, v_line.product_code_snapshot,
            v_line.description_snapshot, v_line.unit_code_snapshot, v_line.quantity, v_line.unit_price,
            v_line.discount_percentage, v_line.discount_amount, v_line.tax_code_id, v_line.tax_code_snapshot,
            v_line.tax_rate_snapshot, v_line.net_amount, v_line.tax_amount, v_line.total_amount, v_line.unit_cost_snapshot,
            false, v_line.id
        );
    END LOOP;

    PERFORM public.recalculate_document(v_new_doc_id);

    INSERT INTO public.document_links (
        company_id, source_document_id, target_document_id, link_type, created_by
    ) VALUES (
        v_src.company_id, v_src.id, v_new_doc_id, 'SUPPLIER_INVOICE_TO_DEBIT', COALESCE(auth.uid(), v_src.created_by)
    );

    RETURN v_new_doc_id;
END;
$$;

-- 5. CREATE SUPPLIER RETURN FROM DOCUMENT
CREATE OR REPLACE FUNCTION private.create_supplier_return_from_document(
    p_source_document_id UUID,
    p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_src public.documents;
    v_type_id UUID;
    v_new_doc_id UUID;
    v_line RECORD;
BEGIN
    SELECT * INTO v_src FROM public.documents WHERE id = p_source_document_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'SOURCE_NOT_FOUND: Source document ID % not found.', p_source_document_id;
    END IF;

    SELECT id INTO v_type_id FROM public.document_types WHERE code = 'SUPPLIER_RETURN';

    INSERT INTO public.documents (
        company_id, branch_id, warehouse_id, document_type_id, fiscal_period_id,
        series, document_date, supplier_id, payment_term_id, source_document_id,
        notes, status, created_by
    ) VALUES (
        v_src.company_id, v_src.branch_id, v_src.warehouse_id, v_type_id, v_src.fiscal_period_id,
        v_src.series, CURRENT_DATE, v_src.supplier_id, v_src.payment_term_id, v_src.id,
        p_reason, 'DRAFT', COALESCE(auth.uid(), v_src.created_by)
    ) RETURNING id INTO v_new_doc_id;

    FOR v_line IN SELECT * FROM public.document_lines WHERE document_id = p_source_document_id LOOP
        INSERT INTO public.document_lines (
            company_id, document_id, line_number, product_id, product_code_snapshot,
            description_snapshot, unit_code_snapshot, quantity, unit_price,
            discount_percentage, discount_amount, tax_code_id, tax_code_snapshot,
            tax_rate_snapshot, net_amount, tax_amount, total_amount, unit_cost_snapshot,
            stock_effect_enabled, source_document_line_id
        ) VALUES (
            v_src.company_id, v_new_doc_id, v_line.line_number, v_line.product_id, v_line.product_code_snapshot,
            v_line.description_snapshot, v_line.unit_code_snapshot, v_line.quantity, v_line.unit_price,
            v_line.discount_percentage, v_line.discount_amount, v_line.tax_code_id, v_line.tax_code_snapshot,
            v_line.tax_rate_snapshot, v_line.net_amount, v_line.tax_amount, v_line.total_amount, v_line.unit_cost_snapshot,
            true, v_line.id
        );
    END LOOP;

    PERFORM public.recalculate_document(v_new_doc_id);

    INSERT INTO public.document_links (
        company_id, source_document_id, target_document_id, link_type, created_by
    ) VALUES (
        v_src.company_id, v_src.id, v_new_doc_id, 'RETURN_TO_SOURCE', COALESCE(auth.uid(), v_src.created_by)
    );

    RETURN v_new_doc_id;
END;
$$;

COMMIT;
