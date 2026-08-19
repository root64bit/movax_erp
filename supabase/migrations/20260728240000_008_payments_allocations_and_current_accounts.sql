-- Migration: 20260728240000_008_payments_allocations_and_current_accounts.sql
-- Description: Complete payments, payment allocations, receipts, reversals, current accounts, and legacy payment staging engine.
-- Target Database: bkbcgndzsfylwsinxwbb (Production Pre-Live Mode)

BEGIN;

-- 1. PAYMENT METHODS
CREATE TABLE IF NOT EXISTS public.payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    method_type TEXT NOT NULL CHECK (method_type IN ('CASH', 'BANK_TRANSFER', 'BANK_CARD', 'MOBILE_MONEY', 'CHEQUE', 'OTHER')),
    requires_reference BOOLEAN NOT NULL DEFAULT false,
    requires_bank_account BOOLEAN NOT NULL DEFAULT false,
    allows_customer_receipt BOOLEAN NOT NULL DEFAULT true,
    allows_supplier_payment BOOLEAN NOT NULL DEFAULT true,
    allows_mixed_payment BOOLEAN NOT NULL DEFAULT true,
    active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    CONSTRAINT uq_payment_method_code UNIQUE (company_id, code)
);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;

DROP POLICY IF EXISTS "payment_methods_select" ON public.payment_methods;
CREATE POLICY "payment_methods_select" ON public.payment_methods
    FOR SELECT TO authenticated USING (true);

-- Seed Payment Methods
INSERT INTO public.payment_methods (id, company_id, code, name, method_type, requires_reference, display_order) VALUES
    ('40000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'CASH', 'Dinheiro', 'CASH', false, 1),
    ('40000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'BANK_TRANSFER', 'Transferência Bancária', 'BANK_TRANSFER', true, 2),
    ('40000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'BANK_CARD', 'Cartão Bancário POS', 'BANK_CARD', true, 3),
    ('40000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'MPESA', 'M-Pesa', 'MOBILE_MONEY', true, 4),
    ('40000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'EMOLA', 'e-Mola', 'MOBILE_MONEY', true, 5),
    ('40000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'MKESH', 'mKesh', 'MOBILE_MONEY', true, 6),
    ('40000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'CHEQUE', 'Cheque', 'CHEQUE', true, 7),
    ('40000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'OTHER', 'Outro', 'OTHER', false, 8)
ON CONFLICT (company_id, code) DO NOTHING;

-- 2. PAYMENTS (HEADER TABLE)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    payment_number BIGINT,
    display_number TEXT,
    series TEXT NOT NULL DEFAULT 'A',
    fiscal_period_id UUID NOT NULL REFERENCES public.fiscal_periods(id) ON DELETE RESTRICT,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    direction TEXT NOT NULL CHECK (direction IN ('CUSTOMER_RECEIPT', 'SUPPLIER_PAYMENT')),
    customer_id UUID REFERENCES public.customers(id) ON DELETE RESTRICT,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    currency_code TEXT NOT NULL DEFAULT 'MZN',
    exchange_rate NUMERIC(18,6) NOT NULL DEFAULT 1.000000 CHECK (exchange_rate > 0),
    total_amount NUMERIC(18,2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    allocated_amount NUMERIC(18,2) NOT NULL DEFAULT 0.00 CHECK (allocated_amount >= 0),
    unapplied_amount NUMERIC(18,2) NOT NULL DEFAULT 0.00 CHECK (unapplied_amount >= 0),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
        'DRAFT', 'CONFIRMED', 'PARTIALLY_ALLOCATED', 'FULLY_ALLOCATED', 'REVERSED', 'CANCELLED'
    )),
    external_reference TEXT,
    description TEXT,
    idempotency_key TEXT,
    legacy_id TEXT,
    migration_batch_id UUID REFERENCES migration.migration_batches(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    confirmed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMPTZ,
    reversed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    reversed_at TIMESTAMPTZ,
    reversal_reason TEXT,
    reversal_payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_payment_party_direction CHECK (
        (direction = 'CUSTOMER_RECEIPT' AND customer_id IS NOT NULL AND supplier_id IS NULL) OR
        (direction = 'SUPPLIER_PAYMENT' AND supplier_id IS NOT NULL AND customer_id IS NULL)
    ),
    CONSTRAINT chk_allocated_unapplied_sum CHECK (allocated_amount <= total_amount),
    CONSTRAINT uq_payment_company_idempotency UNIQUE (company_id, idempotency_key)
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

DROP POLICY IF EXISTS "payments_select" ON public.payments;
CREATE POLICY "payments_select" ON public.payments
    FOR SELECT TO authenticated USING (
        company_id = public.get_user_company_id() AND public.has_permission('payments.view')
    );

DROP POLICY IF EXISTS "payments_insert" ON public.payments;
CREATE POLICY "payments_insert" ON public.payments
    FOR INSERT TO authenticated WITH CHECK (
        company_id = public.get_user_company_id()
    );

DROP POLICY IF EXISTS "payments_update" ON public.payments;
CREATE POLICY "payments_update" ON public.payments
    FOR UPDATE TO authenticated USING (
        company_id = public.get_user_company_id() AND status = 'DRAFT'
    );

CREATE UNIQUE INDEX IF NOT EXISTS uq_confirmed_payment_number 
ON public.payments (company_id, direction, series, fiscal_period_id, payment_number) 
WHERE status NOT IN ('DRAFT', 'CANCELLED');

-- 3. PAYMENT METHOD ENTRIES
CREATE TABLE IF NOT EXISTS public.payment_method_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    payment_method_id UUID NOT NULL REFERENCES public.payment_methods(id) ON DELETE RESTRICT,
    amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    reference TEXT,
    bank_name TEXT,
    account_reference TEXT,
    card_last_four TEXT,
    mobile_number_masked TEXT,
    cheque_number TEXT,
    cheque_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_payment_method_entry_line UNIQUE (payment_id, line_number)
);

ALTER TABLE public.payment_method_entries ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_method_entries TO authenticated;
GRANT ALL ON public.payment_method_entries TO service_role;

DROP POLICY IF EXISTS "payment_method_entries_select" ON public.payment_method_entries;
CREATE POLICY "payment_method_entries_select" ON public.payment_method_entries
    FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());

-- 4. PAYMENT ALLOCATIONS
CREATE TABLE IF NOT EXISTS public.payment_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE RESTRICT,
    amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    allocation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    allocation_order INTEGER,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVERSED')),
    idempotency_key TEXT,
    reversal_allocation_id UUID REFERENCES public.payment_allocations(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
    reversed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    reversed_at TIMESTAMPTZ,
    reversal_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.payment_allocations TO authenticated;
GRANT ALL ON public.payment_allocations TO service_role;

DROP POLICY IF EXISTS "payment_allocations_select" ON public.payment_allocations;
CREATE POLICY "payment_allocations_select" ON public.payment_allocations
    FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());

-- 5. PAYMENT REVERSALS
CREATE TABLE IF NOT EXISTS public.payment_reversals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    original_payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT UNIQUE,
    reversal_payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT UNIQUE,
    reason TEXT NOT NULL,
    reversed_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
    reversed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    correlation_id UUID NOT NULL DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_reversals ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.payment_reversals TO authenticated;
GRANT ALL ON public.payment_reversals TO service_role;

DROP POLICY IF EXISTS "payment_reversals_select" ON public.payment_reversals;
CREATE POLICY "payment_reversals_select" ON public.payment_reversals
    FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());

-- 6. PAYMENT RECEIPTS
CREATE TABLE IF NOT EXISTS public.payment_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT UNIQUE,
    receipt_number BIGINT NOT NULL,
    series TEXT NOT NULL DEFAULT 'A',
    fiscal_period_id UUID NOT NULL REFERENCES public.fiscal_periods(id) ON DELETE RESTRICT,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    issued_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
    reprint_count INTEGER NOT NULL DEFAULT 0 CHECK (reprint_count >= 0),
    last_reprinted_at TIMESTAMPTZ,
    last_reprinted_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    pdf_storage_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_receipt_number UNIQUE (company_id, series, fiscal_period_id, receipt_number)
);

ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.payment_receipts TO authenticated;
GRANT ALL ON public.payment_receipts TO service_role;

DROP POLICY IF EXISTS "payment_receipts_select" ON public.payment_receipts;
CREATE POLICY "payment_receipts_select" ON public.payment_receipts
    FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());

-- ────────────────────────────────────────────────────────────
-- SEQUENCE GENERATORS FOR PAYMENTS & RECEIPTS
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.next_payment_number(
    p_company_id UUID,
    p_direction TEXT,
    p_fiscal_period_id UUID,
    p_series TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_next_num BIGINT;
BEGIN
    UPDATE public.document_sequences
    SET current_number = current_number + 1,
        updated_at = now()
    WHERE company_id = p_company_id 
      AND document_type = p_direction 
      AND series = p_series 
      AND fiscal_period_id = p_fiscal_period_id
    RETURNING current_number INTO v_next_num;

    IF NOT FOUND THEN
        INSERT INTO public.document_sequences (
            company_id, document_type, series, current_number, fiscal_period_id, prefix
        ) VALUES (
            p_company_id, p_direction, p_series, 1, p_fiscal_period_id, p_direction || ' ' || p_series || '/'
        ) RETURNING current_number INTO v_next_num;
    END IF;

    RETURN v_next_num;
END;
$$;

CREATE OR REPLACE FUNCTION private.next_receipt_number(
    p_company_id UUID,
    p_fiscal_period_id UUID,
    p_series TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_next_num BIGINT;
BEGIN
    UPDATE public.document_sequences
    SET current_number = current_number + 1,
        updated_at = now()
    WHERE company_id = p_company_id 
      AND document_type = 'RECEIPT' 
      AND series = p_series 
      AND fiscal_period_id = p_fiscal_period_id
    RETURNING current_number INTO v_next_num;

    IF NOT FOUND THEN
        INSERT INTO public.document_sequences (
            company_id, document_type, series, current_number, fiscal_period_id, prefix
        ) VALUES (
            p_company_id, 'RECEIPT', p_series, 1, p_fiscal_period_id, 'REC ' || p_series || '/'
        ) RETURNING current_number INTO v_next_num;
    END IF;

    RETURN v_next_num;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- BALANCE REFRESH PROCEDURES (SOURCE OF TRUTH DERIVATION)
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.refresh_customer_balance(p_customer_id UUID)
RETURNS NUMERIC(18,2)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_bal NUMERIC(18,2) := 0.00;
BEGIN
    SELECT COALESCE(SUM(debit_amount - credit_amount), 0.00) INTO v_bal
    FROM public.ledger_entries
    WHERE customer_id = p_customer_id AND status = 'CONFIRMED';

    UPDATE public.customers
    SET current_balance = v_bal, updated_at = now()
    WHERE id = p_customer_id;

    RETURN v_bal;
END;
$$;

CREATE OR REPLACE FUNCTION private.refresh_supplier_balance(p_supplier_id UUID)
RETURNS NUMERIC(18,2)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_bal NUMERIC(18,2) := 0.00;
BEGIN
    SELECT COALESCE(SUM(credit_amount - debit_amount), 0.00) INTO v_bal
    FROM public.ledger_entries
    WHERE supplier_id = p_supplier_id AND status = 'CONFIRMED';

    UPDATE public.suppliers
    SET current_balance = v_bal, updated_at = now()
    WHERE id = p_supplier_id;

    RETURN v_bal;
END;
$$;

CREATE OR REPLACE FUNCTION private.refresh_document_payment_status(p_document_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_doc public.documents;
    v_allocated NUMERIC(18,2) := 0.00;
    v_new_paid NUMERIC(18,2) := 0.00;
    v_new_out NUMERIC(18,2) := 0.00;
    v_new_status TEXT;
BEGIN
    SELECT * INTO v_doc FROM public.documents WHERE id = p_document_id FOR UPDATE;

    IF v_doc.status IN ('CANCELLED', 'REVERSED') THEN
        RETURN;
    END IF;

    SELECT COALESCE(SUM(amount), 0.00) INTO v_allocated
    FROM public.payment_allocations
    WHERE document_id = p_document_id AND status = 'ACTIVE';

    v_new_paid := v_allocated;
    v_new_out := v_doc.grand_total - v_new_paid;

    IF v_new_out <= 0 THEN
        v_new_status := 'PAID';
        v_new_out := 0.00;
    ELSIF v_new_paid > 0 THEN
        v_new_status := 'PARTIALLY_PAID';
    ELSE
        IF v_doc.due_date IS NOT NULL AND v_doc.due_date < CURRENT_DATE THEN
            v_new_status := 'OVERDUE';
        ELSE
            v_new_status := 'CONFIRMED';
        END IF;
    END IF;

    UPDATE public.documents
    SET amount_paid = v_new_paid,
        outstanding_amount = v_new_out,
        status = v_new_status,
        updated_at = now()
    WHERE id = p_document_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- ALLOCATION RPCs WITH ATOMIC ROW LOCKING & INVARIANT GUARDS
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.allocate_payment(
    p_payment_id UUID,
    p_document_id UUID,
    p_amount NUMERIC(18,2),
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_pay public.payments;
    v_doc public.documents;
    v_alloc_id UUID;
BEGIN
    SELECT * INTO v_pay FROM public.payments WHERE id = p_payment_id FOR UPDATE;
    SELECT * INTO v_doc FROM public.documents WHERE id = p_document_id FOR UPDATE;

    IF v_pay.status IN ('CANCELLED', 'REVERSED') THEN
        RAISE EXCEPTION 'INVALID_PAYMENT_STATUS: Cannot allocate from payment in status %.', v_pay.status;
    END IF;

    IF v_doc.status IN ('CANCELLED', 'REVERSED') THEN
        RAISE EXCEPTION 'INVALID_DOCUMENT_STATUS: Cannot allocate to document in status %.', v_doc.status;
    END IF;

    IF v_pay.company_id <> v_doc.company_id THEN
        RAISE EXCEPTION 'CROSS_COMPANY_REJECTED: Payment and document must belong to the same company.';
    END IF;

    IF p_amount > v_pay.unapplied_amount THEN
        RAISE EXCEPTION 'EXCEEDS_UNAPPLIED_AMOUNT: Allocation amount % exceeds payment unapplied amount %.', p_amount, v_pay.unapplied_amount;
    END IF;

    IF p_amount > v_doc.outstanding_amount THEN
        RAISE EXCEPTION 'EXCEEDS_OUTSTANDING_AMOUNT: Allocation amount % exceeds document outstanding amount %.', p_amount, v_doc.outstanding_amount;
    END IF;

    INSERT INTO public.payment_allocations (
        company_id, payment_id, document_id, amount, allocation_date, status, idempotency_key, created_by
    ) VALUES (
        v_pay.company_id, v_pay.id, v_doc.id, p_amount, CURRENT_DATE, 'ACTIVE', p_idempotency_key, COALESCE(auth.uid(), v_pay.created_by)
    ) RETURNING id INTO v_alloc_id;

    UPDATE public.payments
    SET allocated_amount = allocated_amount + p_amount,
        unapplied_amount = unapplied_amount - p_amount,
        status = CASE WHEN unapplied_amount - p_amount = 0 THEN 'FULLY_ALLOCATED' ELSE 'PARTIALLY_ALLOCATED' END,
        updated_at = now()
    WHERE id = p_payment_id;

    PERFORM private.refresh_document_payment_status(p_document_id);

    RETURN v_alloc_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- PAYMENT CONFIRMATION RPCs
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.confirm_customer_payment(
    p_payment_id UUID,
    p_idempotency_key TEXT DEFAULT NULL,
    p_allocation_mode TEXT DEFAULT 'NONE'
)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_pay public.payments;
    v_next_num BIGINT;
    v_rec_num BIGINT;
    v_display_num TEXT;
    v_method_sum NUMERIC(18,2);
    v_doc RECORD;
    v_alloc_amt NUMERIC(18,2);
BEGIN
    SELECT * INTO v_pay FROM public.payments WHERE id = p_payment_id FOR UPDATE;

    IF v_pay.status <> 'DRAFT' THEN
        IF v_pay.idempotency_key IS NOT NULL AND v_pay.idempotency_key = p_idempotency_key THEN
            RETURN v_pay;
        ELSE
            RAISE EXCEPTION 'INVALID_STATUS: Payment % is already %.', p_payment_id, v_pay.status;
        END IF;
    END IF;

    SELECT COALESCE(SUM(amount), 0.00) INTO v_method_sum
    FROM public.payment_method_entries WHERE payment_id = p_payment_id;

    IF v_method_sum <> v_pay.total_amount THEN
        RAISE EXCEPTION 'METHOD_SUM_MISMATCH: Payment methods sum % does not equal total amount %.', v_method_sum, v_pay.total_amount;
    END IF;

    v_next_num := private.next_payment_number(v_pay.company_id, v_pay.direction, v_pay.fiscal_period_id, v_pay.series);
    v_display_num := 'REC ' || v_pay.series || '/' || LPAD(v_next_num::TEXT, 6, '0');

    INSERT INTO public.ledger_entries (
        company_id, branch_id, party_type, customer_id, entry_date, entry_type,
        debit_amount, credit_amount, outstanding_amount, status, created_by
    ) VALUES (
        v_pay.company_id, v_pay.branch_id, 'CUSTOMER', v_pay.customer_id, v_pay.payment_date, 'CUSTOMER_PAYMENT',
        0.00, v_pay.total_amount, v_pay.total_amount, 'CONFIRMED', COALESCE(auth.uid(), v_pay.created_by)
    );

    PERFORM private.refresh_customer_balance(v_pay.customer_id);

    UPDATE public.payments
    SET status = 'CONFIRMED',
        payment_number = v_next_num,
        display_number = v_display_num,
        unapplied_amount = total_amount,
        confirmed_by = COALESCE(auth.uid(), v_pay.created_by),
        confirmed_at = now(),
        idempotency_key = COALESCE(p_idempotency_key, idempotency_key),
        updated_at = now()
    WHERE id = p_payment_id
    RETURNING * INTO v_pay;

    v_rec_num := private.next_receipt_number(v_pay.company_id, v_pay.fiscal_period_id, v_pay.series);
    INSERT INTO public.payment_receipts (
        company_id, branch_id, payment_id, receipt_number, series, fiscal_period_id, issued_by
    ) VALUES (
        v_pay.company_id, v_pay.branch_id, v_pay.id, v_rec_num, v_pay.series, v_pay.fiscal_period_id, COALESCE(auth.uid(), v_pay.created_by)
    ) ON CONFLICT (payment_id) DO NOTHING;

    IF p_allocation_mode = 'OLDEST_FIRST' THEN
        FOR v_doc IN 
            SELECT id, outstanding_amount FROM public.documents
            WHERE company_id = v_pay.company_id 
              AND customer_id = v_pay.customer_id 
              AND status IN ('CONFIRMED', 'PARTIALLY_PAID', 'OVERDUE')
              AND outstanding_amount > 0
            ORDER BY due_date ASC NULLS LAST, created_at ASC
        LOOP
            IF v_pay.unapplied_amount <= 0 THEN
                EXIT;
            END IF;

            v_alloc_amt := LEAST(v_pay.unapplied_amount, v_doc.outstanding_amount);
            PERFORM private.allocate_payment(v_pay.id, v_doc.id, v_alloc_amt);
            
            SELECT * INTO v_pay FROM public.payments WHERE id = p_payment_id;
        END LOOP;
    END IF;

    RETURN v_pay;
END;
$$;

CREATE OR REPLACE FUNCTION private.confirm_supplier_payment(
    p_payment_id UUID,
    p_idempotency_key TEXT DEFAULT NULL,
    p_allocation_mode TEXT DEFAULT 'NONE'
)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_pay public.payments;
    v_next_num BIGINT;
    v_display_num TEXT;
    v_method_sum NUMERIC(18,2);
    v_doc RECORD;
    v_alloc_amt NUMERIC(18,2);
BEGIN
    SELECT * INTO v_pay FROM public.payments WHERE id = p_payment_id FOR UPDATE;

    IF v_pay.status <> 'DRAFT' THEN
        IF v_pay.idempotency_key IS NOT NULL AND v_pay.idempotency_key = p_idempotency_key THEN
            RETURN v_pay;
        ELSE
            RAISE EXCEPTION 'INVALID_STATUS: Payment % is already %.', p_payment_id, v_pay.status;
        END IF;
    END IF;

    SELECT COALESCE(SUM(amount), 0.00) INTO v_method_sum
    FROM public.payment_method_entries WHERE payment_id = p_payment_id;

    IF v_method_sum <> v_pay.total_amount THEN
        RAISE EXCEPTION 'METHOD_SUM_MISMATCH: Payment methods sum % does not equal total amount %.', v_method_sum, v_pay.total_amount;
    END IF;

    v_next_num := private.next_payment_number(v_pay.company_id, v_pay.direction, v_pay.fiscal_period_id, v_pay.series);
    v_display_num := 'PAG ' || v_pay.series || '/' || LPAD(v_next_num::TEXT, 6, '0');

    INSERT INTO public.ledger_entries (
        company_id, branch_id, party_type, supplier_id, entry_date, entry_type,
        debit_amount, credit_amount, outstanding_amount, status, created_by
    ) VALUES (
        v_pay.company_id, v_pay.branch_id, 'SUPPLIER', v_pay.supplier_id, v_pay.payment_date, 'SUPPLIER_PAYMENT',
        v_pay.total_amount, 0.00, v_pay.total_amount, 'CONFIRMED', COALESCE(auth.uid(), v_pay.created_by)
    );

    PERFORM private.refresh_supplier_balance(v_pay.supplier_id);

    UPDATE public.payments
    SET status = 'CONFIRMED',
        payment_number = v_next_num,
        display_number = v_display_num,
        unapplied_amount = total_amount,
        confirmed_by = COALESCE(auth.uid(), v_pay.created_by),
        confirmed_at = now(),
        idempotency_key = COALESCE(p_idempotency_key, idempotency_key),
        updated_at = now()
    WHERE id = p_payment_id
    RETURNING * INTO v_pay;

    IF p_allocation_mode = 'OLDEST_FIRST' THEN
        FOR v_doc IN 
            SELECT id, outstanding_amount FROM public.documents
            WHERE company_id = v_pay.company_id 
              AND supplier_id = v_pay.supplier_id 
              AND status IN ('CONFIRMED', 'PARTIALLY_PAID', 'OVERDUE')
              AND outstanding_amount > 0
            ORDER BY due_date ASC NULLS LAST, created_at ASC
        LOOP
            IF v_pay.unapplied_amount <= 0 THEN
                EXIT;
            END IF;

            v_alloc_amt := LEAST(v_pay.unapplied_amount, v_doc.outstanding_amount);
            PERFORM private.allocate_payment(v_pay.id, v_doc.id, v_alloc_amt);
            
            SELECT * INTO v_pay FROM public.payments WHERE id = p_payment_id;
        END LOOP;
    END IF;

    RETURN v_pay;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- TRANSACTIONAL PAYMENT REVERSAL RPC
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.reverse_payment(
    p_payment_id UUID,
    p_reason TEXT,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_pay public.payments;
    v_alloc RECORD;
BEGIN
    SELECT * INTO v_pay FROM public.payments WHERE id = p_payment_id FOR UPDATE;

    IF v_pay.status = 'REVERSED' THEN
        RAISE EXCEPTION 'ALREADY_REVERSED: Payment % is already reversed.', p_payment_id;
    END IF;

    IF v_pay.status <> 'CONFIRMED' AND v_pay.status <> 'PARTIALLY_ALLOCATED' AND v_pay.status <> 'FULLY_ALLOCATED' THEN
        RAISE EXCEPTION 'INVALID_STATUS: Cannot reverse payment in status %.', v_pay.status;
    END IF;

    -- Reverse active allocations
    FOR v_alloc IN SELECT * FROM public.payment_allocations WHERE payment_id = p_payment_id AND status = 'ACTIVE' LOOP
        UPDATE public.payment_allocations
        SET status = 'REVERSED',
            reversed_by = COALESCE(auth.uid(), v_pay.created_by),
            reversed_at = now(),
            reversal_reason = p_reason
        WHERE id = v_alloc.id;

        PERFORM private.refresh_document_payment_status(v_alloc.document_id);
    END LOOP;

    -- Reverse Ledger Entry
    UPDATE public.ledger_entries
    SET status = 'REVERSED'
    WHERE (customer_id = v_pay.customer_id OR supplier_id = v_pay.supplier_id)
      AND entry_type IN ('CUSTOMER_PAYMENT', 'SUPPLIER_PAYMENT')
      AND created_at >= v_pay.created_at - INTERVAL '5 seconds'
      AND created_at <= v_pay.created_at + INTERVAL '5 seconds';

    -- Refresh Party Balance
    IF v_pay.customer_id IS NOT NULL THEN
        PERFORM private.refresh_customer_balance(v_pay.customer_id);
    ELSIF v_pay.supplier_id IS NOT NULL THEN
        PERFORM private.refresh_supplier_balance(v_pay.supplier_id);
    END IF;

    -- Update Payment Header
    UPDATE public.payments
    SET status = 'REVERSED',
        allocated_amount = 0.00,
        unapplied_amount = 0.00,
        reversed_by = COALESCE(auth.uid(), v_pay.created_by),
        reversed_at = now(),
        reversal_reason = p_reason,
        updated_at = now()
    WHERE id = p_payment_id;

    -- Record Payment Reversal Entry
    INSERT INTO public.payment_reversals (
        company_id, original_payment_id, reversal_payment_id, reason, reversed_by
    ) VALUES (
        v_pay.company_id, v_pay.id, v_pay.id, p_reason, COALESCE(auth.uid(), v_pay.created_by)
    ) ON CONFLICT DO NOTHING;

    RETURN p_payment_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- CURRENT ACCOUNT VIEWS
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.customer_current_account_view AS
SELECT 
    l.company_id,
    l.customer_id,
    l.entry_date,
    l.due_date,
    l.entry_type,
    l.debit_amount,
    l.credit_amount,
    (l.debit_amount - l.credit_amount) AS net_amount,
    l.outstanding_amount,
    l.status,
    l.source_document_id,
    l.created_at
FROM public.ledger_entries l
WHERE l.party_type = 'CUSTOMER' AND l.status = 'CONFIRMED';

CREATE OR REPLACE VIEW public.supplier_current_account_view AS
SELECT 
    l.company_id,
    l.supplier_id,
    l.entry_date,
    l.due_date,
    l.entry_type,
    l.debit_amount,
    l.credit_amount,
    (l.credit_amount - l.debit_amount) AS net_amount,
    l.outstanding_amount,
    l.status,
    l.source_document_id,
    l.created_at
FROM public.ledger_entries l
WHERE l.party_type = 'SUPPLIER' AND l.status = 'CONFIRMED';

-- ────────────────────────────────────────────────────────────
-- RAW LEGACY PAYMENT STAGING TABLES (migration SCHEMA)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS migration.payments_raw (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_batch_id UUID NOT NULL REFERENCES migration.migration_batches(id) ON DELETE CASCADE,
    source_system TEXT NOT NULL DEFAULT 'XT-POS',
    source_table TEXT,
    source_file TEXT,
    source_record_id TEXT,
    source_row_number INTEGER,
    source_payment_number TEXT,
    source_payment_date TEXT,
    source_customer_number TEXT,
    source_supplier_number TEXT,
    source_amount NUMERIC(18,2),
    source_method TEXT,
    source_reference TEXT,
    raw_payload JSONB NOT NULL,
    source_hash TEXT NOT NULL,
    validation_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (validation_status IN ('PENDING', 'VALID', 'INVALID', 'ERROR')),
    validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
    transformation_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (transformation_status IN ('PENDING', 'TRANSFORMED', 'IMPORTED', 'SKIPPED', 'ERROR')),
    destination_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    CONSTRAINT uq_payment_raw_batch_hash UNIQUE (migration_batch_id, source_hash)
);

GRANT ALL ON migration.payments_raw TO service_role;

CREATE TABLE IF NOT EXISTS migration.payment_allocations_raw (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_batch_id UUID NOT NULL REFERENCES migration.migration_batches(id) ON DELETE CASCADE,
    source_system TEXT NOT NULL DEFAULT 'XT-POS',
    source_file TEXT,
    source_record_id TEXT,
    source_payment_number TEXT,
    source_document_number TEXT,
    source_allocated_amount NUMERIC(18,2),
    raw_payload JSONB NOT NULL,
    source_hash TEXT NOT NULL,
    validation_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (validation_status IN ('PENDING', 'VALID', 'INVALID', 'ERROR')),
    transformation_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (transformation_status IN ('PENDING', 'TRANSFORMED', 'IMPORTED', 'SKIPPED', 'ERROR')),
    destination_id UUID REFERENCES public.payment_allocations(id) ON DELETE SET NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_alloc_raw_batch_hash UNIQUE (migration_batch_id, source_hash)
);

GRANT ALL ON migration.payment_allocations_raw TO service_role;

-- ────────────────────────────────────────────────────────────
-- SEED REPEAT-SAFE PERMISSIONS FOR PAYMENTS
-- ────────────────────────────────────────────────────────────

INSERT INTO public.permissions (code, module, description) VALUES
    ('payments.view', 'Payments', 'View payment lists and receipts'),
    ('payments.receive', 'Payments', 'Receive customer payments'),
    ('payments.pay_supplier', 'Payments', 'Execute supplier payments'),
    ('payments.allocate_customer', 'Payments', 'Allocate customer payments to invoices'),
    ('payments.allocate_supplier', 'Payments', 'Allocate supplier payments to invoices'),
    ('payments.reverse', 'Payments', 'Reverse confirmed payments'),
    ('payments.reprint', 'Payments', 'Reprint payment receipts'),
    ('current_accounts.customer.view', 'Accounts', 'View customer current account statements'),
    ('current_accounts.supplier.view', 'Accounts', 'View supplier current account statements'),
    ('current_accounts.reconcile', 'Accounts', 'Reconcile customer and supplier accounts')
ON CONFLICT (code) DO NOTHING;

-- Map Payment Permissions to ADMIN & MANAGER
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000001', id FROM public.permissions
WHERE code LIKE 'payments.%' OR code LIKE 'current_accounts.%'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000002', id FROM public.permissions
WHERE code LIKE 'payments.%' OR code LIKE 'current_accounts.%'
ON CONFLICT DO NOTHING;

-- Map Payment Permissions to CASHIER
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000005', id FROM public.permissions
WHERE code IN ('payments.view', 'payments.receive', 'payments.allocate_customer', 'payments.reprint', 'current_accounts.customer.view')
ON CONFLICT DO NOTHING;

COMMIT;
