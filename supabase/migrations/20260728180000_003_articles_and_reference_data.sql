-- Migration: 20260728180000_003_articles_and_reference_data.sql
-- Description: Product catalogue, reference master data (families, categories, brands, UOM, tax codes), pricing structure, and price history tracking.
-- Target Database: bkbcgndzsfylwsinxwbb (Production Pre-Live Mode)

BEGIN;

-- 1. PRODUCT FAMILIES
CREATE TABLE IF NOT EXISTS public.product_families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_family_company_code UNIQUE (company_id, code)
);

ALTER TABLE public.product_families ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.product_families TO authenticated;
GRANT ALL ON public.product_families TO service_role;

CREATE POLICY "product_families_select" ON public.product_families
    FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());

-- 2. PRODUCT CATEGORIES
CREATE TABLE IF NOT EXISTS public.product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    family_id UUID NOT NULL REFERENCES public.product_families(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_category_company_code UNIQUE (company_id, code)
);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.product_categories TO authenticated;
GRANT ALL ON public.product_categories TO service_role;

CREATE POLICY "product_categories_select" ON public.product_categories
    FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());

-- 3. BRANDS
CREATE TABLE IF NOT EXISTS public.brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_brand_company_name UNIQUE (company_id, name)
);

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.brands TO authenticated;
GRANT ALL ON public.brands TO service_role;

CREATE POLICY "brands_select" ON public.brands
    FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());

-- 4. UNITS OF MEASURE
CREATE TABLE IF NOT EXISTS public.units_of_measure (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    name VARCHAR(50) NOT NULL,
    abbreviation VARCHAR(10) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_uom_company_abbr UNIQUE (company_id, abbreviation)
);

ALTER TABLE public.units_of_measure ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.units_of_measure TO authenticated;
GRANT ALL ON public.units_of_measure TO service_role;

CREATE POLICY "units_of_measure_select" ON public.units_of_measure
    FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());

-- 5. TAX CODES (Mozambique Tax Compliance: IVA 16% Standard Rate)
CREATE TABLE IF NOT EXISTS public.tax_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    code VARCHAR(20) NOT NULL,
    description VARCHAR(100) NOT NULL,
    rate NUMERIC(5,2) NOT NULL DEFAULT 16.00 CHECK (rate >= 0 AND rate <= 100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tax_code_company_code UNIQUE (company_id, code)
);

ALTER TABLE public.tax_codes ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.tax_codes TO authenticated;
GRANT ALL ON public.tax_codes TO service_role;

CREATE POLICY "tax_codes_select" ON public.tax_codes
    FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());

-- 6. PRODUCTS / ARTICLES CATALOGUE
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL,
    barcode VARCHAR(100),
    description TEXT NOT NULL,
    family_id UUID REFERENCES public.product_families(id) ON DELETE SET NULL,
    category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
    brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
    unit_id UUID NOT NULL REFERENCES public.units_of_measure(id) ON DELETE RESTRICT,
    tax_code_id UUID NOT NULL REFERENCES public.tax_codes(id) ON DELETE RESTRICT,
    min_stock NUMERIC(15,3) NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
    avg_cost NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (avg_cost >= 0), -- Cost Price (Masked)
    profit_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
    sale_price_excl NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (sale_price_excl >= 0), -- Excl VAT
    sale_price_incl NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (sale_price_incl >= 0), -- Incl VAT
    last_purchase_cost NUMERIC(15,2) DEFAULT 0 CHECK (last_purchase_cost >= 0),
    last_sale_price NUMERIC(15,2) DEFAULT 0 CHECK (last_sale_price >= 0),
    warehouse_location VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    legacy_id VARCHAR(100), -- Historical reference from XT-POS
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    CONSTRAINT uq_product_company_code UNIQUE (company_id, code)
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

CREATE POLICY "products_select" ON public.products
    FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());

CREATE POLICY "products_insert" ON public.products
    FOR INSERT TO authenticated WITH CHECK (
        company_id = public.get_user_company_id() AND public.has_permission('products.create')
    );

CREATE POLICY "products_update" ON public.products
    FOR UPDATE TO authenticated USING (
        company_id = public.get_user_company_id() AND public.has_permission('products.update')
    );

-- 7. PRICE HISTORY AUDIT TRAIL
CREATE TABLE IF NOT EXISTS public.price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    field_changed VARCHAR(50) NOT NULL, -- sale_price_excl, sale_price_incl, avg_cost
    old_value NUMERIC(15,2) NOT NULL,
    new_value NUMERIC(15,2) NOT NULL,
    changed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason TEXT
);

ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.price_history TO authenticated;
GRANT ALL ON public.price_history TO service_role;

CREATE POLICY "price_history_select" ON public.price_history
    FOR SELECT TO authenticated USING (
        product_id IN (SELECT id FROM public.products WHERE company_id = public.get_user_company_id())
        AND public.has_permission('products.view_cost')
    );

-- ────────────────────────────────────────────────────────────
-- SEED REFERENCE DATA FOR CASA DE PNEUS, LDA.
-- ────────────────────────────────────────────────────────────

-- 1. Units of Measure Seed
INSERT INTO public.units_of_measure (id, company_id, name, abbreviation) VALUES
    ('11000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Unidade', 'UN'),
    ('11000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Par', 'PR'),
    ('11000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Jogo', 'JG'),
    ('11000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Kilograma', 'KG'),
    ('11000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Litro', 'LT')
ON CONFLICT DO NOTHING;

-- 2. Tax Codes Seed (Mozambique IVA 16%)
INSERT INTO public.tax_codes (id, company_id, code, description, rate) VALUES
    ('17000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000001', 'IVA16', 'Imposto sobre o Valor Acrescentado 16%', 16.00),
    ('17000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'ISENTO', 'Isento de IVA', 0.00)
ON CONFLICT DO NOTHING;

-- 3. Product Families Seed
INSERT INTO public.product_families (id, company_id, code, name, description) VALUES
    ('1f000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'PNEU', 'Pneus', 'Pneus de ligeiros, 4x4, pesados e industriais'),
    ('1f000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'JANT', 'Jantes', 'Jantes especiais e de liga leve'),
    ('1f000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'CAMAR', 'Câmaras de Ar', 'Câmaras de ar para diversos tipos de pneu'),
    ('1f000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'SERV', 'Serviços', 'Montagem, calibração, alinhamento e reparação'),
    ('1f000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'ACES', 'Acessórios', 'Válvulas, pesos de calibração, cavilhas e materiais de recauchutagem')
ON CONFLICT DO NOTHING;

-- 4. Brands Seed
INSERT INTO public.brands (company_id, name) VALUES
    ('a0000000-0000-0000-0000-000000000001', 'Bridgestone'),
    ('a0000000-0000-0000-0000-000000000001', 'Michelin'),
    ('a0000000-0000-0000-0000-000000000001', 'Goodyear'),
    ('a0000000-0000-0000-0000-000000000001', 'Continental'),
    ('a0000000-0000-0000-0000-000000000001', 'Pirelli'),
    ('a0000000-0000-0000-0000-000000000001', 'Dunlop'),
    ('a0000000-0000-0000-0000-000000000001', 'Hankook'),
    ('a0000000-0000-0000-0000-000000000001', 'Maxxis'),
    ('a0000000-0000-0000-0000-000000000001', 'Serviço Interno')
ON CONFLICT DO NOTHING;

COMMIT;
