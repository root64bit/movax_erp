-- Migration: 20260731170000_028_financial_advice_documents_engine.sql
-- Purpose: Financial Advice Documents (Avisos de Crédito e Débito a Clientes e Fornecedores)

BEGIN;

-- 1. Seed Financial Advice Document Types if not present
INSERT INTO public.document_types (
    id, company_id, code, name, direction, party_type, affects_stock, stock_direction,
    affects_customer_account, affects_supplier_account, requires_customer, requires_supplier, active
) VALUES 
    ('30000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'CUSTOMER_CREDIT_ADVICE', 'Aviso de Crédito a Cliente', 'CUSTOMER', 'CUSTOMER', false, 'NONE', true, false, true, false, true),
    ('30000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001', 'CUSTOMER_DEBIT_ADVICE', 'Aviso de Débito a Cliente', 'CUSTOMER', 'CUSTOMER', false, 'NONE', true, false, true, false, true),
    ('30000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000001', 'SUPPLIER_CREDIT_ADVICE', 'Aviso de Crédito Fornecedor', 'SUPPLIER', 'SUPPLIER', false, 'NONE', false, true, false, true, true),
    ('30000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000001', 'SUPPLIER_DEBIT_ADVICE', 'Aviso de Débito Fornecedor', 'SUPPLIER', 'SUPPLIER', false, 'NONE', false, true, false, true, true)
ON CONFLICT (company_id, code) DO UPDATE SET active = true, name = EXCLUDED.name;

-- 2. Create Table for Financial Advice Allocations
CREATE TABLE IF NOT EXISTS public.financial_advice_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    advice_document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    target_document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE RESTRICT,
    allocated_amount NUMERIC(15,2) NOT NULL CHECK (allocated_amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES public.user_profiles(id)
);

ALTER TABLE public.financial_advice_allocations ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.financial_advice_allocations TO authenticated;
GRANT ALL ON public.financial_advice_allocations TO service_role;

DROP POLICY IF EXISTS "financial_advice_allocations_select" ON public.financial_advice_allocations;
CREATE POLICY "financial_advice_allocations_select" ON public.financial_advice_allocations
    FOR SELECT TO authenticated USING (true);

-- 3. Create PL/pgSQL RPC: create_and_confirm_financial_advice
CREATE OR REPLACE FUNCTION public.create_and_confirm_financial_advice(
    p_entity_type TEXT,        -- 'CUSTOMER' or 'SUPPLIER'
    p_advice_type TEXT,        -- 'CREDIT' or 'DEBIT'
    p_entity_id UUID,          -- customer_id or supplier_id
    p_document_date DATE,
    p_target_document_id UUID, -- optional target invoice/document
    p_reason TEXT,
    p_notes TEXT,
    p_items JSONB,             -- array of [{ description, net_amount, tax_rate, tax_amount, total_amount }]
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_company_id UUID;
    v_branch_id UUID;
    v_warehouse_id UUID;
    v_period_id UUID;
    v_doc_type_code TEXT;
    v_doc_type_prefix TEXT;
    v_document_type_id UUID;
    v_document_id UUID;
    v_serial_no INTEGER;
    v_display_no TEXT;
    v_year_str TEXT := to_char(COALESCE(p_document_date, CURRENT_DATE), 'YYYY');
    v_item JSONB;
    v_line_number INTEGER := 0;
    v_subtotal NUMERIC(15,2) := 0;
    v_tax_total NUMERIC(15,2) := 0;
    v_grand_total NUMERIC(15,2) := 0;
    v_item_net NUMERIC(15,2);
    v_item_tax_rate NUMERIC(5,2);
    v_item_tax NUMERIC(15,2);
    v_item_total NUMERIC(15,2);
    v_desc TEXT;
    v_party_name TEXT;
    v_debit_amt NUMERIC(15,2) := 0;
    v_credit_amt NUMERIC(15,2) := 0;
    v_running_bal NUMERIC(15,2) := 0;
BEGIN
    IF v_user_id IS NULL THEN
        SELECT id INTO v_user_id FROM public.user_profiles WHERE is_active LIMIT 1;
    END IF;

    SELECT company_id INTO v_company_id FROM public.user_profiles WHERE id = v_user_id;
    IF v_company_id IS NULL THEN
        SELECT id INTO v_company_id FROM public.companies LIMIT 1;
    END IF;

    SELECT id INTO v_branch_id FROM public.branches WHERE company_id = v_company_id ORDER BY is_default DESC LIMIT 1;
    SELECT id INTO v_warehouse_id FROM public.warehouses WHERE company_id = v_company_id ORDER BY is_default DESC LIMIT 1;

    SELECT id INTO v_period_id FROM public.fiscal_periods
    WHERE company_id = v_company_id AND COALESCE(p_document_date, CURRENT_DATE) BETWEEN start_date AND end_date AND status = 'open'
    ORDER BY start_date DESC LIMIT 1;

    -- Resolve document type code and prefix
    IF p_entity_type = 'CUSTOMER' THEN
        IF p_advice_type = 'CREDIT' THEN
            v_doc_type_code := 'CUSTOMER_CREDIT_ADVICE';
            v_doc_type_prefix := 'ACC';
        ELSE
            v_doc_type_code := 'CUSTOMER_DEBIT_ADVICE';
            v_doc_type_prefix := 'ADC';
        END IF;
    ELSE
        IF p_advice_type = 'CREDIT' THEN
            v_doc_type_code := 'SUPPLIER_CREDIT_ADVICE';
            v_doc_type_prefix := 'ACF';
        ELSE
            v_doc_type_code := 'SUPPLIER_DEBIT_ADVICE';
            v_doc_type_prefix := 'ADF';
        END IF;
    END IF;

    SELECT id INTO v_document_type_id FROM public.document_types
    WHERE company_id = v_company_id AND code = v_doc_type_code AND active LIMIT 1;

    IF v_document_type_id IS NULL THEN
        RAISE EXCEPTION 'DOCUMENT_TYPE_NOT_FOUND: %', v_doc_type_code;
    END IF;

    -- Calculate Totals
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_item_net := ROUND(COALESCE((v_item->>'net_amount')::NUMERIC, 0), 2);
        v_item_tax_rate := ROUND(COALESCE((v_item->>'tax_rate')::NUMERIC, 0), 2);
        v_item_tax := ROUND(COALESCE((v_item->>'tax_amount')::NUMERIC, v_item_net * (v_item_tax_rate / 100)), 2);
        v_item_total := v_item_net + v_item_tax;

        v_subtotal := v_subtotal + v_item_net;
        v_tax_total := v_tax_total + v_item_tax;
        v_grand_total := v_grand_total + v_item_total;
    END LOOP;

    IF v_grand_total <= 0 THEN
        RAISE EXCEPTION 'INVALID_TOTAL: Advice total must be greater than zero.';
    END IF;

    -- Idempotency Check
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_document_id FROM public.documents
        WHERE company_id = v_company_id AND idempotency_key = p_idempotency_key;
        IF v_document_id IS NOT NULL THEN
            RETURN v_document_id;
        END IF;
    END IF;

    -- Generate Serial Number & Display Number (e.g. ACC 2026/000001)
    SELECT COALESCE(MAX(
        CASE 
            WHEN display_number ~ (v_doc_type_prefix || ' ' || v_year_str || '/[0-9]+')
            THEN SUBSTRING(display_number FROM '[0-9]+$')::INTEGER
            ELSE 0 
        END
    ), 0) + 1 INTO v_serial_no
    FROM public.documents
    WHERE company_id = v_company_id AND document_type_id = v_document_type_id;

    v_display_no := v_doc_type_prefix || ' ' || v_year_str || '/' || LPAD(v_serial_no::TEXT, 6, '0');

    -- Get Party Name
    IF p_entity_type = 'CUSTOMER' THEN
        SELECT name INTO v_party_name FROM public.customers WHERE id = p_entity_id;
    ELSE
        SELECT name INTO v_party_name FROM public.suppliers WHERE id = p_entity_id;
    END IF;

    -- Create Header Document in CONFIRMED Status
    INSERT INTO public.documents (
        company_id, branch_id, warehouse_id, document_type_id, fiscal_period_id,
        display_number, document_date, due_date,
        customer_id, supplier_id, source_document_id,
        subtotal, discount_total, net_total, tax_total, grand_total,
        amount_paid, outstanding_amount,
        notes, status, idempotency_key, created_by, updated_by
    ) VALUES (
        v_company_id, v_branch_id, v_warehouse_id, v_document_type_id, v_period_id,
        v_display_no, COALESCE(p_document_date, CURRENT_DATE), COALESCE(p_document_date, CURRENT_DATE),
        CASE WHEN p_entity_type = 'CUSTOMER' THEN p_entity_id ELSE NULL END,
        CASE WHEN p_entity_type = 'SUPPLIER' THEN p_entity_id ELSE NULL END,
        p_target_document_id,
        v_subtotal, 0, v_subtotal, v_tax_total, v_grand_total,
        v_grand_total, 0,
        COALESCE(p_notes, p_reason), 'CONFIRMED', p_idempotency_key, v_user_id, v_user_id
    ) RETURNING id INTO v_document_id;

    -- Insert Document Lines
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_line_number := v_line_number + 1;
        v_desc := COALESCE(v_item->>'description', 'Aviso Financeiro');
        v_item_net := ROUND(COALESCE((v_item->>'net_amount')::NUMERIC, 0), 2);
        v_item_tax_rate := ROUND(COALESCE((v_item->>'tax_rate')::NUMERIC, 0), 2);
        v_item_tax := ROUND(COALESCE((v_item->>'tax_amount')::NUMERIC, v_item_net * (v_item_tax_rate / 100)), 2);
        v_item_total := v_item_net + v_item_tax;

        INSERT INTO public.document_lines (
            company_id, document_id, line_number, product_id,
            description_snapshot, unit_code_snapshot, quantity, unit_price,
            discount_percentage, discount_amount, tax_rate_snapshot,
            net_amount, tax_amount, total_amount, stock_effect_enabled
        ) VALUES (
            v_company_id, v_document_id, v_line_number, NULL,
            v_desc, 'UN', 1, v_item_net,
            0, 0, v_item_tax_rate,
            v_item_net, v_item_tax, v_item_total, false
        );
    END LOOP;

    -- Ledger Entries and Balance Impact
    IF p_entity_type = 'CUSTOMER' THEN
        IF p_advice_type = 'CREDIT' THEN
            -- Customer Credit Advice: Reduces customer debt (Credit entry)
            v_credit_amt := v_grand_total;
            v_debit_amt := 0;
            UPDATE public.customers
            SET current_balance = current_balance - v_grand_total, updated_at = now()
            WHERE id = p_entity_id
            RETURNING current_balance INTO v_running_bal;
        ELSE
            -- Customer Debit Advice: Increases customer debt (Debit entry)
            v_debit_amt := v_grand_total;
            v_credit_amt := 0;
            UPDATE public.customers
            SET current_balance = current_balance + v_grand_total, updated_at = now()
            WHERE id = p_entity_id
            RETURNING current_balance INTO v_running_bal;
        END IF;

        INSERT INTO public.ledger_entries (
            company_id, entry_date, party_type, customer_id, document_id,
            entry_type, debit_amount, credit_amount, outstanding_amount,
            running_balance, description, reference_number, created_by
        ) VALUES (
            v_company_id, COALESCE(p_document_date, CURRENT_DATE), 'CUSTOMER', p_entity_id, v_document_id,
            v_doc_type_code, v_debit_amt, v_credit_amt, 0,
            v_running_bal, COALESCE(p_reason, v_doc_type_code), v_display_no, v_user_id
        );

    ELSE
        IF p_advice_type = 'CREDIT' THEN
            -- Supplier Credit Advice: Increases payable to supplier (Credit entry)
            v_credit_amt := v_grand_total;
            v_debit_amt := 0;
            UPDATE public.suppliers
            SET current_balance = current_balance + v_grand_total, updated_at = now()
            WHERE id = p_entity_id
            RETURNING current_balance INTO v_running_bal;
        ELSE
            -- Supplier Debit Advice: Reduces payable to supplier (Debit entry)
            v_debit_amt := v_grand_total;
            v_credit_amt := 0;
            UPDATE public.suppliers
            SET current_balance = current_balance - v_grand_total, updated_at = now()
            WHERE id = p_entity_id
            RETURNING current_balance INTO v_running_bal;
        END IF;

        INSERT INTO public.ledger_entries (
            company_id, entry_date, party_type, supplier_id, document_id,
            entry_type, debit_amount, credit_amount, outstanding_amount,
            running_balance, description, reference_number, created_by
        ) VALUES (
            v_company_id, COALESCE(p_document_date, CURRENT_DATE), 'SUPPLIER', p_entity_id, v_document_id,
            v_doc_type_code, v_debit_amt, v_credit_amt, 0,
            v_running_bal, COALESCE(p_reason, v_doc_type_code), v_display_no, v_user_id
        );
    END IF;

    -- Target Document Allocation (if target document provided)
    IF p_target_document_id IS NOT NULL THEN
        INSERT INTO public.financial_advice_allocations (
            company_id, advice_document_id, target_document_id, allocated_amount, created_by
        ) VALUES (
            v_company_id, v_document_id, p_target_document_id, v_grand_total, v_user_id
        );

        UPDATE public.documents
        SET amount_paid = amount_paid + v_grand_total,
            outstanding_amount = GREATEST(0, grand_total - (amount_paid + v_grand_total)),
            status = CASE WHEN (grand_total - (amount_paid + v_grand_total)) <= 0 THEN 'PAID' ELSE status END,
            updated_at = now()
        WHERE id = p_target_document_id;
    END IF;

    RETURN v_document_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_and_confirm_financial_advice FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_and_confirm_financial_advice TO authenticated;

-- 4. Create PL/pgSQL RPC: cancel_financial_advice
CREATE OR REPLACE FUNCTION public.cancel_financial_advice(
    p_advice_document_id UUID,
    p_cancellation_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_doc public.documents;
    v_doc_type_code TEXT;
    v_alloc RECORD;
    v_running_bal NUMERIC(15,2) := 0;
BEGIN
    SELECT * INTO v_doc FROM public.documents WHERE id = p_advice_document_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'DOCUMENT_NOT_FOUND: Document ID % not found.', p_advice_document_id;
    END IF;

    IF v_doc.status = 'CANCELLED' THEN
        RAISE EXCEPTION 'ALREADY_CANCELLED: Document % is already cancelled.', v_doc.display_number;
    END IF;

    SELECT code INTO v_doc_type_code FROM public.document_types WHERE id = v_doc.document_type_id;

    -- Reverse Ledger and Entity Balances
    IF v_doc.customer_id IS NOT NULL THEN
        IF v_doc_type_code = 'CUSTOMER_CREDIT_ADVICE' THEN
            -- Original reduced customer debt, cancellation restores debt (Debit)
            UPDATE public.customers
            SET current_balance = current_balance + v_doc.grand_total, updated_at = now()
            WHERE id = v_doc.customer_id
            RETURNING current_balance INTO v_running_bal;

            INSERT INTO public.ledger_entries (
                company_id, entry_date, party_type, customer_id, document_id,
                entry_type, debit_amount, credit_amount, outstanding_amount,
                running_balance, description, reference_number, created_by
            ) VALUES (
                v_doc.company_id, CURRENT_DATE, 'CUSTOMER', v_doc.customer_id, v_doc.id,
                'REVERSAL_' || v_doc_type_code, v_doc.grand_total, 0, 0,
                v_running_bal, 'Reversão: ' || COALESCE(p_cancellation_reason, 'Cancelamento de aviso'), v_doc.display_number, v_user_id
            );
        ELSE
            -- Original increased customer debt, cancellation reduces debt (Credit)
            UPDATE public.customers
            SET current_balance = current_balance - v_doc.grand_total, updated_at = now()
            WHERE id = v_doc.customer_id
            RETURNING current_balance INTO v_running_bal;

            INSERT INTO public.ledger_entries (
                company_id, entry_date, party_type, customer_id, document_id,
                entry_type, debit_amount, credit_amount, outstanding_amount,
                running_balance, description, reference_number, created_by
            ) VALUES (
                v_doc.company_id, CURRENT_DATE, 'CUSTOMER', v_doc.customer_id, v_doc.id,
                'REVERSAL_' || v_doc_type_code, 0, v_doc.grand_total, 0,
                v_running_bal, 'Reversão: ' || COALESCE(p_cancellation_reason, 'Cancelamento de aviso'), v_doc.display_number, v_user_id
            );
        END IF;

    ELSIF v_doc.supplier_id IS NOT NULL THEN
        IF v_doc_type_code = 'SUPPLIER_CREDIT_ADVICE' THEN
            -- Original increased supplier payable, cancellation reduces payable (Debit)
            UPDATE public.suppliers
            SET current_balance = current_balance - v_doc.grand_total, updated_at = now()
            WHERE id = v_doc.supplier_id
            RETURNING current_balance INTO v_running_bal;

            INSERT INTO public.ledger_entries (
                company_id, entry_date, party_type, supplier_id, document_id,
                entry_type, debit_amount, credit_amount, outstanding_amount,
                running_balance, description, reference_number, created_by
            ) VALUES (
                v_doc.company_id, CURRENT_DATE, 'SUPPLIER', v_doc.supplier_id, v_doc.id,
                'REVERSAL_' || v_doc_type_code, v_doc.grand_total, 0, 0,
                v_running_bal, 'Reversão: ' || COALESCE(p_cancellation_reason, 'Cancelamento de aviso'), v_doc.display_number, v_user_id
            );
        ELSE
            -- Original reduced supplier payable, cancellation restores payable (Credit)
            UPDATE public.suppliers
            SET current_balance = current_balance + v_doc.grand_total, updated_at = now()
            WHERE id = v_doc.supplier_id
            RETURNING current_balance INTO v_running_bal;

            INSERT INTO public.ledger_entries (
                company_id, entry_date, party_type, supplier_id, document_id,
                entry_type, debit_amount, credit_amount, outstanding_amount,
                running_balance, description, reference_number, created_by
            ) VALUES (
                v_doc.company_id, CURRENT_DATE, 'SUPPLIER', v_doc.supplier_id, v_doc.id,
                'REVERSAL_' || v_doc_type_code, 0, v_doc.grand_total, 0,
                v_running_bal, 'Reversão: ' || COALESCE(p_cancellation_reason, 'Cancelamento de aviso'), v_doc.display_number, v_user_id
            );
        END IF;
    END IF;

    -- Reverse Allocations
    FOR v_alloc IN SELECT * FROM public.financial_advice_allocations WHERE advice_document_id = p_advice_document_id LOOP
        UPDATE public.documents
        SET amount_paid = GREATEST(0, amount_paid - v_alloc.allocated_amount),
            outstanding_amount = outstanding_amount + v_alloc.allocated_amount,
            status = CASE WHEN status = 'PAID' THEN 'CONFIRMED' ELSE status END,
            updated_at = now()
        WHERE id = v_alloc.target_document_id;
    END LOOP;

    -- Update Document Status to CANCELLED
    UPDATE public.documents
    SET status = 'CANCELLED',
        notes = COALESCE(notes, '') || ' [CANCELADO: ' || COALESCE(p_cancellation_reason, 'Cancelamento solicitado') || ']',
        updated_at = now(),
        updated_by = v_user_id
    WHERE id = p_advice_document_id;

    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_financial_advice(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_financial_advice(UUID, TEXT) TO authenticated;

COMMIT;
