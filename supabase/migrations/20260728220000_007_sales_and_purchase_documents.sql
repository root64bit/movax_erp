-- Migration: 20260728220000_007_sales_and_purchase_documents.sql
-- Description: Complete commercial document engine (headers, lines, transport, links, status history, ledger entries, sequences, confirmation RPCs, reversals).
-- Target Database: bkbcgndzsfylwsinxwbb (Production Pre-Live Mode)

BEGIN;

-- 0. ALTER DOCUMENT_SEQUENCES TO FIT LONG DOCUMENT TYPE CODES (e.g. CUSTOMER_DELIVERY_NOTE)
ALTER TABLE public.document_sequences ALTER COLUMN document_type TYPE VARCHAR(100);
ALTER TABLE public.document_sequences ALTER COLUMN prefix TYPE VARCHAR(100);
ALTER TABLE public.document_sequences ALTER COLUMN series TYPE VARCHAR(50);

-- 1. DOCUMENT TYPES
CREATE TABLE IF NOT EXISTS public.document_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('CUSTOMER', 'SUPPLIER', 'INTERNAL')),
    party_type TEXT NOT NULL CHECK (party_type IN ('CUSTOMER', 'SUPPLIER', 'NONE')),
    affects_stock BOOLEAN NOT NULL DEFAULT false,
    stock_direction TEXT CHECK (stock_direction IN ('IN', 'OUT', 'NONE')),
    affects_customer_account BOOLEAN NOT NULL DEFAULT false,
    affects_supplier_account BOOLEAN NOT NULL DEFAULT false,
    requires_customer BOOLEAN NOT NULL DEFAULT false,
    requires_supplier BOOLEAN NOT NULL DEFAULT false,
    requires_source_document BOOLEAN NOT NULL DEFAULT false,
    allows_manual_price BOOLEAN NOT NULL DEFAULT true,
    allows_discount BOOLEAN NOT NULL DEFAULT true,
    allows_negative_quantity BOOLEAN NOT NULL DEFAULT false,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_doc_type_code UNIQUE (company_id, code)
);

ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.document_types TO authenticated;
GRANT ALL ON public.document_types TO service_role;

DROP POLICY IF EXISTS "document_types_select" ON public.document_types;
CREATE POLICY "document_types_select" ON public.document_types
    FOR SELECT TO authenticated USING (true);

-- Seed Document Types for Casa de Pneus, Lda.
INSERT INTO public.document_types (
    id, company_id, code, name, direction, party_type, affects_stock, stock_direction,
    affects_customer_account, affects_supplier_account, requires_customer, requires_supplier
) VALUES 
    -- Customer Documents
    ('30000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'CUSTOMER_DELIVERY_NOTE', 'Guia de Remessa', 'CUSTOMER', 'CUSTOMER', true, 'OUT', false, false, true, false),
    ('30000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'CUSTOMER_INVOICE', 'Factura', 'CUSTOMER', 'CUSTOMER', true, 'OUT', true, false, true, false),
    ('30000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'CASH_SALE', 'Venda a Dinheiro', 'CUSTOMER', 'CUSTOMER', true, 'OUT', true, false, false, false),
    ('30000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'CUSTOMER_CREDIT_NOTE', 'Nota de Crédito', 'CUSTOMER', 'CUSTOMER', false, 'IN', true, false, true, false),
    ('30000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'CUSTOMER_DEBIT_NOTE', 'Nota de Débito', 'CUSTOMER', 'CUSTOMER', false, 'NONE', true, false, true, false),

    -- Supplier Documents
    ('30000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'SUPPLIER_DELIVERY_NOTE', 'Guia de Recepção Fornecedor', 'SUPPLIER', 'SUPPLIER', true, 'IN', false, false, false, true),
    ('30000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'SUPPLIER_INVOICE', 'Factura de Fornecedor', 'SUPPLIER', 'SUPPLIER', true, 'IN', false, true, false, true),
    ('30000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'SUPPLIER_CREDIT_ADVICE', 'Aviso de Crédito Fornecedor', 'SUPPLIER', 'SUPPLIER', false, 'NONE', false, true, false, true),
    ('30000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'SUPPLIER_DEBIT_ADVICE', 'Aviso de Débito Fornecedor', 'SUPPLIER', 'SUPPLIER', false, 'NONE', false, true, false, true),
    ('30000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', 'SUPPLIER_RETURN', 'Devolução a Fornecedor', 'SUPPLIER', 'SUPPLIER', true, 'OUT', false, true, false, true)
ON CONFLICT (company_id, code) DO NOTHING;

-- 2. DOCUMENTS (HEADER TABLE)
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    document_type_id UUID NOT NULL REFERENCES public.document_types(id) ON DELETE RESTRICT,
    fiscal_period_id UUID NOT NULL REFERENCES public.fiscal_periods(id) ON DELETE RESTRICT,
    series TEXT NOT NULL DEFAULT 'A',
    document_number BIGINT,
    display_number TEXT,
    legacy_id TEXT,
    legacy_number TEXT,
    document_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE RESTRICT,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    payment_term_id UUID REFERENCES public.payment_terms(id) ON DELETE RESTRICT,
    salesperson_name TEXT,
    source_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    external_reference TEXT,
    supplier_invoice_number TEXT,
    currency_code TEXT NOT NULL DEFAULT 'MZN',
    exchange_rate NUMERIC(18,6) NOT NULL DEFAULT 1.000000 CHECK (exchange_rate > 0),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
        'DRAFT', 'CONFIRMED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'REVERSED'
    )),
    subtotal NUMERIC(18,2) NOT NULL DEFAULT 0.00,
    discount_total NUMERIC(18,2) NOT NULL DEFAULT 0.00,
    net_total NUMERIC(18,2) NOT NULL DEFAULT 0.00,
    tax_total NUMERIC(18,2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(18,2) NOT NULL DEFAULT 0.00 CHECK (grand_total >= 0),
    amount_paid NUMERIC(18,2) NOT NULL DEFAULT 0.00 CHECK (amount_paid >= 0),
    outstanding_amount NUMERIC(18,2) NOT NULL DEFAULT 0.00 CHECK (outstanding_amount >= 0),
    stock_posted BOOLEAN NOT NULL DEFAULT false,
    financial_posted BOOLEAN NOT NULL DEFAULT false,
    idempotency_key TEXT,
    notes TEXT,
    created_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    confirmed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    reversal_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    migration_batch_id UUID REFERENCES migration.migration_batches(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_doc_company_idempotency UNIQUE (company_id, idempotency_key)
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;

DROP POLICY IF EXISTS "documents_select" ON public.documents;
CREATE POLICY "documents_select" ON public.documents
    FOR SELECT TO authenticated USING (
        company_id = public.get_user_company_id() AND public.has_permission('documents.view')
    );

DROP POLICY IF EXISTS "documents_insert" ON public.documents;
CREATE POLICY "documents_insert" ON public.documents
    FOR INSERT TO authenticated WITH CHECK (
        company_id = public.get_user_company_id()
    );

DROP POLICY IF EXISTS "documents_update" ON public.documents;
CREATE POLICY "documents_update" ON public.documents
    FOR UPDATE TO authenticated USING (
        company_id = public.get_user_company_id() AND status = 'DRAFT'
    );

-- Partial unique constraint for confirmed document numbers
CREATE UNIQUE INDEX IF NOT EXISTS uq_confirmed_document_number 
ON public.documents (company_id, document_type_id, series, fiscal_period_id, document_number) 
WHERE status NOT IN ('DRAFT', 'CANCELLED');

-- Partial unique constraint for active supplier invoice duplicate protection
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_supplier_invoice_number
ON public.documents (company_id, supplier_id, LOWER(TRIM(supplier_invoice_number)))
WHERE supplier_invoice_number IS NOT NULL AND status NOT IN ('CANCELLED', 'REVERSED');

-- 3. DOCUMENT LINES
CREATE TABLE IF NOT EXISTS public.document_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
    product_code_snapshot TEXT,
    description_snapshot TEXT NOT NULL,
    unit_code_snapshot TEXT,
    quantity NUMERIC(18,3) NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(18,4) NOT NULL CHECK (unit_price >= 0),
    discount_percentage NUMERIC(9,4) NOT NULL DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
    discount_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    tax_code_id UUID REFERENCES public.tax_codes(id) ON DELETE RESTRICT,
    tax_code_snapshot TEXT,
    tax_rate_snapshot NUMERIC(9,4) NOT NULL DEFAULT 0 CHECK (tax_rate_snapshot >= 0),
    net_amount NUMERIC(18,2) NOT NULL CHECK (net_amount >= 0),
    tax_amount NUMERIC(18,2) NOT NULL CHECK (tax_amount >= 0),
    total_amount NUMERIC(18,2) NOT NULL CHECK (total_amount >= 0),
    unit_cost_snapshot NUMERIC(18,4) DEFAULT 0,
    margin_amount_snapshot NUMERIC(18,2) DEFAULT 0,
    margin_percentage_snapshot NUMERIC(9,4) DEFAULT 0,
    stock_effect_enabled BOOLEAN NOT NULL DEFAULT true,
    source_document_line_id UUID REFERENCES public.document_lines(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_doc_line_number UNIQUE (document_id, line_number)
);

ALTER TABLE public.document_lines ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_lines TO authenticated;
GRANT ALL ON public.document_lines TO service_role;

DROP POLICY IF EXISTS "document_lines_select" ON public.document_lines;
CREATE POLICY "document_lines_select" ON public.document_lines
    FOR SELECT TO authenticated USING (
        company_id = public.get_user_company_id() AND public.has_permission('documents.view')
    );

-- 4. DOCUMENT TRANSPORT DETAILS
CREATE TABLE IF NOT EXISTS public.document_transport_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE UNIQUE,
    expedition_method TEXT,
    vehicle_registration TEXT,
    carrier_name TEXT,
    loading_location TEXT,
    loading_at TIMESTAMPTZ,
    unloading_location TEXT,
    unloading_at TIMESTAMPTZ,
    recipient_name TEXT,
    delivery_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_loading_unloading_time CHECK (unloading_at IS NULL OR loading_at IS NULL OR unloading_at >= loading_at)
);

ALTER TABLE public.document_transport_details ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.document_transport_details TO authenticated;
GRANT ALL ON public.document_transport_details TO service_role;

DROP POLICY IF EXISTS "document_transport_details_select" ON public.document_transport_details;
CREATE POLICY "document_transport_details_select" ON public.document_transport_details
    FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());

-- 5. DOCUMENT LINKS
CREATE TABLE IF NOT EXISTS public.document_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    source_document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    target_document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    link_type TEXT NOT NULL CHECK (link_type IN (
        'DELIVERY_NOTE_TO_INVOICE', 'INVOICE_TO_CREDIT_NOTE', 'INVOICE_TO_DEBIT_NOTE',
        'DOCUMENT_TO_REVERSAL', 'SUPPLIER_DELIVERY_TO_INVOICE', 'SUPPLIER_INVOICE_TO_CREDIT',
        'SUPPLIER_INVOICE_TO_DEBIT', 'RETURN_TO_SOURCE'
    )),
    created_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_different_documents CHECK (source_document_id <> target_document_id),
    CONSTRAINT uq_doc_link UNIQUE (source_document_id, target_document_id, link_type)
);

ALTER TABLE public.document_links ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.document_links TO authenticated;
GRANT ALL ON public.document_links TO service_role;

DROP POLICY IF EXISTS "document_links_select" ON public.document_links;
CREATE POLICY "document_links_select" ON public.document_links
    FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());

-- 6. STATUS HISTORY
CREATE TABLE IF NOT EXISTS public.document_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    reason TEXT,
    changed_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    correlation_id UUID
);

ALTER TABLE public.document_status_history ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.document_status_history TO authenticated;
GRANT ALL ON public.document_status_history TO service_role;

DROP POLICY IF EXISTS "document_status_history_select" ON public.document_status_history;
CREATE POLICY "document_status_history_select" ON public.document_status_history
    FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());

-- 7. LEDGER ENTRIES (Document-origin Financial Current-Account Foundation)
CREATE TABLE IF NOT EXISTS public.ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    party_type TEXT NOT NULL CHECK (party_type IN ('CUSTOMER', 'SUPPLIER')),
    customer_id UUID REFERENCES public.customers(id) ON DELETE RESTRICT,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    entry_type TEXT NOT NULL,
    debit_amount NUMERIC(18,2) NOT NULL DEFAULT 0.00 CHECK (debit_amount >= 0),
    credit_amount NUMERIC(18,2) NOT NULL DEFAULT 0.00 CHECK (credit_amount >= 0),
    outstanding_amount NUMERIC(18,2) NOT NULL DEFAULT 0.00 CHECK (outstanding_amount >= 0),
    source_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    reversal_of_entry_id UUID REFERENCES public.ledger_entries(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'SETTLED', 'REVERSED')),
    legacy_id TEXT,
    migration_batch_id UUID REFERENCES migration.migration_batches(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_party_present CHECK (
        (party_type = 'CUSTOMER' AND customer_id IS NOT NULL AND supplier_id IS NULL) OR
        (party_type = 'SUPPLIER' AND supplier_id IS NOT NULL AND customer_id IS NULL)
    ),
    CONSTRAINT chk_debit_credit_positive CHECK (debit_amount > 0 OR credit_amount > 0)
);

ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.ledger_entries TO authenticated;
GRANT ALL ON public.ledger_entries TO service_role;

DROP POLICY IF EXISTS "ledger_entries_select" ON public.ledger_entries;
CREATE POLICY "ledger_entries_select" ON public.ledger_entries
    FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());

-- ────────────────────────────────────────────────────────────
-- SEQUENCE NUMBER GENERATOR (SECURITY DEFINER)
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.next_document_number(
    p_company_id UUID,
    p_document_type_id UUID,
    p_fiscal_period_id UUID,
    p_series TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_doc_type_code TEXT;
    v_next_num BIGINT;
BEGIN
    SELECT code INTO v_doc_type_code FROM public.document_types WHERE id = p_document_type_id;

    -- Lock & update sequence row atomically
    UPDATE public.document_sequences
    SET current_number = current_number + 1,
        updated_at = now()
    WHERE company_id = p_company_id 
      AND document_type = v_doc_type_code 
      AND series = p_series 
      AND fiscal_period_id = p_fiscal_period_id
    RETURNING current_number INTO v_next_num;

    IF NOT FOUND THEN
        -- Insert new sequence starting at 1
        INSERT INTO public.document_sequences (
            company_id, document_type, series, current_number, fiscal_period_id, prefix
        ) VALUES (
            p_company_id, v_doc_type_code, p_series, 1, p_fiscal_period_id, v_doc_type_code || ' ' || p_series || '/'
        ) RETURNING current_number INTO v_next_num;
    END IF;

    RETURN v_next_num;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- SERVER-SIDE RECALCULATE DOCUMENT TOTALS
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.recalculate_document(p_document_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_subtotal NUMERIC(18,2) := 0;
    v_discount_total NUMERIC(18,2) := 0;
    v_net_total NUMERIC(18,2) := 0;
    v_tax_total NUMERIC(18,2) := 0;
    v_grand_total NUMERIC(18,2) := 0;
BEGIN
    SELECT 
        COALESCE(SUM(ROUND(quantity * unit_price, 2)), 0.00),
        COALESCE(SUM(discount_amount), 0.00),
        COALESCE(SUM(net_amount), 0.00),
        COALESCE(SUM(tax_amount), 0.00),
        COALESCE(SUM(total_amount), 0.00)
    INTO v_subtotal, v_discount_total, v_net_total, v_tax_total, v_grand_total
    FROM public.document_lines
    WHERE document_id = p_document_id;

    UPDATE public.documents
    SET subtotal = v_subtotal,
        discount_total = v_discount_total,
        net_total = v_net_total,
        tax_total = v_tax_total,
        grand_total = v_grand_total,
        outstanding_amount = v_grand_total - amount_paid,
        updated_at = now()
    WHERE id = p_document_id AND status = 'DRAFT';
END;
$$;

-- ────────────────────────────────────────────────────────────
-- DOCUMENT CONFIRMATION RPCs
-- ────────────────────────────────────────────────────────────

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
        IF v_doc_type.affects_stock AND v_line.stock_effect_enabled AND NOT v_doc.stock_posted THEN
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
        stock_posted = CASE WHEN v_doc_type.affects_stock THEN true ELSE stock_posted END,
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

CREATE OR REPLACE FUNCTION private.confirm_supplier_document(
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

    -- Post Stock
    FOR v_line IN SELECT * FROM public.document_lines WHERE document_id = p_document_id LOOP
        IF v_doc_type.affects_stock AND v_line.stock_effect_enabled AND NOT v_doc.stock_posted THEN
            IF v_doc_type.stock_direction = 'IN' THEN
                PERFORM public.post_stock_movement(
                    p_company_id := v_doc.company_id,
                    p_product_id := v_line.product_id,
                    p_warehouse_id := v_doc.warehouse_id,
                    p_movement_type := 'purchase_entry',
                    p_quantity_in := v_line.quantity,
                    p_quantity_out := 0,
                    p_unit_cost := v_line.unit_price,
                    p_source_document_id := v_doc.id,
                    p_source_document_line_id := v_line.id,
                    p_supplier_id := v_doc.supplier_id
                );
            ELSIF v_doc_type.stock_direction = 'OUT' THEN
                PERFORM public.post_stock_movement(
                    p_company_id := v_doc.company_id,
                    p_product_id := v_line.product_id,
                    p_warehouse_id := v_doc.warehouse_id,
                    p_movement_type := 'supplier_return',
                    p_quantity_in := 0,
                    p_quantity_out := v_line.quantity,
                    p_unit_cost := v_line.unit_price,
                    p_source_document_id := v_doc.id,
                    p_source_document_line_id := v_line.id,
                    p_supplier_id := v_doc.supplier_id
                );
            END IF;
        END IF;
    END LOOP;

    -- Financial Ledger Posting
    IF v_doc_type.affects_supplier_account AND NOT v_doc.financial_posted AND v_doc.supplier_id IS NOT NULL THEN
        INSERT INTO public.ledger_entries (
            company_id, branch_id, party_type, supplier_id, entry_date, due_date,
            entry_type, debit_amount, credit_amount, outstanding_amount, source_document_id, status, created_by
        ) VALUES (
            v_doc.company_id, v_doc.branch_id, 'SUPPLIER', v_doc.supplier_id, v_doc.document_date, v_doc.due_date,
            v_doc_type.code,
            CASE WHEN v_doc_type.code IN ('SUPPLIER_CREDIT_ADVICE', 'SUPPLIER_RETURN') THEN v_doc.grand_total ELSE 0.00 END,
            CASE WHEN v_doc_type.code IN ('SUPPLIER_INVOICE', 'SUPPLIER_DEBIT_ADVICE') THEN v_doc.grand_total ELSE 0.00 END,
            v_doc.grand_total, v_doc.id, 'CONFIRMED', COALESCE(auth.uid(), v_doc.created_by)
        );

        SELECT COALESCE(SUM(credit_amount - debit_amount), 0.00) INTO v_new_bal
        FROM public.ledger_entries WHERE supplier_id = v_doc.supplier_id AND status = 'CONFIRMED';
        
        UPDATE public.suppliers SET current_balance = v_new_bal, updated_at = now() WHERE id = v_doc.supplier_id;
    END IF;

    INSERT INTO public.document_status_history (
        company_id, document_id, previous_status, new_status, reason, changed_by
    ) VALUES (
        v_doc.company_id, v_doc.id, 'DRAFT', 'CONFIRMED', 'Supplier document confirmation', COALESCE(auth.uid(), v_doc.created_by)
    );

    UPDATE public.documents
    SET status = 'CONFIRMED',
        document_number = v_next_num,
        display_number = v_display_num,
        stock_posted = CASE WHEN v_doc_type.affects_stock THEN true ELSE stock_posted END,
        financial_posted = CASE WHEN v_doc_type.affects_supplier_account THEN true ELSE financial_posted END,
        confirmed_by = COALESCE(auth.uid(), v_doc.created_by),
        confirmed_at = now(),
        idempotency_key = COALESCE(p_idempotency_key, idempotency_key),
        updated_at = now()
    WHERE id = p_document_id
    RETURNING * INTO v_doc;

    RETURN v_doc;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- CANCELLATION & REVERSAL PROCEDURES
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.reverse_confirmed_document(
    p_document_id UUID,
    p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_orig public.documents;
    v_orig_type public.document_types;
    v_reversal_type_id UUID;
    v_line RECORD;
BEGIN
    SELECT * INTO v_orig FROM public.documents WHERE id = p_document_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'DOCUMENT_NOT_FOUND: Document ID % does not exist.', p_document_id;
    END IF;

    IF v_orig.status NOT IN ('CONFIRMED', 'OVERDUE') THEN
        RAISE EXCEPTION 'CANNOT_REVERSE: Only CONFIRMED or OVERDUE documents can be reversed. Current status: %', v_orig.status;
    END IF;

    SELECT * INTO v_orig_type FROM public.document_types WHERE id = v_orig.document_type_id;

    -- Reverse stock movements
    IF v_orig.stock_posted THEN
        FOR v_line IN SELECT * FROM public.document_lines WHERE document_id = p_document_id LOOP
            IF v_orig_type.stock_direction = 'OUT' THEN
                PERFORM public.post_stock_movement(
                    p_company_id := v_orig.company_id,
                    p_product_id := v_line.product_id,
                    p_warehouse_id := v_orig.warehouse_id,
                    p_movement_type := 'reversal',
                    p_quantity_in := v_line.quantity,
                    p_quantity_out := 0,
                    p_unit_cost := COALESCE(v_line.unit_cost_snapshot, 0),
                    p_source_document_id := v_orig.id,
                    p_source_document_line_id := v_line.id
                );
            ELSIF v_orig_type.stock_direction = 'IN' THEN
                PERFORM public.post_stock_movement(
                    p_company_id := v_orig.company_id,
                    p_product_id := v_line.product_id,
                    p_warehouse_id := v_orig.warehouse_id,
                    p_movement_type := 'reversal',
                    p_quantity_in := 0,
                    p_quantity_out := v_line.quantity,
                    p_unit_cost := COALESCE(v_line.unit_cost_snapshot, 0),
                    p_source_document_id := v_orig.id,
                    p_source_document_line_id := v_line.id
                );
            END IF;
        END LOOP;
    END IF;

    -- Reverse Ledger Entries
    IF v_orig.financial_posted THEN
        UPDATE public.ledger_entries
        SET status = 'REVERSED'
        WHERE source_document_id = v_orig.id;
    END IF;

    -- Log Status Transition
    INSERT INTO public.document_status_history (
        company_id, document_id, previous_status, new_status, reason, changed_by
    ) VALUES (
        v_orig.company_id, v_orig.id, v_orig.status, 'REVERSED', p_reason, COALESCE(auth.uid(), v_orig.created_by)
    );

    -- Update Document Status
    UPDATE public.documents
    SET status = 'REVERSED',
        cancellation_reason = p_reason,
        cancelled_by = COALESCE(auth.uid(), v_orig.created_by),
        cancelled_at = now(),
        updated_at = now()
    WHERE id = p_document_id;

    RETURN p_document_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- RAW LEGACY DOCUMENT STAGING TABLES (migration SCHEMA)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS migration.documents_raw (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_batch_id UUID NOT NULL REFERENCES migration.migration_batches(id) ON DELETE CASCADE,
    source_system TEXT NOT NULL DEFAULT 'XT-POS',
    source_table TEXT,
    source_file TEXT,
    source_record_id TEXT,
    source_row_number INTEGER,
    source_document_type TEXT,
    source_document_number TEXT,
    source_document_date TEXT,
    source_customer_number TEXT,
    source_supplier_number TEXT,
    raw_payload JSONB NOT NULL,
    source_hash TEXT NOT NULL,
    validation_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (validation_status IN ('PENDING', 'VALID', 'INVALID', 'ERROR')),
    validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
    transformation_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (transformation_status IN ('PENDING', 'TRANSFORMED', 'IMPORTED', 'SKIPPED', 'ERROR')),
    destination_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    CONSTRAINT uq_doc_raw_batch_hash UNIQUE (migration_batch_id, source_hash)
);

GRANT ALL ON migration.documents_raw TO service_role;

CREATE TABLE IF NOT EXISTS migration.document_lines_raw (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_batch_id UUID NOT NULL REFERENCES migration.migration_batches(id) ON DELETE CASCADE,
    source_system TEXT NOT NULL DEFAULT 'XT-POS',
    source_file TEXT,
    source_record_id TEXT,
    source_document_number TEXT,
    source_line_number INTEGER,
    source_product_code TEXT,
    source_description TEXT,
    source_quantity NUMERIC(18,3),
    source_unit_price NUMERIC(18,4),
    source_discount NUMERIC(18,2),
    source_tax NUMERIC(18,2),
    source_total NUMERIC(18,2),
    raw_payload JSONB NOT NULL,
    source_hash TEXT NOT NULL,
    validation_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (validation_status IN ('PENDING', 'VALID', 'INVALID', 'ERROR')),
    transformation_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (transformation_status IN ('PENDING', 'TRANSFORMED', 'IMPORTED', 'SKIPPED', 'ERROR')),
    destination_id UUID REFERENCES public.document_lines(id) ON DELETE SET NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_doc_line_raw_batch_hash UNIQUE (migration_batch_id, source_hash)
);

GRANT ALL ON migration.document_lines_raw TO service_role;

-- ────────────────────────────────────────────────────────────
-- SEED REPEAT-SAFE PERMISSIONS FOR DOCUMENTS
-- ────────────────────────────────────────────────────────────

INSERT INTO public.permissions (code, module, description) VALUES
    ('documents.view', 'Documents', 'View document lists and details'),
    ('documents.search', 'Documents', 'Search commercial documents'),
    ('documents.print', 'Documents', 'Print commercial documents'),
    ('documents.reprint', 'Documents', 'Reprint historical documents'),

    ('sales.delivery_note.create', 'Sales', 'Create customer delivery notes'),
    ('sales.delivery_note.confirm', 'Sales', 'Confirm customer delivery notes'),
    ('sales.invoice.create', 'Sales', 'Create customer invoices'),
    ('sales.invoice.confirm', 'Sales', 'Confirm customer invoices'),
    ('sales.cash_sale.create', 'Sales', 'Create cash sales'),
    ('sales.cash_sale.confirm', 'Sales', 'Confirm cash sales'),
    ('sales.credit_note.create', 'Sales', 'Create customer credit notes'),
    ('sales.credit_note.confirm', 'Sales', 'Confirm customer credit notes'),
    ('sales.debit_note.create', 'Sales', 'Create customer debit notes'),
    ('sales.debit_note.confirm', 'Sales', 'Confirm customer debit notes'),

    ('purchases.delivery_note.create', 'Purchases', 'Create supplier delivery notes'),
    ('purchases.delivery_note.confirm', 'Purchases', 'Confirm supplier delivery notes'),
    ('purchases.invoice.create', 'Purchases', 'Create supplier invoices'),
    ('purchases.invoice.confirm', 'Purchases', 'Confirm supplier invoices'),
    ('purchases.credit_advice.create', 'Purchases', 'Create supplier credit advices'),
    ('purchases.credit_advice.confirm', 'Purchases', 'Confirm supplier credit advices'),
    ('purchases.debit_advice.create', 'Purchases', 'Create supplier debit advices'),
    ('purchases.debit_advice.confirm', 'Purchases', 'Confirm supplier debit advices'),
    ('purchases.return.create', 'Purchases', 'Create supplier returns'),
    ('purchases.return.confirm', 'Purchases', 'Confirm supplier returns'),

    ('sales.cancel', 'Sales', 'Cancel draft sales documents'),
    ('sales.reverse', 'Sales', 'Reverse confirmed sales documents'),
    ('purchases.cancel', 'Purchases', 'Cancel draft purchase documents'),
    ('purchases.reverse', 'Purchases', 'Reverse confirmed purchase documents')
ON CONFLICT (code) DO NOTHING;

-- Map Document Permissions to ADMIN (All)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000001', id FROM public.permissions
WHERE code LIKE 'documents.%' OR code LIKE 'sales.%' OR code LIKE 'purchases.%'
ON CONFLICT DO NOTHING;

-- Map Document Permissions to MANAGER (All except admin settings)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000002', id FROM public.permissions
WHERE code LIKE 'documents.%' OR code LIKE 'sales.%' OR code LIKE 'purchases.%'
ON CONFLICT DO NOTHING;

COMMIT;
