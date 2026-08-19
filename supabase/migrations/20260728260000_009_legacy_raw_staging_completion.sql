-- Migration: 20260728260000_009_legacy_raw_staging_completion.sql
-- Description: Complete raw staging infrastructure for legacy XT-POS DBF data imports.
-- Target Database: bkbcgndzsfylwsinxwbb (Production Pre-Live Mode)

BEGIN;

-- Add missing unique constraint on products_raw if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_products_raw_batch_hash'
    ) THEN
        ALTER TABLE migration.products_raw ADD CONSTRAINT uq_products_raw_batch_hash UNIQUE (migration_batch_id, source_hash);
    END IF;
END $$;

-- 1. MIGRATION SOURCES REGISTER
CREATE TABLE IF NOT EXISTS migration.migration_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_batch_id UUID NOT NULL REFERENCES migration.migration_batches(id) ON DELETE CASCADE,
    source_filename TEXT NOT NULL,
    source_table TEXT NOT NULL,
    source_checksum TEXT NOT NULL,
    source_size_bytes BIGINT NOT NULL,
    record_count INTEGER NOT NULL,
    extracted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    uploaded_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    validation_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (validation_status IN ('PENDING', 'VALIDATED', 'ERROR')),
    CONSTRAINT uq_migration_source_batch_file UNIQUE (migration_batch_id, source_filename)
);

GRANT ALL ON migration.migration_sources TO service_role;

-- 2. RAW STAGING TABLES FOR DOMAINS
CREATE TABLE IF NOT EXISTS migration.reference_data_raw (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_batch_id UUID NOT NULL REFERENCES migration.migration_batches(id) ON DELETE CASCADE,
    domain_type TEXT NOT NULL,
    source_code TEXT,
    source_name TEXT,
    raw_payload JSONB NOT NULL,
    source_hash TEXT NOT NULL,
    validation_status TEXT NOT NULL DEFAULT 'PENDING',
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_ref_raw_batch_hash UNIQUE (migration_batch_id, source_hash)
);

GRANT ALL ON migration.reference_data_raw TO service_role;

CREATE TABLE IF NOT EXISTS migration.product_prices_raw (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_batch_id UUID NOT NULL REFERENCES migration.migration_batches(id) ON DELETE CASCADE,
    source_product_code TEXT NOT NULL,
    source_price NUMERIC(18,2) NOT NULL,
    raw_payload JSONB NOT NULL,
    source_hash TEXT NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_price_raw_batch_hash UNIQUE (migration_batch_id, source_hash)
);

GRANT ALL ON migration.product_prices_raw TO service_role;

CREATE TABLE IF NOT EXISTS migration.customer_contacts_raw (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_batch_id UUID NOT NULL REFERENCES migration.migration_batches(id) ON DELETE CASCADE,
    source_customer_number TEXT NOT NULL,
    raw_payload JSONB NOT NULL,
    source_hash TEXT NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_cust_contact_raw_hash UNIQUE (migration_batch_id, source_hash)
);

GRANT ALL ON migration.customer_contacts_raw TO service_role;

CREATE TABLE IF NOT EXISTS migration.supplier_contacts_raw (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_batch_id UUID NOT NULL REFERENCES migration.migration_batches(id) ON DELETE CASCADE,
    source_supplier_number TEXT NOT NULL,
    raw_payload JSONB NOT NULL,
    source_hash TEXT NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_supp_contact_raw_hash UNIQUE (migration_batch_id, source_hash)
);

GRANT ALL ON migration.supplier_contacts_raw TO service_role;

CREATE TABLE IF NOT EXISTS migration.document_links_raw (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_batch_id UUID NOT NULL REFERENCES migration.migration_batches(id) ON DELETE CASCADE,
    source_doc_number TEXT NOT NULL,
    target_doc_number TEXT NOT NULL,
    link_type TEXT NOT NULL,
    raw_payload JSONB NOT NULL,
    source_hash TEXT NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_doc_link_raw_hash UNIQUE (migration_batch_id, source_hash)
);

GRANT ALL ON migration.document_links_raw TO service_role;

CREATE TABLE IF NOT EXISTS migration.users_raw (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_batch_id UUID NOT NULL REFERENCES migration.migration_batches(id) ON DELETE CASCADE,
    source_user_code TEXT NOT NULL,
    raw_payload JSONB NOT NULL,
    source_hash TEXT NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_users_raw_hash UNIQUE (migration_batch_id, source_hash)
);

GRANT ALL ON migration.users_raw TO service_role;

CREATE TABLE IF NOT EXISTS migration.settings_raw (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_batch_id UUID NOT NULL REFERENCES migration.migration_batches(id) ON DELETE CASCADE,
    setting_key TEXT NOT NULL,
    raw_payload JSONB NOT NULL,
    source_hash TEXT NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_settings_raw_hash UNIQUE (migration_batch_id, source_hash)
);

GRANT ALL ON migration.settings_raw TO service_role;

-- 3. IMPORT & RECONCILIATION AUDIT LOG TABLES
CREATE TABLE IF NOT EXISTS migration.raw_import_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_batch_id UUID NOT NULL REFERENCES migration.migration_batches(id) ON DELETE CASCADE,
    table_name TEXT NOT NULL,
    total_source_rows INTEGER NOT NULL,
    imported_rows INTEGER NOT NULL,
    duplicate_rows INTEGER NOT NULL DEFAULT 0,
    error_rows INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'COMPLETED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON migration.raw_import_results TO service_role;

CREATE TABLE IF NOT EXISTS migration.reconciliation_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_batch_id UUID NOT NULL REFERENCES migration.migration_batches(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    raw_count BIGINT NOT NULL,
    imported_count BIGINT NOT NULL,
    variance BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PASS',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON migration.reconciliation_results TO service_role;

COMMIT;
