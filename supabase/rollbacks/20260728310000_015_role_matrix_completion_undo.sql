BEGIN;

DELETE FROM public.role_permissions rp
USING public.roles r, public.permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND (
    (r.code = 'SALES_OP' AND p.code IN ('documents.view', 'documents.print'))
    OR (
      r.code = 'CASHIER'
      AND p.code IN ('documents.view', 'documents.print', 'payments.allocate')
    )
    OR (
      r.code = 'READ_ONLY'
      AND p.code IN (
        'products.view', 'stock.view', 'customers.view', 'suppliers.view',
        'documents.view', 'payments.view'
      )
    )
  );

COMMIT;
