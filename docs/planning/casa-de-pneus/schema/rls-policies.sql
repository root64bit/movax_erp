-- ============================================================
-- ROW LEVEL SECURITY POLICIES — Casa de Pneus, Lda.
-- ============================================================
-- This file defines RLS policies for all tables.
-- Requires: Supabase Auth (auth.uid()), helper functions below.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- HELPER FUNCTIONS
-- ────────────────────────────────────────────────────────────

-- Get the company_id for the currently authenticated user
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.user_profiles WHERE id = auth.uid();
$$;

-- Get all permission codes for the currently authenticated user
CREATE OR REPLACE FUNCTION public.get_user_permissions()
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(DISTINCT p.code)
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role_id = ur.role_id
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = auth.uid();
$$;

-- Check if user has a specific permission
CREATE OR REPLACE FUNCTION public.has_permission(required_permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT required_permission = ANY(public.get_user_permissions());
$$;

-- Check if user has branch access
CREATE OR REPLACE FUNCTION public.has_branch_access(target_branch_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.branch_access
    WHERE user_id = auth.uid() AND branch_id = target_branch_id
  );
$$;

-- Check if user has warehouse access
CREATE OR REPLACE FUNCTION public.has_warehouse_access(target_warehouse_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.warehouse_access
    WHERE user_id = auth.uid() AND warehouse_id = target_warehouse_id
  );
$$;

-- ────────────────────────────────────────────────────────────
-- ENABLE RLS ON ALL TABLES
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units_of_measure ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movement_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_count_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_method_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_reversals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entry_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_reconciliation_results ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- COMPANY ISOLATION (applies to all company-scoped tables)
-- ────────────────────────────────────────────────────────────

-- Companies: users can only see their own company
CREATE POLICY "company_isolation" ON public.companies
  FOR SELECT USING (id = public.get_user_company_id());

-- Branches: company-scoped
CREATE POLICY "branch_company_isolation" ON public.branches
  FOR SELECT USING (company_id = public.get_user_company_id());

-- Warehouses: company-scoped via branch
CREATE POLICY "warehouse_company_isolation" ON public.warehouses
  FOR SELECT USING (
    branch_id IN (
      SELECT id FROM public.branches WHERE company_id = public.get_user_company_id()
    )
  );

-- ────────────────────────────────────────────────────────────
-- USER PROFILES
-- ────────────────────────────────────────────────────────────

-- Users see own profile; admins see all in company
CREATE POLICY "profiles_select" ON public.user_profiles
  FOR SELECT USING (
    id = auth.uid()
    OR (
      company_id = public.get_user_company_id()
      AND public.has_permission('users.manage')
    )
  );

-- Only admins can insert/update profiles (via server functions)
CREATE POLICY "profiles_insert" ON public.user_profiles
  FOR INSERT WITH CHECK (public.has_permission('users.manage'));

CREATE POLICY "profiles_update" ON public.user_profiles
  FOR UPDATE USING (
    id = auth.uid()
    OR public.has_permission('users.manage')
  );

-- ────────────────────────────────────────────────────────────
-- ROLES & PERMISSIONS (read-only for non-admins)
-- ────────────────────────────────────────────────────────────

CREATE POLICY "roles_select" ON public.roles
  FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "roles_modify" ON public.roles
  FOR ALL USING (public.has_permission('roles.manage'));

CREATE POLICY "permissions_select" ON public.permissions
  FOR SELECT USING (true);  -- permissions are global reference data

CREATE POLICY "role_permissions_select" ON public.role_permissions
  FOR SELECT USING (
    role_id IN (SELECT id FROM public.roles WHERE company_id = public.get_user_company_id())
  );

CREATE POLICY "user_roles_select" ON public.user_roles
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.has_permission('users.manage')
  );

-- ────────────────────────────────────────────────────────────
-- PRODUCTS (company-scoped, cost masking via application layer)
-- ────────────────────────────────────────────────────────────

CREATE POLICY "products_select" ON public.products
  FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "products_insert" ON public.products
  FOR INSERT WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.has_permission('products.create')
  );

CREATE POLICY "products_update" ON public.products
  FOR UPDATE USING (
    company_id = public.get_user_company_id()
    AND public.has_permission('products.update')
  );

-- Price history: only users with cost visibility
CREATE POLICY "price_history_select" ON public.price_history
  FOR SELECT USING (
    product_id IN (SELECT id FROM public.products WHERE company_id = public.get_user_company_id())
    AND public.has_permission('products.view_cost')
  );

-- ────────────────────────────────────────────────────────────
-- STOCK (company-scoped, warehouse-scoped for writes)
-- ────────────────────────────────────────────────────────────

CREATE POLICY "inventory_balances_select" ON public.inventory_balances
  FOR SELECT USING (company_id = public.get_user_company_id());

-- Stock movements: READ company-scoped, WRITE via server functions only
CREATE POLICY "stock_movements_select" ON public.stock_movements
  FOR SELECT USING (company_id = public.get_user_company_id());

-- No direct INSERT/UPDATE/DELETE on stock_movements from client
-- All writes go through confirm_stock_entry() / confirm_document() server RPCs

-- ────────────────────────────────────────────────────────────
-- CUSTOMERS & SUPPLIERS (company-scoped)
-- ────────────────────────────────────────────────────────────

CREATE POLICY "customers_select" ON public.customers
  FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "customers_insert" ON public.customers
  FOR INSERT WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.has_permission('customers.create')
  );

CREATE POLICY "customers_update" ON public.customers
  FOR UPDATE USING (
    company_id = public.get_user_company_id()
    AND public.has_permission('customers.update')
  );

CREATE POLICY "suppliers_select" ON public.suppliers
  FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "suppliers_insert" ON public.suppliers
  FOR INSERT WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.has_permission('suppliers.create')
  );

CREATE POLICY "suppliers_update" ON public.suppliers
  FOR UPDATE USING (
    company_id = public.get_user_company_id()
    AND public.has_permission('suppliers.update')
  );

-- Supplier bank accounts: restricted to users with suppliers.view_bank_details
CREATE POLICY "supplier_bank_select" ON public.supplier_bank_accounts
  FOR SELECT USING (
    supplier_id IN (SELECT id FROM public.suppliers WHERE company_id = public.get_user_company_id())
    AND public.has_permission('suppliers.view_bank_details')
  );

-- ────────────────────────────────────────────────────────────
-- DOCUMENTS (company-scoped, writes via server functions)
-- ────────────────────────────────────────────────────────────

CREATE POLICY "documents_select" ON public.documents
  FOR SELECT USING (company_id = public.get_user_company_id());

-- Draft documents can be created/updated from client
CREATE POLICY "documents_insert_draft" ON public.documents
  FOR INSERT WITH CHECK (
    company_id = public.get_user_company_id()
    AND status = 'draft'
    AND public.has_permission('sales.create')
  );

CREATE POLICY "documents_update_draft" ON public.documents
  FOR UPDATE USING (
    company_id = public.get_user_company_id()
    AND status = 'draft'
  );

-- Document lines follow parent document access
CREATE POLICY "document_lines_select" ON public.document_lines
  FOR SELECT USING (
    document_id IN (SELECT id FROM public.documents WHERE company_id = public.get_user_company_id())
  );

-- CONFIRM, CANCEL operations: server-side RPCs only
-- These RPCs use SECURITY DEFINER to bypass RLS

-- ────────────────────────────────────────────────────────────
-- PAYMENTS (company-scoped, writes via server functions)
-- ────────────────────────────────────────────────────────────

CREATE POLICY "payments_select" ON public.payments
  FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "payment_allocations_select" ON public.payment_allocations
  FOR SELECT USING (
    payment_id IN (SELECT id FROM public.payments WHERE company_id = public.get_user_company_id())
  );

-- All payment writes go through server RPCs:
-- create_customer_receipt(), allocate_payment(), reverse_payment()

-- ────────────────────────────────────────────────────────────
-- LEDGER (company-scoped, read-only from client)
-- ────────────────────────────────────────────────────────────

CREATE POLICY "ledger_entries_select" ON public.ledger_entries
  FOR SELECT USING (company_id = public.get_user_company_id());

-- No direct writes. All ledger entries created by server RPCs during
-- document confirmation, payment allocation, and reversals.

-- ────────────────────────────────────────────────────────────
-- AUDIT LOGS (restricted to audit.view permission)
-- ────────────────────────────────────────────────────────────

CREATE POLICY "audit_logs_select" ON public.audit_logs
  FOR SELECT USING (
    company_id = public.get_user_company_id()
    AND public.has_permission('audit.view')
  );

-- Audit logs are append-only via server functions
-- No UPDATE or DELETE policies

-- ────────────────────────────────────────────────────────────
-- MIGRATION (restricted to migration.manage permission)
-- ────────────────────────────────────────────────────────────

CREATE POLICY "migration_batches_select" ON public.migration_batches
  FOR SELECT USING (
    company_id = public.get_user_company_id()
    AND public.has_permission('migration.manage')
  );

CREATE POLICY "migration_records_select" ON public.migration_records
  FOR SELECT USING (
    batch_id IN (
      SELECT id FROM public.migration_batches
      WHERE company_id = public.get_user_company_id()
    )
    AND public.has_permission('migration.manage')
  );

CREATE POLICY "migration_errors_select" ON public.migration_errors
  FOR SELECT USING (
    batch_id IN (
      SELECT id FROM public.migration_batches
      WHERE company_id = public.get_user_company_id()
    )
    AND public.has_permission('migration.manage')
  );

-- All migration writes go through server RPCs:
-- import_migration_batch(), validate_batch(), finalise_batch()

-- ────────────────────────────────────────────────────────────
-- REFERENCE DATA (read-only from client)
-- ────────────────────────────────────────────────────────────

CREATE POLICY "company_settings_select" ON public.company_settings
  FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "fiscal_periods_select" ON public.fiscal_periods
  FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "document_types_select" ON public.document_types
  FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "payment_methods_select" ON public.payment_methods
  FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "tax_codes_select" ON public.tax_codes
  FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "product_families_select" ON public.product_families
  FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "brands_select" ON public.brands
  FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "units_select" ON public.units_of_measure
  FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "stock_reasons_select" ON public.stock_movement_reasons
  FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "ledger_accounts_select" ON public.ledger_accounts
  FOR SELECT USING (company_id = public.get_user_company_id());

-- Settings writes restricted to settings.manage permission
CREATE POLICY "settings_modify" ON public.company_settings
  FOR ALL USING (
    company_id = public.get_user_company_id()
    AND public.has_permission('settings.manage')
  );
