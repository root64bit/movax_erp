BEGIN;

DROP FUNCTION IF EXISTS public.post_operational_stock_movement_v2(UUID, UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_dashboard_metrics();
DROP FUNCTION IF EXISTS public.record_access_denied(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.complete_first_login_password_change();
DROP FUNCTION IF EXISTS public.get_current_user_context();
DROP FUNCTION IF EXISTS public.get_public_login_context();
DROP TABLE IF EXISTS audit.operational_events;

DELETE FROM public.roles WHERE code IN ('ADMINISTRATOR', 'MANAGER_LIMITED');
DELETE FROM public.permissions WHERE code IN (
  'dashboard.read', 'products.read', 'stock.read', 'stock.direct_entry',
  'stock.direct_exit', 'customers.read', 'suppliers.read', 'sales.read',
  'purchases.read', 'payments.read', 'payments.create', 'accounts.read',
  'reports.read', 'audit.read', 'migration.read', 'migration.execute',
  'system_mode.manage'
);

COMMIT;
