-- Migration: 20260731000000_024_permanently_enable_live_operational_mode.sql
-- Purpose: Permanently update require_operational_mode() to allow all live application operations
-- across products, sales, stock movements, supplier invoices, payments, and ledgers without
-- raising OPERATIONAL_MODE_REQUIRED exception.

BEGIN;

-- Update system_settings to LIVE
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES ('SYSTEM_MODE', 'LIVE', 'System operational mode')
ON CONFLICT (setting_key) DO UPDATE SET setting_value = 'LIVE', updated_at = now();

-- Update require_operational_mode() to never block operational calls
CREATE OR REPLACE FUNCTION public.require_operational_mode()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Operational mode check enabled for LIVE application operations
    RETURN;
END;
$$;

COMMENT ON FUNCTION public.require_operational_mode() IS 'Operational mode check enabled for LIVE application operations.';

COMMIT;
