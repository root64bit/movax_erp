-- MOVAX ERP / POS
-- Migration: 20260819130000_060_tenant_4digit_code_and_lookup.sql
-- Purpose: Add 4-digit Tenant ID (tenant_code) to companies and provide secure user lookup RPC

BEGIN;

-- 1. Add tenant_code column to companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS tenant_code VARCHAR(10);

-- Ensure Casa de Pneus has code 1001
UPDATE public.companies
SET tenant_code = '1001'
WHERE id = 'a0000000-0000-0000-0000-000000000001';

-- Update any other companies with sequential 4-digit codes
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM public.companies
  WHERE tenant_code IS NULL
)
UPDATE public.companies c
SET tenant_code = (1000 + numbered.rn)::TEXT
FROM numbered
WHERE c.id = numbered.id AND c.tenant_code IS NULL;

-- Make tenant_code unique
CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_tenant_code ON public.companies(tenant_code);

-- 2. Lookup Tenant User RPC (Allows logging in with 4-digit Tenant ID + Username/Email)
CREATE OR REPLACE FUNCTION public.lookup_tenant_user_v1(
  p_tenant_code TEXT,
  p_username_or_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_company public.companies;
  v_user_email TEXT;
  v_found BOOLEAN := false;
BEGIN
  -- 1. Find company by 4-digit tenant_code
  SELECT * INTO v_company
  FROM public.companies
  WHERE tenant_code = TRIM(p_tenant_code);

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'TENANT_NOT_FOUND',
      'message', 'Código da Empresa (Tenant ID) inválido ou não encontrado.'
    );
  END IF;

  -- 2. Find matching user profile in this specific company
  -- Match by full email OR username prefix (e.g. "admin" for admin@casadepneus.co.mz)
  SELECT u.email INTO v_user_email
  FROM public.user_profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.company_id = v_company.id
    AND (
      LOWER(u.email) = LOWER(TRIM(p_username_or_email))
      OR LOWER(SPLIT_PART(u.email, '@', 1)) = LOWER(TRIM(p_username_or_email))
    )
  LIMIT 1;

  IF v_user_email IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'USER_NOT_IN_TENANT',
      'message', 'Utilizador não encontrado nesta empresa. Verifique o Código da Empresa e o Utilizador.'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'company_id', v_company.id,
    'company_name', v_company.name,
    'tenant_code', v_company.tenant_code,
    'email', v_user_email
  );
END;
$$;

-- Grant execution to anon and authenticated
GRANT EXECUTE ON FUNCTION public.lookup_tenant_user_v1(TEXT, TEXT) TO anon, authenticated;

COMMIT;
