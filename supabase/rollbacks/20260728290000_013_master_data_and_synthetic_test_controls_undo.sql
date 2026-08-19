BEGIN;

DROP FUNCTION IF EXISTS public.create_operational_supplier(JSONB);
DROP FUNCTION IF EXISTS public.create_operational_customer(JSONB);

-- Restore the stricter migration-012 guard.
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
    IF v_mode NOT IN ('PILOT', 'LIVE') THEN
        RAISE EXCEPTION 'OPERATIONAL_MODE_REQUIRED: Current mode is %.', COALESCE(v_mode, 'UNSET');
    END IF;
END;
$$;

COMMIT;
