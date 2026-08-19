-- MOVAX ERP / POS
-- Migration: 20260819140000_061_fix_admin_permissions_and_has_permission.sql
-- Purpose: Ensure ADMIN, ADMINISTRATOR and operational roles have all required permissions and update has_permission to support synonyms

BEGIN;

-- 1. Ensure all permissions are linked to ADMIN, ADMINISTRATOR and SUPER_ADMIN
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code IN ('ADMIN', 'ADMINISTRATOR', 'SUPER_ADMIN')
ON CONFLICT DO NOTHING;

-- 2. Ensure CASHIER, SALES_OP, STOCK_OP have stock.read / stock.view
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code IN ('CASHIER', 'SALES_OP', 'STOCK_OP', 'MANAGER', 'MANAGER_LIMITED')
  AND p.code IN ('stock.read', 'stock.view', 'products.read', 'products.view')
ON CONFLICT DO NOTHING;

-- 3. Upgrade public.has_permission to handle ADMIN bypass and synonyms
CREATE OR REPLACE FUNCTION public.has_permission(required_permission text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_perms TEXT[];
  v_roles TEXT[];
BEGIN
  -- Check if user is ADMIN, SUPER_ADMIN or ADMINISTRATOR
  SELECT ARRAY_AGG(r.code) INTO v_roles
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = auth.uid();

  IF 'ADMIN' = ANY(v_roles) OR 'SUPER_ADMIN' = ANY(v_roles) OR 'ADMINISTRATOR' = ANY(v_roles) THEN
    RETURN true;
  END IF;

  v_perms := public.get_user_permissions();

  IF required_permission = ANY(v_perms) THEN
    RETURN true;
  END IF;

  -- Synonyms fallback
  IF required_permission IN ('stock.movements.read', 'stock.read', 'stock.view') THEN
    RETURN 'stock.view' = ANY(v_perms) OR 'stock.read' = ANY(v_perms) OR 'stock.movements.read' = ANY(v_perms);
  END IF;

  IF required_permission IN ('products.read', 'products.view') THEN
    RETURN 'products.view' = ANY(v_perms) OR 'products.read' = ANY(v_perms);
  END IF;

  IF required_permission IN ('sales.read', 'sales.view') THEN
    RETURN 'sales.view' = ANY(v_perms) OR 'sales.read' = ANY(v_perms);
  END IF;

  IF required_permission IN ('documents.read', 'documents.view') THEN
    RETURN 'documents.view' = ANY(v_perms) OR 'documents.read' = ANY(v_perms);
  END IF;

  IF required_permission IN ('payments.read', 'payments.view') THEN
    RETURN 'payments.view' = ANY(v_perms) OR 'payments.read' = ANY(v_perms);
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_permission(text) TO anon, authenticated;

COMMIT;
