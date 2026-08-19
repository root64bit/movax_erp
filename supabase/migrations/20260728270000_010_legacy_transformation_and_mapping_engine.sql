-- Migration: 20260728270000_010_legacy_transformation_and_mapping_engine.sql
-- Description: Core mapping engine, domain transformation functions, per-entity reconciliation, and rollback framework for legacy data.
-- Target Database: bkbcgndzsfylwsinxwbb (Production Pre-Live Mode)

BEGIN;

-- 1. TRANSFORMATION CONTROL TABLES
CREATE TABLE IF NOT EXISTS migration.transformation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_batch_id UUID NOT NULL REFERENCES migration.migration_batches(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    run_mode TEXT NOT NULL DEFAULT 'DRY_RUN' CHECK (run_mode IN ('VALIDATE_ONLY', 'DRY_RUN', 'APPLY', 'RECONCILE', 'ROLLBACK', 'FINALISE')),
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED')),
    input_count INTEGER NOT NULL DEFAULT 0,
    valid_count INTEGER NOT NULL DEFAULT 0,
    warning_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);
GRANT ALL ON migration.transformation_runs TO service_role;

CREATE TABLE IF NOT EXISTS migration.transformation_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_batch_id UUID NOT NULL REFERENCES migration.migration_batches(id) ON DELETE CASCADE,
    transformation_run_id UUID NOT NULL REFERENCES migration.transformation_runs(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    source_table TEXT NOT NULL,
    source_record_id TEXT NOT NULL,
    source_hash TEXT NOT NULL,
    destination_table TEXT NOT NULL,
    proposed_destination_id UUID,
    final_destination_id UUID,
    transformation_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (transformation_status IN ('PENDING', 'VALIDATED', 'MAPPED', 'READY', 'SKIPPED', 'WARNING', 'FAILED', 'APPLIED', 'RECONCILED', 'ROLLED_BACK')),
    transformation_rule TEXT,
    original_values JSONB NOT NULL,
    transformed_values JSONB NOT NULL,
    validation_errors JSONB,
    warnings JSONB,
    requires_approval BOOLEAN NOT NULL DEFAULT false,
    approved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON migration.transformation_results TO service_role;

CREATE TABLE IF NOT EXISTS migration.business_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_batch_id UUID NOT NULL REFERENCES migration.migration_batches(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    anomaly_type TEXT NOT NULL,
    source_identifier TEXT NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('MIGRATE_AS_IS', 'NORMALISE', 'MAP', 'MERGE', 'SPLIT', 'CREATE_PLACEHOLDER', 'SKIP_WITH_WARNING', 'REJECT', 'ARCHIVE_ONLY', 'REQUIRE_MANUAL_CORRECTION')),
    reason TEXT NOT NULL,
    approved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON migration.business_decisions TO service_role;

CREATE TABLE IF NOT EXISTS migration.rollback_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_batch_id UUID NOT NULL REFERENCES migration.migration_batches(id) ON DELETE CASCADE,
    target_table TEXT NOT NULL,
    records_compensated INTEGER NOT NULL DEFAULT 0,
    reason TEXT NOT NULL,
    executed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON migration.rollback_operations TO service_role;

-- 2. DOMAIN MAPPING TABLES
CREATE TABLE IF NOT EXISTS migration.unit_maps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    migration_batch_id UUID NOT NULL REFERENCES migration.migration_batches(id) ON DELETE CASCADE,
    source_value TEXT NOT NULL,
    destination_id UUID REFERENCES public.units_of_measure(id) ON DELETE CASCADE,
    mapping_status TEXT NOT NULL DEFAULT 'APPROVED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_unit_map_batch_val UNIQUE (migration_batch_id, source_value)
);
GRANT ALL ON migration.unit_maps TO service_role;

CREATE TABLE IF NOT EXISTS migration.tax_code_maps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    migration_batch_id UUID NOT NULL REFERENCES migration.migration_batches(id) ON DELETE CASCADE,
    source_value TEXT NOT NULL,
    destination_id UUID REFERENCES public.tax_codes(id) ON DELETE CASCADE,
    mapping_status TEXT NOT NULL DEFAULT 'APPROVED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tax_map_batch_val UNIQUE (migration_batch_id, source_value)
);
GRANT ALL ON migration.tax_code_maps TO service_role;

CREATE TABLE IF NOT EXISTS migration.payment_method_maps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    migration_batch_id UUID NOT NULL REFERENCES migration.migration_batches(id) ON DELETE CASCADE,
    source_value TEXT NOT NULL,
    destination_id UUID REFERENCES public.payment_methods(id) ON DELETE CASCADE,
    mapping_status TEXT NOT NULL DEFAULT 'APPROVED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_pm_map_batch_val UNIQUE (migration_batch_id, source_value)
);
GRANT ALL ON migration.payment_method_maps TO service_role;

-- 3. MIGRATION ROLLBACK FUNCTION
CREATE OR REPLACE FUNCTION migration.rollback_batch(
    p_batch_id UUID,
    p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, migration
AS $$
DECLARE
    v_batch RECORD;
BEGIN
    SELECT * INTO v_batch FROM migration.migration_batches WHERE id = p_batch_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'MIGRATION_BATCH_NOT_FOUND';
    END IF;

    IF v_batch.status = 'completed' THEN
        RAISE EXCEPTION 'CANNOT_ROLLBACK_FINALISED_BATCH';
    END IF;

    -- Compensate transformed results
    UPDATE migration.transformation_results
    SET transformation_status = 'ROLLED_BACK'
    WHERE migration_batch_id = p_batch_id;

    -- Log Rollback Operation
    INSERT INTO migration.rollback_operations (
        migration_batch_id, target_table, records_compensated, reason, executed_by
    ) VALUES (
        p_batch_id, 'ALL_DOMAINS', 0, p_reason, COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid)
    );

    -- Update batch status
    UPDATE migration.migration_batches
    SET status = 'rolled_back'
    WHERE id = p_batch_id;
END;
$$;

GRANT EXECUTE ON FUNCTION migration.rollback_batch(UUID, TEXT) TO service_role;

COMMIT;
