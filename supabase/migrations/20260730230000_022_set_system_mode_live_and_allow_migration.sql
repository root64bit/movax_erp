-- Migration: 20260730230000_022_set_system_mode_live_and_allow_migration.sql
-- Purpose: Update SYSTEM_MODE to 'LIVE' and update require_operational_mode()
-- to allow operational RPCs (adding articles, stock movements, sales) without
-- blocking with OPERATIONAL_MODE_REQUIRED exception.

BEGIN;

-- Update system_settings to LIVE mode
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES ('SYSTEM_MODE', 'LIVE', 'System operational mode')
ON CONFLICT (setting_key) DO UPDATE SET setting_value = 'LIVE', updated_at = now();

-- Update require_operational_mode() function
CREATE OR REPLACE FUNCTION public.require_operational_mode()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_mode TEXT;
BEGIN
    SELECT setting_value INTO v_mode
    FROM public.system_settings
    WHERE setting_key = 'SYSTEM_MODE';

    -- Allow MIGRATION, PILOT, LIVE, and PRODUCTION modes
    IF v_mode NOT IN ('PILOT', 'LIVE', 'PRODUCTION', 'MIGRATION') THEN
        RAISE EXCEPTION 'OPERATIONAL_MODE_REQUIRED: Current mode is %.', COALESCE(v_mode, 'UNSET');
    END IF;
END;
$$;

COMMIT;
