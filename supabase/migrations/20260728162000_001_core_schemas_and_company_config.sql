-- Migration: 20260728162000_001_core_schemas_and_company_config.sql
-- Description: Foundation schemas, core company entities, fiscal periods, document sequences, and system activation mode.
-- Target Database: bkbcgndzsfylwsinxwbb (Production Pre-Live Mode)

BEGIN;

-- 1. SCHEMAS
CREATE SCHEMA IF NOT EXISTS private;
CREATE SCHEMA IF NOT EXISTS migration;
CREATE SCHEMA IF NOT EXISTS audit;

-- Grant usage on public schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT USAGE ON SCHEMA migration TO service_role;
GRANT USAGE ON SCHEMA audit TO service_role;

-- 2. SYSTEM SETTINGS & ACTIVATION MODE
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.system_settings IS 'Global system settings including system activation mode (MIGRATION, PILOT, LIVE, MAINTENANCE)';

-- Enable RLS & Grants
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;

CREATE POLICY "system_settings_select_policy" ON public.system_settings
    FOR SELECT TO authenticated USING (true);

-- Initial System Mode Seed
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES ('SYSTEM_MODE', 'MIGRATION', 'Current operational mode: MIGRATION, PILOT, LIVE, MAINTENANCE')
ON CONFLICT DO NOTHING;

-- 3. COMPANIES
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    tax_number VARCHAR(50) NOT NULL UNIQUE, -- NUIT in Mozambique
    address TEXT,
    city VARCHAR(100) DEFAULT 'Maputo',
    country VARCHAR(100) DEFAULT 'Moçambique',
    phone VARCHAR(50),
    email VARCHAR(255),
    logo_url TEXT,
    currency VARCHAR(10) NOT NULL DEFAULT 'MZN',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;

CREATE POLICY "companies_select_policy" ON public.companies
    FOR SELECT TO authenticated USING (true);

-- Seed Casa de Pneus, Lda.
INSERT INTO public.companies (id, name, tax_number, address, city, country, phone, email, currency)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Casa de Pneus, Lda.',
    '400123456',
    'Av. de Moçambique, Maputo',
    'Maputo',
    'Moçambique',
    '+258 21 000000',
    'geral@casadepeneus.co.mz',
    'MZN'
)
ON CONFLICT DO NOTHING;

-- 4. BRANCHES
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_branch_company_code UNIQUE (company_id, code)
);

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;

CREATE POLICY "branches_select_policy" ON public.branches
    FOR SELECT TO authenticated USING (company_id = 'a0000000-0000-0000-0000-000000000001');

-- Seed Main Branch
INSERT INTO public.branches (id, company_id, name, code, address)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Sede Maputo',
    'SED',
    'Av. de Moçambique, Maputo'
)
ON CONFLICT DO NOTHING;

-- 5. WAREHOUSES
CREATE TABLE IF NOT EXISTS public.warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_warehouse_company_code UNIQUE (company_id, code)
);

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.warehouses TO authenticated;
GRANT ALL ON public.warehouses TO service_role;

CREATE POLICY "warehouses_select_policy" ON public.warehouses
    FOR SELECT TO authenticated USING (company_id = 'a0000000-0000-0000-0000-000000000001');

-- Seed Main Warehouse
INSERT INTO public.warehouses (id, company_id, branch_id, name, code, is_default)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'Armazém Principal',
    'ARM01',
    true
)
ON CONFLICT DO NOTHING;

-- 6. COMPANY SETTINGS
CREATE TABLE IF NOT EXISTS public.company_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT NOT NULL,
    data_type VARCHAR(50) NOT NULL DEFAULT 'string',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_company_setting_key UNIQUE (company_id, setting_key)
);

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;

CREATE POLICY "company_settings_select_policy" ON public.company_settings
    FOR SELECT TO authenticated USING (company_id = 'a0000000-0000-0000-0000-000000000001');

-- 7. FISCAL PERIODS
CREATE TABLE IF NOT EXISTS public.fiscal_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    year INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    closed_at TIMESTAMPTZ,
    closed_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_fiscal_period_year UNIQUE (company_id, year)
);

ALTER TABLE public.fiscal_periods ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.fiscal_periods TO authenticated;
GRANT ALL ON public.fiscal_periods TO service_role;

CREATE POLICY "fiscal_periods_select_policy" ON public.fiscal_periods
    FOR SELECT TO authenticated USING (company_id = 'a0000000-0000-0000-0000-000000000001');

-- Seed 2026 Fiscal Period
INSERT INTO public.fiscal_periods (id, company_id, year, start_date, end_date, status)
VALUES (
    'f2026000-0000-0000-0000-000000002026',
    'a0000000-0000-0000-0000-000000000001',
    2026,
    '2026-01-01',
    '2026-12-31',
    'open'
)
ON CONFLICT DO NOTHING;

-- 8. DOCUMENT SEQUENCES
CREATE TABLE IF NOT EXISTS public.document_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL, -- FT (Factura), VD (Venda Dinheiro), GR (Guia Remessa), NC (Nota Credito), ND (Nota Debito), etc.
    series VARCHAR(20) NOT NULL DEFAULT 'A',
    current_number INTEGER NOT NULL DEFAULT 0,
    fiscal_period_id UUID NOT NULL REFERENCES public.fiscal_periods(id) ON DELETE RESTRICT,
    prefix VARCHAR(20) DEFAULT '',
    suffix VARCHAR(20) DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_doc_sequence UNIQUE (company_id, document_type, series, fiscal_period_id)
);

ALTER TABLE public.document_sequences ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.document_sequences TO authenticated;
GRANT ALL ON public.document_sequences TO service_role;

CREATE POLICY "document_sequences_select_policy" ON public.document_sequences
    FOR SELECT TO authenticated USING (company_id = 'a0000000-0000-0000-0000-000000000001');

-- Seed Document Sequences for 2026 Series A
INSERT INTO public.document_sequences (company_id, document_type, series, current_number, fiscal_period_id, prefix)
VALUES 
    ('a0000000-0000-0000-0000-000000000001', 'FT', 'A', 0, 'f2026000-0000-0000-0000-000000002026', 'FT A/'),
    ('a0000000-0000-0000-0000-000000000001', 'VD', 'A', 0, 'f2026000-0000-0000-0000-000000002026', 'VD A/'),
    ('a0000000-0000-0000-0000-000000000001', 'GR', 'A', 0, 'f2026000-0000-0000-0000-000000002026', 'GR A/'),
    ('a0000000-0000-0000-0000-000000000001', 'NC', 'A', 0, 'f2026000-0000-0000-0000-000000002026', 'NC A/'),
    ('a0000000-0000-0000-0000-000000000001', 'ND', 'A', 0, 'f2026000-0000-0000-0000-000000002026', 'ND A/'),
    ('a0000000-0000-0000-0000-000000000001', 'REC', 'A', 0, 'f2026000-0000-0000-0000-000000002026', 'REC A/')
ON CONFLICT DO NOTHING;

COMMIT;
