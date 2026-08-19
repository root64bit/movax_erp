-- Migration: 20260728310000_015_role_matrix_completion.sql
-- Purpose: complete least-privilege system-role mappings used by the frontend.
-- Does not import legacy data and does not change SYSTEM_MODE.

BEGIN;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE (
    r.code = 'SALES_OP'
    AND p.code IN ('documents.view', 'documents.print')
) OR (
    r.code = 'CASHIER'
    AND p.code IN ('documents.view', 'documents.print', 'payments.allocate')
) OR (
    r.code = 'READ_ONLY'
    AND p.code IN (
        'products.view', 'stock.view', 'customers.view', 'suppliers.view',
        'documents.view', 'payments.view'
    )
)
ON CONFLICT DO NOTHING;

COMMIT;
