-- Migration: 20260728200000_005_legacy_article_and_stock_migration_staging.sql
-- Description: Isolated migration schema staging tables, raw legacy load pipelines, transformation RPCs, and stock reconciliation views for XT-POS import.
-- Target Database: bkbcgndzsfylwsinxwbb (Production Pre-Live Mode)

BEGIN;

-- 1. MIGRATION BATCHES
CREATE TABLE IF NOT EXISTS migration.migration_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_name VARCHAR(100) NOT NULL,
    source_system VARCHAR(50) NOT NULL DEFAULT 'XT-POS',
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'extracting', 'validating', 'transforming', 'reconciling', 'completed', 'failed', 'rolled_back'
    )),
    total_records INTEGER NOT NULL DEFAULT 0,
    valid_records INTEGER NOT NULL DEFAULT 0,
    error_records INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    legacy_freeze_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL
);

GRANT ALL ON migration.migration_batches TO service_role;

-- 2. PRODUCTS RAW STAGING
CREATE TABLE IF NOT EXISTS migration.products_raw (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_batch_id UUID NOT NULL REFERENCES migration.migration_batches(id) ON DELETE CASCADE,
    source_file VARCHAR(255),
    source_record_id VARCHAR(100),
    raw_payload JSONB,
    source_hash VARCHAR(64),
    legacy_code VARCHAR(50),
    legacy_description TEXT,
    legacy_family VARCHAR(50),
    legacy_brand VARCHAR(50),
    legacy_unit VARCHAR(20),
    legacy_price NUMERIC(15,2),
    legacy_stock NUMERIC(15,3),
    legacy_cost NUMERIC(15,2),
    validation_status VARCHAR(30) NOT NULL DEFAULT 'raw' CHECK (validation_status IN (
        'raw', 'valid', 'invalid', 'transformed', 'imported', 'error'
    )),
    validation_errors JSONB,
    destination_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON migration.products_raw TO service_role;

-- 3. STOCK MOVEMENTS RAW STAGING
CREATE TABLE IF NOT EXISTS migration.stock_movements_raw (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_batch_id UUID NOT NULL REFERENCES migration.migration_batches(id) ON DELETE CASCADE,
    source_file VARCHAR(255),
    source_record_id VARCHAR(100),
    raw_payload JSONB,
    source_hash VARCHAR(64),
    legacy_product_code VARCHAR(50),
    legacy_warehouse_code VARCHAR(50),
    legacy_movement_type VARCHAR(50),
    legacy_qty NUMERIC(15,3),
    legacy_unit_cost NUMERIC(15,2),
    legacy_date DATE,
    validation_status VARCHAR(30) NOT NULL DEFAULT 'raw' CHECK (validation_status IN (
        'raw', 'valid', 'invalid', 'transformed', 'imported', 'error'
    )),
    validation_errors JSONB,
    destination_movement_id UUID REFERENCES public.stock_movements(id) ON DELETE SET NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON migration.stock_movements_raw TO service_role;

-- 4. MIGRATION ERRORS LOG
CREATE TABLE IF NOT EXISTS migration.migration_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_batch_id UUID NOT NULL REFERENCES migration.migration_batches(id) ON DELETE CASCADE,
    raw_table VARCHAR(50) NOT NULL,
    raw_record_id UUID NOT NULL,
    error_code VARCHAR(50) NOT NULL,
    error_message TEXT NOT NULL,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON migration.migration_errors TO service_role;

-- ────────────────────────────────────────────────────────────
-- MIGRATION TRANSFORMATION RPC PROCEDURES (SERVICE ROLE ONLY)
-- ────────────────────────────────────────────────────────────

-- Procedure 1: Transform & Import Raw Articles into public.products
CREATE OR REPLACE FUNCTION migration.process_article_migration_batch(
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
SET search_path = public, migration, pg_temp
AS $$
DECLARE
    r RECORD;
    v_unit_id UUID;
    v_tax_id UUID;
    v_family_id UUID;
    v_brand_id UUID;
    v_product_id UUID;
    v_imported_count INT := 0;
    v_error_count INT := 0;
    v_total_count INT := 0;
BEGIN
    -- Fetch default UOM & Tax Code (Mozambique IVA 16%)
    SELECT id INTO v_unit_id FROM public.units_of_measure WHERE company_id = p_company_id AND abbreviation = 'UN' LIMIT 1;
    SELECT id INTO v_tax_id FROM public.tax_codes WHERE company_id = p_company_id AND code = 'IVA16' LIMIT 1;

    -- Update batch status
    UPDATE migration.migration_batches SET status = 'transforming' WHERE id = p_batch_id;

    FOR r IN 
        SELECT * FROM migration.products_raw 
        WHERE migration_batch_id = p_batch_id AND validation_status IN ('raw', 'valid')
    LOOP
        v_total_count := v_total_count + 1;
        BEGIN
            -- Resolve Family if exists or fallback
            SELECT id INTO v_family_id FROM public.product_families 
            WHERE company_id = p_company_id AND (code = UPPER(r.legacy_family) OR name = r.legacy_family) LIMIT 1;
            
            IF v_family_id IS NULL THEN
                SELECT id INTO v_family_id FROM public.product_families 
                WHERE company_id = p_company_id AND code = 'PNEU' LIMIT 1;
            END IF;

            -- Resolve Brand if exists
            SELECT id INTO v_brand_id FROM public.brands 
            WHERE company_id = p_company_id AND LOWER(name) = LOWER(r.legacy_brand) LIMIT 1;

            -- Insert or update product
            INSERT INTO public.products (
                company_id,
                code,
                description,
                family_id,
                brand_id,
                unit_id,
                tax_code_id,
                avg_cost,
                sale_price_excl,
                sale_price_incl,
                legacy_id
            ) VALUES (
                p_company_id,
                r.legacy_code,
                r.legacy_description,
                v_family_id,
                v_brand_id,
                v_unit_id,
                v_tax_id,
                COALESCE(r.legacy_cost, 0),
                COALESCE(r.legacy_price, 0),
                ROUND(COALESCE(r.legacy_price, 0) * 1.16, 2),
                r.source_record_id
            )
            ON CONFLICT (company_id, code) DO UPDATE SET
                description = EXCLUDED.description,
                avg_cost = EXCLUDED.avg_cost,
                sale_price_excl = EXCLUDED.sale_price_excl,
                sale_price_incl = EXCLUDED.sale_price_incl,
                legacy_id = EXCLUDED.legacy_id,
                updated_at = now()
            RETURNING id INTO v_product_id;

            -- Mark raw record imported
            UPDATE migration.products_raw
            SET validation_status = 'imported',
                destination_product_id = v_product_id
            WHERE id = r.id;

            v_imported_count := v_imported_count + 1;

        EXCEPTION WHEN OTHERS THEN
            v_error_count := v_error_count + 1;
            
            UPDATE migration.products_raw
            SET validation_status = 'error',
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
                'products_raw',
                r.id,
                SQLSTATE,
                SQLERRM,
                to_jsonb(r)
            );
        END;
    END LOOP;

    -- Update batch status
    UPDATE migration.migration_batches 
    SET status = CASE WHEN v_error_count = 0 THEN 'reconciling' ELSE 'failed' END,
        total_records = v_total_count,
        valid_records = v_imported_count,
        error_records = v_error_count
    WHERE id = p_batch_id;

    RETURN QUERY SELECT v_total_count, v_imported_count, v_error_count;
END;
$$;

-- Procedure 2: Transform & Post Opening Stock into public.stock_movements & balances
CREATE OR REPLACE FUNCTION migration.process_opening_stock_migration_batch(
    p_batch_id UUID,
    p_company_id UUID DEFAULT 'a0000000-0000-0000-0000-000000000001',
    p_warehouse_id UUID DEFAULT 'c0000000-0000-0000-0000-000000000001'
)
RETURNS TABLE (
    total_processed INT,
    total_imported INT,
    total_errors INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, migration, pg_temp
AS $$
DECLARE
    r RECORD;
    v_product_id UUID;
    v_movement_id UUID;
    v_imported_count INT := 0;
    v_error_count INT := 0;
    v_total_count INT := 0;
BEGIN
    FOR r IN 
        SELECT * FROM migration.stock_movements_raw 
        WHERE migration_batch_id = p_batch_id AND validation_status IN ('raw', 'valid')
    LOOP
        v_total_count := v_total_count + 1;
        BEGIN
            -- Find target product
            SELECT id INTO v_product_id FROM public.products 
            WHERE company_id = p_company_id AND code = r.legacy_product_code LIMIT 1;

            IF v_product_id IS NULL THEN
                RAISE EXCEPTION 'PRODUCT_NOT_FOUND: Legacy code % does not exist in public.products', r.legacy_product_code;
            END IF;

            -- Post opening stock movement
            v_movement_id := public.post_stock_movement(
                p_company_id := p_company_id,
                p_product_id := v_product_id,
                p_warehouse_id := p_warehouse_id,
                p_movement_type := 'opening_stock',
                p_quantity_in := r.legacy_qty,
                p_quantity_out := 0,
                p_unit_cost := r.legacy_unit_cost,
                p_legacy_ref := r.source_record_id,
                p_migration_batch_id := p_batch_id
            );

            -- Mark raw movement imported
            UPDATE migration.stock_movements_raw
            SET validation_status = 'imported',
                destination_movement_id = v_movement_id
            WHERE id = r.id;

            v_imported_count := v_imported_count + 1;

        EXCEPTION WHEN OTHERS THEN
            v_error_count := v_error_count + 1;

            UPDATE migration.stock_movements_raw
            SET validation_status = 'error',
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
                'stock_movements_raw',
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

-- Procedure 3: Reconcile Legacy vs Production Article & Stock Totals
CREATE OR REPLACE FUNCTION migration.reconcile_article_stock_batch(p_batch_id UUID)
RETURNS TABLE (
    metric_name VARCHAR(100),
    raw_legacy_val NUMERIC(15,3),
    target_prod_val NUMERIC(15,3),
    variance NUMERIC(15,3),
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
            COUNT(*)::NUMERIC(15,3) AS total_raw_articles,
            SUM(legacy_stock)::NUMERIC(15,3) AS total_raw_stock_qty,
            SUM(legacy_stock * legacy_cost)::NUMERIC(15,3) AS total_raw_stock_value
        FROM migration.products_raw
        WHERE migration_batch_id = p_batch_id
    ),
    prod_summary AS (
        SELECT 
            COUNT(DISTINCT p.id)::NUMERIC(15,3) AS total_prod_articles,
            SUM(ib.quantity)::NUMERIC(15,3) AS total_prod_stock_qty,
            SUM(ib.quantity * ib.avg_cost)::NUMERIC(15,3) AS total_prod_stock_value
        FROM public.products p
        LEFT JOIN public.inventory_balances ib ON ib.product_id = p.id
        WHERE p.legacy_id IS NOT NULL
    )
    SELECT 
        'Total Articles Count'::VARCHAR,
        rs.total_raw_articles,
        ps.total_prod_articles,
        (ps.total_prod_articles - rs.total_raw_articles),
        CASE WHEN (ps.total_prod_articles - rs.total_raw_articles) = 0 THEN 'PASS' ELSE 'FAIL' END::VARCHAR
    FROM raw_summary rs, prod_summary ps
    UNION ALL
    SELECT 
        'Total Stock Quantity'::VARCHAR,
        rs.total_raw_stock_qty,
        ps.total_prod_stock_qty,
        (ps.total_prod_stock_qty - rs.total_raw_stock_qty),
        CASE WHEN ABS(ps.total_prod_stock_qty - rs.total_raw_stock_qty) < 0.001 THEN 'PASS' ELSE 'FAIL' END::VARCHAR
    FROM raw_summary rs, prod_summary ps
    UNION ALL
    SELECT 
        'Total Stock Valuation (MZN)'::VARCHAR,
        rs.total_raw_stock_value,
        ps.total_prod_stock_value,
        (ps.total_prod_stock_value - rs.total_raw_stock_value),
        CASE WHEN ABS(ps.total_prod_stock_value - rs.total_raw_stock_value) < 0.01 THEN 'PASS' ELSE 'FAIL' END::VARCHAR
    FROM raw_summary rs, prod_summary ps;
END;
$$;

COMMIT;
