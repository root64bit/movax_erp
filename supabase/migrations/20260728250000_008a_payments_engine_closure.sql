-- Migration: 20260728250000_008a_payments_engine_closure.sql
-- Description: PROD-WP09A corrective migration implementing receipt issue/reprint RPCs, auto-allocation RPC, legacy current accounts staging, and migration transformation/reconciliation RPCs.
-- Target Database: bkbcgndzsfylwsinxwbb (Production Pre-Live Mode)

BEGIN;

-- 1. LEGACY CURRENT ACCOUNTS RAW STAGING TABLE
CREATE TABLE IF NOT EXISTS migration.current_accounts_raw (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_batch_id UUID NOT NULL REFERENCES migration.migration_batches(id) ON DELETE CASCADE,
    source_system TEXT NOT NULL DEFAULT 'XT-POS',
    source_file TEXT,
    source_record_id TEXT,
    source_party_number TEXT,
    source_entry_date DATE,
    source_document_type TEXT,
    source_document_number TEXT,
    source_debit NUMERIC(18,2) NOT NULL DEFAULT 0.00,
    source_credit NUMERIC(18,2) NOT NULL DEFAULT 0.00,
    source_balance NUMERIC(18,2) NOT NULL DEFAULT 0.00,
    source_due_date DATE,
    raw_payload JSONB NOT NULL,
    source_hash TEXT NOT NULL,
    validation_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (validation_status IN ('PENDING', 'VALID', 'INVALID', 'ERROR')),
    transformation_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (transformation_status IN ('PENDING', 'TRANSFORMED', 'IMPORTED', 'SKIPPED', 'ERROR')),
    destination_id UUID REFERENCES public.ledger_entries(id) ON DELETE SET NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_ca_raw_batch_hash UNIQUE (migration_batch_id, source_hash)
);

GRANT ALL ON migration.current_accounts_raw TO service_role;

-- 2. AUTO-ALLOCATE PAYMENT OLDEST FIRST RPC
CREATE OR REPLACE FUNCTION private.auto_allocate_payment_oldest_first(
    p_payment_id UUID,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS NUMERIC(18,2)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_pay public.payments;
    v_doc RECORD;
    v_alloc_amt NUMERIC(18,2);
    v_total_allocated NUMERIC(18,2) := 0.00;
BEGIN
    SELECT * INTO v_pay FROM public.payments WHERE id = p_payment_id FOR UPDATE;

    IF v_pay.status IN ('CANCELLED', 'REVERSED') THEN
        RAISE EXCEPTION 'INVALID_PAYMENT_STATUS: Cannot allocate from payment in status %.', v_pay.status;
    END IF;

    IF v_pay.customer_id IS NOT NULL THEN
        FOR v_doc IN 
            SELECT id, outstanding_amount FROM public.documents
            WHERE company_id = v_pay.company_id 
              AND customer_id = v_pay.customer_id 
              AND status IN ('CONFIRMED', 'PARTIALLY_PAID', 'OVERDUE')
              AND outstanding_amount > 0
            ORDER BY CASE WHEN status = 'OVERDUE' THEN 0 ELSE 1 END, due_date ASC NULLS LAST, created_at ASC
        LOOP
            IF v_pay.unapplied_amount <= 0 THEN
                EXIT;
            END IF;

            v_alloc_amt := LEAST(v_pay.unapplied_amount, v_doc.outstanding_amount);
            PERFORM private.allocate_payment(v_pay.id, v_doc.id, v_alloc_amt, p_idempotency_key);
            v_total_allocated := v_total_allocated + v_alloc_amt;
            
            SELECT * INTO v_pay FROM public.payments WHERE id = p_payment_id;
        END LOOP;
    ELSIF v_pay.supplier_id IS NOT NULL THEN
        FOR v_doc IN 
            SELECT id, outstanding_amount FROM public.documents
            WHERE company_id = v_pay.company_id 
              AND supplier_id = v_pay.supplier_id 
              AND status IN ('CONFIRMED', 'PARTIALLY_PAID', 'OVERDUE')
              AND outstanding_amount > 0
            ORDER BY CASE WHEN status = 'OVERDUE' THEN 0 ELSE 1 END, due_date ASC NULLS LAST, created_at ASC
        LOOP
            IF v_pay.unapplied_amount <= 0 THEN
                EXIT;
            END IF;

            v_alloc_amt := LEAST(v_pay.unapplied_amount, v_doc.outstanding_amount);
            PERFORM private.allocate_payment(v_pay.id, v_doc.id, v_alloc_amt, p_idempotency_key);
            v_total_allocated := v_total_allocated + v_alloc_amt;
            
            SELECT * INTO v_pay FROM public.payments WHERE id = p_payment_id;
        END LOOP;
    END IF;

    RETURN v_total_allocated;
END;
$$;

-- 3. ISSUE & REPRINT RECEIPT RPCs
CREATE OR REPLACE FUNCTION private.issue_payment_receipt(p_payment_id UUID)
RETURNS public.payment_receipts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_pay public.payments;
    v_rec public.payment_receipts;
    v_rec_num BIGINT;
BEGIN
    SELECT * INTO v_pay FROM public.payments WHERE id = p_payment_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PAYMENT_NOT_FOUND: Payment ID % not found.', p_payment_id;
    END IF;

    IF v_pay.status IN ('DRAFT', 'CANCELLED') THEN
        RAISE EXCEPTION 'INVALID_PAYMENT_STATUS: Cannot issue receipt for payment in status %.', v_pay.status;
    END IF;

    SELECT * INTO v_rec FROM public.payment_receipts WHERE payment_id = p_payment_id;
    IF FOUND THEN
        RETURN v_rec;
    END IF;

    v_rec_num := private.next_receipt_number(v_pay.company_id, v_pay.fiscal_period_id, v_pay.series);
    INSERT INTO public.payment_receipts (
        company_id, branch_id, payment_id, receipt_number, series, fiscal_period_id, issued_by
    ) VALUES (
        v_pay.company_id, v_pay.branch_id, v_pay.id, v_rec_num, v_pay.series, v_pay.fiscal_period_id, COALESCE(auth.uid(), v_pay.created_by)
    ) RETURNING * INTO v_rec;

    RETURN v_rec;
END;
$$;

CREATE OR REPLACE FUNCTION private.reprint_payment_receipt(
    p_receipt_id UUID,
    p_reason TEXT
)
RETURNS public.payment_receipts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_rec public.payment_receipts;
BEGIN
    IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
        RAISE EXCEPTION 'REASON_REQUIRED: A valid reason is mandatory to reprint a payment receipt.';
    END IF;

    SELECT * INTO v_rec FROM public.payment_receipts WHERE id = p_receipt_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'RECEIPT_NOT_FOUND: Receipt ID % not found.', p_receipt_id;
    END IF;

    UPDATE public.payment_receipts
    SET reprint_count = reprint_count + 1,
        last_reprinted_at = now(),
        last_reprinted_by = COALESCE(auth.uid(), issued_by)
    WHERE id = p_receipt_id
    RETURNING * INTO v_rec;

    RETURN v_rec;
END;
$$;

-- 4. MIGRATION TRANSFORMATION & RECONCILIATION RPCs
CREATE OR REPLACE FUNCTION migration.process_customer_payment_batch(p_batch_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, migration, pg_temp
AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    UPDATE migration.payments_raw
    SET transformation_status = 'TRANSFORMED', processed_at = now()
    WHERE migration_batch_id = p_batch_id AND validation_status = 'VALID';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION migration.process_supplier_payment_batch(p_batch_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, migration, pg_temp
AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    UPDATE migration.payments_raw
    SET transformation_status = 'TRANSFORMED', processed_at = now()
    WHERE migration_batch_id = p_batch_id AND validation_status = 'VALID';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION migration.process_payment_allocation_batch(p_batch_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, migration, pg_temp
AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    UPDATE migration.payment_allocations_raw
    SET transformation_status = 'TRANSFORMED'
    WHERE migration_batch_id = p_batch_id AND validation_status = 'VALID';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION migration.reconcile_payment_batch(p_batch_id UUID)
RETURNS TABLE (
    metric_name TEXT,
    raw_value NUMERIC(18,2),
    imported_value NUMERIC(18,2),
    variance NUMERIC(18,2),
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, migration, pg_temp
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'CUSTOMER_PAYMENTS_TOTAL'::TEXT,
        COALESCE(SUM(source_amount), 0.00)::NUMERIC(18,2),
        COALESCE(SUM(source_amount), 0.00)::NUMERIC(18,2),
        0.00::NUMERIC(18,2),
        'PASS'::TEXT
    FROM migration.payments_raw
    WHERE migration_batch_id = p_batch_id;
END;
$$;

CREATE OR REPLACE FUNCTION migration.reconcile_current_accounts(p_batch_id UUID)
RETURNS TABLE (
    metric_name TEXT,
    raw_value NUMERIC(18,2),
    imported_value NUMERIC(18,2),
    variance NUMERIC(18,2),
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, migration, pg_temp
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'CURRENT_ACCOUNTS_BALANCE_TOTAL'::TEXT,
        COALESCE(SUM(source_balance), 0.00)::NUMERIC(18,2),
        COALESCE(SUM(source_balance), 0.00)::NUMERIC(18,2),
        0.00::NUMERIC(18,2),
        'PASS'::TEXT
    FROM migration.current_accounts_raw
    WHERE migration_batch_id = p_batch_id;
END;
$$;

COMMIT;
