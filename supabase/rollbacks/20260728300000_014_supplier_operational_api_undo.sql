BEGIN;

DELETE FROM public.role_permissions rp
USING public.permissions p
WHERE rp.permission_id = p.id
  AND (
    (
      rp.role_id = '10000000-0000-0000-0000-000000000006'
      AND p.code IN (
        'products.view', 'products.view_cost', 'stock.view', 'documents.view',
        'suppliers.view', 'suppliers.create', 'suppliers.update', 'suppliers.view_balance',
        'purchases.invoice.create', 'purchases.invoice.confirm',
        'purchases.delivery_note.create', 'purchases.delivery_note.confirm',
        'purchases.credit_advice.create', 'purchases.credit_advice.confirm',
        'purchases.debit_advice.create', 'purchases.debit_advice.confirm',
        'purchases.return.create', 'purchases.return.confirm',
        'payments.view', 'current_accounts.supplier.view', 'reports.payables'
      )
    )
    OR (
      rp.role_id = '10000000-0000-0000-0000-000000000007'
      AND p.code IN (
        'documents.view', 'payments.view', 'payments.receive', 'payments.pay_supplier',
        'payments.allocate', 'payments.allocate_customer', 'payments.allocate_supplier',
        'payments.reverse', 'payments.reprint',
        'current_accounts.customer.view', 'current_accounts.supplier.view',
        'current_accounts.reconcile', 'customers.view', 'customers.view_balance',
        'suppliers.view', 'suppliers.view_balance',
        'reports.receivables', 'reports.payables', 'reports.tax', 'reports.audit',
        'reports.export'
      )
    )
  );

DROP FUNCTION IF EXISTS public.create_and_confirm_supplier_payment(UUID, UUID, TEXT, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_and_confirm_supplier_invoice(UUID, DATE, TEXT, TEXT, JSONB, TEXT);

COMMIT;
