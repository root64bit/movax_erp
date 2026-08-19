-- Allow cashiers to post direct stock-exit guides, including an explicitly
-- authorised negative balance. Entries, adjustments and transfers remain
-- outside the cashier role.

BEGIN;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'CASHIER'
  AND p.code IN (
    'stock.read',
    'stock.direct_exit',
    'stock.allow_negative',
    'stock.negative.authorize'
  )
ON CONFLICT DO NOTHING;

COMMIT;
