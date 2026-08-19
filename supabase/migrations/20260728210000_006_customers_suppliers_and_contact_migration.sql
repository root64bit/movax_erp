-- Migration: 20260728210000_006_customers_suppliers_and_contact_migration.sql
-- Description: Customer and supplier master-data foundation, payment terms, addresses, contacts, supplier bank accounts, protected opening balance RPCs, raw contact migration staging, transformation, and reconciliation functions.
-- Target Database: bkbcgndzsfylwsinxwbb (Production Pre-Live Mode)

BEGIN;

-- 1. PAYMENT TERMS
CREATE TABLE IF NOT EXISTS public.payment_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    payment_days INTEGER NOT NULL DEFAULT 0 CHECK (payment_days >= 0),
    requires_immediate_payment BOOLEAN NOT NULL DEFAULT false,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    CONSTRAINT uq_payment_term_company_code UNIQUE (company_id, code)
);

ALTER TABLE public.payment_terms ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.payment_terms TO authenticated;
GRANT ALL ON public.payment_terms TO service_role;

CREATE POLICY "payment_terms_select" ON public.payment_terms
    FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());

-- Seed Payment Terms
INSERT INTO public.payment_terms (id, company_id, code, name, payment_days, requires_immediate_payment) VALUES
    ('21000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'DINHEIRO', 'A Dinheiro', 0, true),
    ('21000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', '7_DIAS', '7 Dias', 7, false),
    ('21000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000001', '15_DIAS', '15 Dias', 15, false),
    ('21000000-0000-0000-0000-000000000030', 'a0000000-0000-0000-0000-000000000001', '30_DIAS', '30 Dias', 30, false),
    ('21000000-0000-0000-0000-000000000060', 'a0000000-0000-0000-0000-000000000001', '60_DIAS', '60 Dias', 60, false)
ON CONFLICT (company_id, code) DO NOTHING;

-- 2. CUSTOMERS
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    branch_id UUID REFERENCES public.branches(id) ON DELETE RESTRICT,
    legacy_id TEXT,
    customer_number TEXT NOT NULL,
    name TEXT NOT NULL,
    trade_name TEXT,
    tax_number TEXT,
    telephone TEXT,
    mobile_phone TEXT,
    email TEXT,
    payment_term_id UUID REFERENCES public.payment_terms(id) ON DELETE SET NULL,
    credit_limit NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
    opening_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
    current_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
    salesperson_name TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    migrated_at TIMESTAMPTZ,
    migration_batch_id UUID REFERENCES migration.migration_batches(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    CONSTRAINT uq_customer_company_number UNIQUE (company_id, customer_number),
    CONSTRAINT uq_customer_company_legacy_id UNIQUE (company_id, legacy_id)
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;

CREATE POLICY "customers_select" ON public.customers
    FOR SELECT TO authenticated USING (
        company_id = public.get_user_company_id() AND public.has_permission('customers.view')
    );

CREATE POLICY "customers_insert" ON public.customers
    FOR INSERT TO authenticated WITH CHECK (
        company_id = public.get_user_company_id() AND public.has_permission('customers.create')
    );

CREATE POLICY "customers_update" ON public.customers
    FOR UPDATE TO authenticated USING (
        company_id = public.get_user_company_id() AND public.has_permission('customers.update')
    );

-- 3. CUSTOMER ADDRESSES
CREATE TABLE IF NOT EXISTS public.customer_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    address_type TEXT NOT NULL CHECK (address_type IN ('BILLING', 'DELIVERY', 'GENERAL')),
    address_line_1 TEXT NOT NULL,
    address_line_2 TEXT,
    city TEXT,
    province TEXT,
    postal_code TEXT,
    country_code TEXT NOT NULL DEFAULT 'MZ',
    is_primary BOOLEAN NOT NULL DEFAULT false,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.customer_addresses TO authenticated;
GRANT ALL ON public.customer_addresses TO service_role;

CREATE POLICY "customer_addresses_select" ON public.customer_addresses
    FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());

-- 4. CUSTOMER CONTACTS
CREATE TABLE IF NOT EXISTS public.customer_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    position TEXT,
    telephone TEXT,
    mobile_phone TEXT,
    email TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.customer_contacts TO authenticated;
GRANT ALL ON public.customer_contacts TO service_role;

CREATE POLICY "customer_contacts_select" ON public.customer_contacts
    FOR SELECT TO authenticated USING (
        company_id = public.get_user_company_id() AND public.has_permission('customers.view_contacts')
    );

-- 5. SUPPLIERS
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    branch_id UUID REFERENCES public.branches(id) ON DELETE RESTRICT,
    legacy_id TEXT,
    supplier_number TEXT NOT NULL,
    name TEXT NOT NULL,
    trade_name TEXT,
    tax_number TEXT,
    telephone TEXT,
    mobile_phone TEXT,
    email TEXT,
    payment_term_id UUID REFERENCES public.payment_terms(id) ON DELETE SET NULL,
    credit_limit NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
    opening_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
    current_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
    contact_person TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    migrated_at TIMESTAMPTZ,
    migration_batch_id UUID REFERENCES migration.migration_batches(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    CONSTRAINT uq_supplier_company_number UNIQUE (company_id, supplier_number),
    CONSTRAINT uq_supplier_company_legacy_id UNIQUE (company_id, legacy_id)
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;

CREATE POLICY "suppliers_select" ON public.suppliers
    FOR SELECT TO authenticated USING (
        company_id = public.get_user_company_id() AND public.has_permission('suppliers.view')
    );

CREATE POLICY "suppliers_insert" ON public.suppliers
    FOR INSERT TO authenticated WITH CHECK (
        company_id = public.get_user_company_id() AND public.has_permission('suppliers.create')
    );

CREATE POLICY "suppliers_update" ON public.suppliers
    FOR UPDATE TO authenticated USING (
        company_id = public.get_user_company_id() AND public.has_permission('suppliers.update')
    );

-- 6. SUPPLIER ADDRESSES
CREATE TABLE IF NOT EXISTS public.supplier_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    address_type TEXT NOT NULL CHECK (address_type IN ('BILLING', 'DELIVERY', 'GENERAL')),
    address_line_1 TEXT NOT NULL,
    address_line_2 TEXT,
    city TEXT,
    province TEXT,
    postal_code TEXT,
    country_code TEXT NOT NULL DEFAULT 'MZ',
    is_primary BOOLEAN NOT NULL DEFAULT false,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_addresses ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.supplier_addresses TO authenticated;
GRANT ALL ON public.supplier_addresses TO service_role;

CREATE POLICY "supplier_addresses_select" ON public.supplier_addresses
    FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());

-- 7. SUPPLIER CONTACTS
CREATE TABLE IF NOT EXISTS public.supplier_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    position TEXT,
    telephone TEXT,
    mobile_phone TEXT,
    email TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_contacts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.supplier_contacts TO authenticated;
GRANT ALL ON public.supplier_contacts TO service_role;

CREATE POLICY "supplier_contacts_select" ON public.supplier_contacts
    FOR SELECT TO authenticated USING (
        company_id = public.get_user_company_id() AND public.has_permission('suppliers.view_contacts')
    );

-- 8. SUPPLIER BANK ACCOUNTS (Restricted to suppliers.view_bank_details)
CREATE TABLE IF NOT EXISTS public.supplier_bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL,
    account_name TEXT,
    account_number TEXT,
    iban TEXT,
    swift_code TEXT,
    currency_code TEXT NOT NULL DEFAULT 'MZN',
    is_primary BOOLEAN NOT NULL DEFAULT false,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_bank_accounts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.supplier_bank_accounts TO authenticated;
GRANT ALL ON public.supplier_bank_accounts TO service_role;

CREATE POLICY "supplier_bank_accounts_select" ON public.supplier_bank_accounts
    FOR SELECT TO authenticated USING (
        company_id = public.get_user_company_id() AND public.has_permission('suppliers.view_bank_details')
    );

CREATE POLICY "supplier_bank_accounts_insert" ON public.supplier_bank_accounts
    FOR INSERT TO authenticated WITH CHECK (
        company_id = public.get_user_company_id() AND public.has_permission('suppliers.manage_bank_details')
    );

CREATE POLICY "supplier_bank_accounts_update" ON public.supplier_bank_accounts
    FOR UPDATE TO authenticated USING (
        company_id = public.get_user_company_id() AND public.has_permission('suppliers.manage_bank_details')
    );

-- ────────────────────────────────────────────────────────────
-- PROTECTED OPENING BALANCE RPCs (private SCHEMA)
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.initialise_customer_opening_balance(
    p_company_id UUID,
    p_customer_id UUID,
    p_opening_balance NUMERIC(18,2)
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
BEGIN
    UPDATE public.customers
    SET opening_balance = p_opening_balance,
        current_balance = p_opening_balance,
        updated_at = now()
    WHERE id = p_customer_id AND company_id = p_company_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.initialise_supplier_opening_balance(
    p_company_id UUID,
    p_supplier_id UUID,
    p_opening_balance NUMERIC(18,2)
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
BEGIN
    UPDATE public.suppliers
    SET opening_balance = p_opening_balance,
        current_balance = p_opening_balance,
        updated_at = now()
    WHERE id = p_supplier_id AND company_id = p_company_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- LEGACY MIGRATION RAW TABLES (migration SCHEMA)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS migration.customers_raw (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_batch_id UUID NOT NULL REFERENCES migration.migration_batches(id) ON DELETE CASCADE,
    source_system TEXT NOT NULL DEFAULT 'XT-POS',
    source_table TEXT,
    source_file TEXT,
    source_record_id TEXT,
    source_row_number INTEGER,
    legacy_number TEXT,
    legacy_name TEXT,
    legacy_address TEXT,
    legacy_postal_code TEXT,
    legacy_telephone TEXT,
    legacy_email TEXT,
    legacy_tax_number TEXT,
    legacy_payment_condition TEXT,
    legacy_credit_limit TEXT,
    legacy_balance TEXT,
    raw_payload JSONB NOT NULL,
    source_hash TEXT NOT NULL,
    validation_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (validation_status IN ('PENDING', 'VALID', 'INVALID', 'ERROR')),
    validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
    transformation_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (transformation_status IN ('PENDING', 'TRANSFORMED', 'IMPORTED', 'SKIPPED', 'ERROR')),
    destination_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    CONSTRAINT uq_customer_raw_batch_hash UNIQUE (migration_batch_id, source_hash)
);

GRANT ALL ON migration.customers_raw TO service_role;

CREATE TABLE IF NOT EXISTS migration.suppliers_raw (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_batch_id UUID NOT NULL REFERENCES migration.migration_batches(id) ON DELETE CASCADE,
    source_system TEXT NOT NULL DEFAULT 'XT-POS',
    source_table TEXT,
    source_file TEXT,
    source_record_id TEXT,
    source_row_number INTEGER,
    legacy_number TEXT,
    legacy_name TEXT,
    legacy_address TEXT,
    legacy_postal_code TEXT,
    legacy_telephone TEXT,
    legacy_email TEXT,
    legacy_tax_number TEXT,
    legacy_payment_condition TEXT,
    legacy_credit_limit TEXT,
    legacy_balance TEXT,
    raw_payload JSONB NOT NULL,
    source_hash TEXT NOT NULL,
    validation_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (validation_status IN ('PENDING', 'VALID', 'INVALID', 'ERROR')),
    validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
    transformation_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (transformation_status IN ('PENDING', 'TRANSFORMED', 'IMPORTED', 'SKIPPED', 'ERROR')),
    destination_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    CONSTRAINT uq_supplier_raw_batch_hash UNIQUE (migration_batch_id, source_hash)
);

GRANT ALL ON migration.suppliers_raw TO service_role;

-- ────────────────────────────────────────────────────────────
-- MIGRATION TRANSFORMATION PROCEDURES
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION migration.process_customer_migration_batch(
    p_batch_id UUID,
    p_company_id UUID DEFAULT 'a0000000-0000-0000-0000-000000000001'
)
RETURNS TABLE (
    total_processed INT,
    total_imported INT,
    total_errors INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, migration, private, pg_temp
AS $$
DECLARE
    r RECORD;
    v_term_id UUID;
    v_customer_id UUID;
    v_opening_bal NUMERIC(18,2);
    v_cred_limit NUMERIC(18,2);
    v_imported_count INT := 0;
    v_error_count INT := 0;
    v_total_count INT := 0;
BEGIN
    FOR r IN 
        SELECT * FROM migration.customers_raw 
        WHERE migration_batch_id = p_batch_id AND transformation_status = 'PENDING'
    LOOP
        v_total_count := v_total_count + 1;
        BEGIN
            -- Parse numbers safely
            v_opening_bal := COALESCE(NULLIF(r.legacy_balance, '')::NUMERIC(18,2), 0.00);
            v_cred_limit := COALESCE(NULLIF(r.legacy_credit_limit, '')::NUMERIC(18,2), 0.00);

            -- Resolve payment term
            SELECT id INTO v_term_id FROM public.payment_terms
            WHERE company_id = p_company_id AND (code = r.legacy_payment_condition OR name = r.legacy_payment_condition) LIMIT 1;

            IF v_term_id IS NULL THEN
                SELECT id INTO v_term_id FROM public.payment_terms
                WHERE company_id = p_company_id AND code = 'DINHEIRO' LIMIT 1;
            END IF;

            -- Upsert Customer
            INSERT INTO public.customers (
                company_id,
                legacy_id,
                customer_number,
                name,
                tax_number,
                telephone,
                email,
                payment_term_id,
                credit_limit,
                opening_balance,
                current_balance,
                migrated_at,
                migration_batch_id
            ) VALUES (
                p_company_id,
                r.source_record_id,
                r.legacy_number,
                r.legacy_name,
                r.legacy_tax_number,
                r.legacy_telephone,
                r.legacy_email,
                v_term_id,
                v_cred_limit,
                v_opening_bal,
                v_opening_bal,
                now(),
                p_batch_id
            )
            ON CONFLICT (company_id, customer_number) DO UPDATE SET
                name = EXCLUDED.name,
                tax_number = EXCLUDED.tax_number,
                telephone = EXCLUDED.telephone,
                email = EXCLUDED.email,
                payment_term_id = EXCLUDED.payment_term_id,
                credit_limit = EXCLUDED.credit_limit,
                opening_balance = EXCLUDED.opening_balance,
                current_balance = EXCLUDED.current_balance,
                updated_at = now()
            RETURNING id INTO v_customer_id;

            -- Primary Address
            IF r.legacy_address IS NOT NULL AND TRIM(r.legacy_address) <> '' THEN
                INSERT INTO public.customer_addresses (
                    company_id,
                    customer_id,
                    address_type,
                    address_line_1,
                    postal_code,
                    is_primary
                ) VALUES (
                    p_company_id,
                    v_customer_id,
                    'GENERAL',
                    r.legacy_address,
                    r.legacy_postal_code,
                    true
                ) ON CONFLICT DO NOTHING;
            END IF;

            -- Mark raw record imported
            UPDATE migration.customers_raw
            SET transformation_status = 'IMPORTED',
                destination_id = v_customer_id,
                processed_at = now()
            WHERE id = r.id;

            v_imported_count := v_imported_count + 1;

        EXCEPTION WHEN OTHERS THEN
            v_error_count := v_error_count + 1;

            UPDATE migration.customers_raw
            SET transformation_status = 'ERROR',
                validation_errors = jsonb_build_object('message', SQLERRM, 'state', SQLSTATE)
            WHERE id = r.id;

            INSERT INTO migration.migration_errors (
                migration_batch_id,
                raw_table,
                raw_record_id,
                error_code,
                error_message,
                payload
            ) VALUES (
                p_batch_id,
                'customers_raw',
                r.id,
                SQLSTATE,
                SQLERRM,
                to_jsonb(r)
            );
        END;
    END LOOP;

    RETURN QUERY SELECT v_total_count, v_imported_count, v_error_count;
END;
$$;

CREATE OR REPLACE FUNCTION migration.process_supplier_migration_batch(
    p_batch_id UUID,
    p_company_id UUID DEFAULT 'a0000000-0000-0000-0000-000000000001'
)
RETURNS TABLE (
    total_processed INT,
    total_imported INT,
    total_errors INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, migration, private, pg_temp
AS $$
DECLARE
    r RECORD;
    v_term_id UUID;
    v_supplier_id UUID;
    v_opening_bal NUMERIC(18,2);
    v_cred_limit NUMERIC(18,2);
    v_imported_count INT := 0;
    v_error_count INT := 0;
    v_total_count INT := 0;
BEGIN
    FOR r IN 
        SELECT * FROM migration.suppliers_raw 
        WHERE migration_batch_id = p_batch_id AND transformation_status = 'PENDING'
    LOOP
        v_total_count := v_total_count + 1;
        BEGIN
            v_opening_bal := COALESCE(NULLIF(r.legacy_balance, '')::NUMERIC(18,2), 0.00);
            v_cred_limit := COALESCE(NULLIF(r.legacy_credit_limit, '')::NUMERIC(18,2), 0.00);

            SELECT id INTO v_term_id FROM public.payment_terms
            WHERE company_id = p_company_id AND (code = r.legacy_payment_condition OR name = r.legacy_payment_condition) LIMIT 1;

            IF v_term_id IS NULL THEN
                SELECT id INTO v_term_id FROM public.payment_terms
                WHERE company_id = p_company_id AND code = 'DINHEIRO' LIMIT 1;
            END IF;

            INSERT INTO public.suppliers (
                company_id,
                legacy_id,
                supplier_number,
                name,
                tax_number,
                telephone,
                email,
                payment_term_id,
                credit_limit,
                opening_balance,
                current_balance,
                migrated_at,
                migration_batch_id
            ) VALUES (
                p_company_id,
                r.source_record_id,
                r.legacy_number,
                r.legacy_name,
                r.legacy_tax_number,
                r.legacy_telephone,
                r.legacy_email,
                v_term_id,
                v_cred_limit,
                v_opening_bal,
                v_opening_bal,
                now(),
                p_batch_id
            )
            ON CONFLICT (company_id, supplier_number) DO UPDATE SET
                name = EXCLUDED.name,
                tax_number = EXCLUDED.tax_number,
                telephone = EXCLUDED.telephone,
                email = EXCLUDED.email,
                payment_term_id = EXCLUDED.payment_term_id,
                credit_limit = EXCLUDED.credit_limit,
                opening_balance = EXCLUDED.opening_balance,
                current_balance = EXCLUDED.current_balance,
                updated_at = now()
            RETURNING id INTO v_supplier_id;

            IF r.legacy_address IS NOT NULL AND TRIM(r.legacy_address) <> '' THEN
                INSERT INTO public.supplier_addresses (
                    company_id,
                    supplier_id,
                    address_type,
                    address_line_1,
                    postal_code,
                    is_primary
                ) VALUES (
                    p_company_id,
                    v_supplier_id,
                    'GENERAL',
                    r.legacy_address,
                    r.legacy_postal_code,
                    true
                ) ON CONFLICT DO NOTHING;
            END IF;

            UPDATE migration.suppliers_raw
            SET transformation_status = 'IMPORTED',
                destination_id = v_supplier_id,
                processed_at = now()
            WHERE id = r.id;

            v_imported_count := v_imported_count + 1;

        EXCEPTION WHEN OTHERS THEN
            v_error_count := v_error_count + 1;

            UPDATE migration.suppliers_raw
            SET transformation_status = 'ERROR',
                validation_errors = jsonb_build_object('message', SQLERRM, 'state', SQLSTATE)
            WHERE id = r.id;

            INSERT INTO migration.migration_errors (
                migration_batch_id,
                raw_table,
                raw_record_id,
                error_code,
                error_message,
                payload
            ) VALUES (
                p_batch_id,
                'suppliers_raw',
                r.id,
                SQLSTATE,
                SQLERRM,
                to_jsonb(r)
            );
        END;
    END LOOP;

    RETURN QUERY SELECT v_total_count, v_imported_count, v_error_count;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- RECONCILIATION PROCEDURES
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION migration.reconcile_customer_batch(p_batch_id UUID)
RETURNS TABLE (
    metric_name VARCHAR(100),
    raw_legacy_val NUMERIC(18,2),
    target_prod_val NUMERIC(18,2),
    variance NUMERIC(18,2),
    reconciliation_status VARCHAR(20)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, migration, pg_temp
AS $$
BEGIN
    RETURN QUERY
    WITH raw_summary AS (
        SELECT 
            COUNT(*)::NUMERIC(18,2) AS total_raw_cust,
            SUM(COALESCE(NULLIF(legacy_balance, '')::NUMERIC(18,2), 0.00)) AS total_raw_bal
        FROM migration.customers_raw
        WHERE migration_batch_id = p_batch_id
    ),
    prod_summary AS (
        SELECT 
            COUNT(*)::NUMERIC(18,2) AS total_prod_cust,
            SUM(opening_balance)::NUMERIC(18,2) AS total_prod_bal
        FROM public.customers
        WHERE migration_batch_id = p_batch_id
    )
    SELECT 
        'Total Customers Count'::VARCHAR,
        rs.total_raw_cust,
        ps.total_prod_cust,
        (ps.total_prod_cust - rs.total_raw_cust),
        CASE WHEN (ps.total_prod_cust - rs.total_raw_cust) = 0 THEN 'PASS' ELSE 'FAIL' END::VARCHAR
    FROM raw_summary rs, prod_summary ps
    UNION ALL
    SELECT 
        'Total Customer Opening Balance (MZN)'::VARCHAR,
        rs.total_raw_bal,
        ps.total_prod_bal,
        (ps.total_prod_bal - rs.total_raw_bal),
        CASE WHEN ABS(ps.total_prod_bal - rs.total_raw_bal) < 0.01 THEN 'PASS' ELSE 'FAIL' END::VARCHAR
    FROM raw_summary rs, prod_summary ps;
END;
$$;

CREATE OR REPLACE FUNCTION migration.reconcile_supplier_batch(p_batch_id UUID)
RETURNS TABLE (
    metric_name VARCHAR(100),
    raw_legacy_val NUMERIC(18,2),
    target_prod_val NUMERIC(18,2),
    variance NUMERIC(18,2),
    reconciliation_status VARCHAR(20)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, migration, pg_temp
AS $$
BEGIN
    RETURN QUERY
    WITH raw_summary AS (
        SELECT 
            COUNT(*)::NUMERIC(18,2) AS total_raw_supp,
            SUM(COALESCE(NULLIF(legacy_balance, '')::NUMERIC(18,2), 0.00)) AS total_raw_bal
        FROM migration.suppliers_raw
        WHERE migration_batch_id = p_batch_id
    ),
    prod_summary AS (
        SELECT 
            COUNT(*)::NUMERIC(18,2) AS total_prod_supp,
            SUM(opening_balance)::NUMERIC(18,2) AS total_prod_bal
        FROM public.suppliers
        WHERE migration_batch_id = p_batch_id
    )
    SELECT 
        'Total Suppliers Count'::VARCHAR,
        rs.total_raw_supp,
        ps.total_prod_supp,
        (ps.total_prod_supp - rs.total_raw_supp),
        CASE WHEN (ps.total_prod_supp - rs.total_raw_supp) = 0 THEN 'PASS' ELSE 'FAIL' END::VARCHAR
    FROM raw_summary rs, prod_summary ps
    UNION ALL
    SELECT 
        'Total Supplier Opening Balance (MZN)'::VARCHAR,
        rs.total_raw_bal,
        ps.total_prod_bal,
        (ps.total_prod_bal - rs.total_raw_bal),
        CASE WHEN ABS(ps.total_prod_bal - rs.total_raw_bal) < 0.01 THEN 'PASS' ELSE 'FAIL' END::VARCHAR
    FROM raw_summary rs, prod_summary ps;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- SEED PERMISSIONS FOR CUSTOMERS & SUPPLIERS
-- ────────────────────────────────────────────────────────────

INSERT INTO public.permissions (code, module, description) VALUES
    ('customers.view', 'Customers', 'View customer details and current accounts'),
    ('customers.create', 'Customers', 'Create new customers'),
    ('customers.update', 'Customers', 'Update customer details'),
    ('customers.deactivate', 'Customers', 'Deactivate customers'),
    ('customers.view_balance', 'Customers', 'View customer outstanding balance'),
    ('customers.change_credit_limit', 'Customers', 'Modify customer credit limits'),
    ('customers.view_contacts', 'Customers', 'View customer contacts and addresses'),
    ('customers.manage_contacts', 'Customers', 'Manage customer contacts and addresses'),

    ('suppliers.view', 'Suppliers', 'View supplier details and current accounts'),
    ('suppliers.create', 'Suppliers', 'Create new suppliers'),
    ('suppliers.update', 'Suppliers', 'Update supplier details'),
    ('suppliers.deactivate', 'Suppliers', 'Deactivate suppliers'),
    ('suppliers.view_balance', 'Suppliers', 'View supplier outstanding balance'),
    ('suppliers.change_credit_limit', 'Suppliers', 'Modify supplier credit limits'),
    ('suppliers.view_contacts', 'Suppliers', 'View supplier contacts and addresses'),
    ('suppliers.manage_contacts', 'Suppliers', 'Manage supplier contacts and addresses'),
    ('suppliers.view_bank_details', 'Suppliers', 'View supplier bank accounts'),
    ('suppliers.manage_bank_details', 'Suppliers', 'Manage supplier bank accounts'),

    ('migration.contacts.import', 'Admin', 'Import raw legacy customer and supplier data'),
    ('migration.contacts.process', 'Admin', 'Process legacy customer and supplier batches'),
    ('migration.contacts.reconcile', 'Admin', 'Reconcile contact migration metrics')
ON CONFLICT (code) DO NOTHING;

-- Map permissions to ADMIN (all permissions)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000001', id FROM public.permissions
WHERE code LIKE 'customers.%' OR code LIKE 'suppliers.%' OR code LIKE 'migration.contacts.%'
ON CONFLICT DO NOTHING;

-- Map permissions to MANAGER (all except manage_bank_details override)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000002', id FROM public.permissions
WHERE code LIKE 'customers.%' OR code LIKE 'suppliers.%'
ON CONFLICT DO NOTHING;

-- Map permissions to PURCHASING_OP
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000006', id FROM public.permissions
WHERE code IN ('suppliers.view', 'suppliers.create', 'suppliers.update', 'suppliers.view_contacts', 'suppliers.manage_contacts')
ON CONFLICT DO NOTHING;

-- Map permissions to ACCOUNTING_OP
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000007', id FROM public.permissions
WHERE code IN ('customers.view', 'customers.view_balance', 'suppliers.view', 'suppliers.view_balance', 'suppliers.view_bank_details', 'suppliers.manage_bank_details')
ON CONFLICT DO NOTHING;

COMMIT;
