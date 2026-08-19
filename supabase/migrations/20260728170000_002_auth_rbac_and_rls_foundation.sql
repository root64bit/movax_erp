-- Migration: 20260728170000_002_auth_rbac_and_rls_foundation.sql
-- Description: Authentication profile integration, RBAC structures (roles, permissions, role_permissions, user_roles, branch/warehouse access, login_events), RLS policies, and authorization helper RPCs.
-- Target Database: bkbcgndzsfylwsinxwbb (Production Pre-Live Mode)

BEGIN;

-- 1. USER PROFILES (Links auth.users to company context)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    username VARCHAR(100) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT true,
    force_password_change BOOLEAN NOT NULL DEFAULT false,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_profile_email UNIQUE (email),
    CONSTRAINT uq_user_profile_username UNIQUE (company_id, username)
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO service_role;

-- 2. ROLES
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system_role BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_role_company_code UNIQUE (company_id, code)
);

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;

-- 3. PERMISSIONS (Global System Permissions Catalog)
CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) NOT NULL UNIQUE,
    module VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;

CREATE POLICY "permissions_select_all" ON public.permissions
    FOR SELECT TO authenticated USING (true);

-- 4. ROLE PERMISSIONS (Junction)
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;

-- 5. USER ROLES (Junction)
CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- 6. BRANCH ACCESS SCOPE
CREATE TABLE IF NOT EXISTS public.branch_access (
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, branch_id)
);

ALTER TABLE public.branch_access ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.branch_access TO authenticated;
GRANT ALL ON public.branch_access TO service_role;

-- 7. WAREHOUSE ACCESS SCOPE
CREATE TABLE IF NOT EXISTS public.warehouse_access (
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, warehouse_id)
);

ALTER TABLE public.warehouse_access ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.warehouse_access TO authenticated;
GRANT ALL ON public.warehouse_access TO service_role;

-- 8. LOGIN EVENTS (Audit trail for authentication)
CREATE TABLE IF NOT EXISTS public.login_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL, -- login_success, login_failed, logout, password_reset
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.login_events TO authenticated;
GRANT ALL ON public.login_events TO service_role;

-- ────────────────────────────────────────────────────────────
-- AUTHORIZATION HELPER RPC FUNCTIONS (SECURITY DEFINER)
-- ────────────────────────────────────────────────────────────

-- Helper 1: Get authenticated user's company_id
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT company_id FROM public.user_profiles WHERE id = auth.uid();
$$;

-- Helper 2: Get array of permission codes for authenticated user
CREATE OR REPLACE FUNCTION public.get_user_permissions()
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(ARRAY_AGG(DISTINCT p.code), '{}'::TEXT[])
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role_id = ur.role_id
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = auth.uid();
$$;

-- Helper 3: Check if user has specific permission code
CREATE OR REPLACE FUNCTION public.has_permission(required_permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT required_permission = ANY(public.get_user_permissions());
$$;

-- Helper 4: Check if user has branch access
CREATE OR REPLACE FUNCTION public.has_branch_access(target_branch_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.branch_access
    WHERE user_id = auth.uid() AND branch_id = target_branch_id
  );
$$;

-- Helper 5: Check if user has warehouse access
CREATE OR REPLACE FUNCTION public.has_warehouse_access(target_warehouse_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.warehouse_access
    WHERE user_id = auth.uid() AND warehouse_id = target_warehouse_id
  );
$$;

-- ────────────────────────────────────────────────────────────
-- RLS POLICIES FOR AUTH & RBAC TABLES
-- ────────────────────────────────────────────────────────────

CREATE POLICY "user_profiles_select" ON public.user_profiles
    FOR SELECT TO authenticated USING (
        id = auth.uid() OR public.has_permission('users.manage')
    );

CREATE POLICY "user_profiles_update" ON public.user_profiles
    FOR UPDATE TO authenticated USING (
        id = auth.uid() OR public.has_permission('users.manage')
    );

CREATE POLICY "roles_select" ON public.roles
    FOR SELECT TO authenticated USING (
        company_id = public.get_user_company_id()
    );

CREATE POLICY "role_permissions_select" ON public.role_permissions
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "user_roles_select" ON public.user_roles
    FOR SELECT TO authenticated USING (
        user_id = auth.uid() OR public.has_permission('users.manage')
    );

CREATE POLICY "branch_access_select" ON public.branch_access
    FOR SELECT TO authenticated USING (
        user_id = auth.uid() OR public.has_permission('users.manage')
    );

CREATE POLICY "warehouse_access_select" ON public.warehouse_access
    FOR SELECT TO authenticated USING (
        user_id = auth.uid() OR public.has_permission('users.manage')
    );

CREATE POLICY "login_events_select" ON public.login_events
    FOR SELECT TO authenticated USING (
        user_id = auth.uid() OR public.has_permission('audit.view')
    );

CREATE POLICY "login_events_insert" ON public.login_events
    FOR INSERT TO authenticated WITH CHECK (
        user_id = auth.uid()
    );

-- ────────────────────────────────────────────────────────────
-- SEED DATA: PERMISSIONS (~70 Granular Permissions)
-- ────────────────────────────────────────────────────────────

INSERT INTO public.permissions (code, module, description) VALUES
    -- Articles & Pricing
    ('products.view', 'Catalogue', 'View articles catalog'),
    ('products.create', 'Catalogue', 'Create new articles'),
    ('products.update', 'Catalogue', 'Update article details'),
    ('products.deactivate', 'Catalogue', 'Deactivate articles'),
    ('products.view_cost', 'Catalogue', 'View article cost prices and profit margins'),
    ('products.change_cost', 'Catalogue', 'Change article cost prices'),
    ('products.change_sale_price', 'Catalogue', 'Change article sale prices'),

    -- Stock
    ('stock.view', 'Inventory', 'View stock balances and extracts'),
    ('stock.entry.create', 'Inventory', 'Create stock entry drafts'),
    ('stock.entry.confirm', 'Inventory', 'Confirm and post stock entries'),
    ('stock.exit.create', 'Inventory', 'Create stock exit drafts'),
    ('stock.exit.confirm', 'Inventory', 'Confirm and post stock exits'),
    ('stock.adjust', 'Inventory', 'Create inventory count adjustments'),
    ('stock.transfer', 'Inventory', 'Create and confirm stock transfers'),
    ('stock.allow_negative', 'Inventory', 'Override negative stock restrictions'),
    ('stock.view_valuation', 'Inventory', 'View total inventory valuation'),

    -- Sales Documents
    ('sales.create', 'Sales', 'Create sales document drafts'),
    ('sales.confirm', 'Sales', 'Confirm and issue sales documents'),
    ('sales.apply_discount', 'Sales', 'Apply custom discounts'),
    ('sales.override_price', 'Sales', 'Override item sale prices'),
    ('sales.sell_below_cost', 'Sales', 'Sell items below cost price'),
    ('sales.cancel', 'Sales', 'Cancel issued sales documents'),
    ('sales.print', 'Sales', 'Print sales documents'),
    ('sales.reprint', 'Sales', 'Reprint historical documents'),

    -- Customers
    ('customers.view', 'Customers', 'View customer details and current accounts'),
    ('customers.create', 'Customers', 'Create new customers'),
    ('customers.update', 'Customers', 'Update customer details'),
    ('customers.view_balance', 'Customers', 'View customer outstanding balance'),
    ('customers.change_credit_limit', 'Customers', 'Modify customer credit limits'),

    -- Suppliers
    ('suppliers.view', 'Suppliers', 'View supplier details and current accounts'),
    ('suppliers.create', 'Suppliers', 'Create new suppliers'),
    ('suppliers.update', 'Suppliers', 'Update supplier details'),
    ('suppliers.view_balance', 'Suppliers', 'View supplier outstanding balance'),
    ('suppliers.view_bank_details', 'Suppliers', 'View supplier bank accounts'),

    -- Payments & Current Accounts
    ('payments.view', 'Payments', 'View customer and supplier payment history'),
    ('payments.receive', 'Payments', 'Issue customer receipts'),
    ('payments.pay_supplier', 'Payments', 'Issue supplier payments'),
    ('payments.allocate', 'Payments', 'Allocate partial payments to documents'),
    ('payments.reverse', 'Payments', 'Reverse receipts or payments'),

    -- Reports
    ('reports.stock', 'Reports', 'Generate stock reports'),
    ('reports.sales', 'Reports', 'Generate sales reports'),
    ('reports.margin', 'Reports', 'Generate margin and profit reports'),
    ('reports.receivables', 'Reports', 'Generate accounts receivable aging reports'),
    ('reports.payables', 'Reports', 'Generate accounts payable aging reports'),
    ('reports.tax', 'Reports', 'Generate VAT and tax reports'),
    ('reports.audit', 'Reports', 'Generate system audit reports'),
    ('reports.export', 'Reports', 'Export reports to Excel or PDF'),

    -- Administration
    ('users.manage', 'Admin', 'Manage user accounts, invitations, and role assignments'),
    ('roles.manage', 'Admin', 'Manage roles and permission matrix'),
    ('settings.manage', 'Admin', 'Manage company and system settings'),
    ('migration.manage', 'Admin', 'Manage legacy XT-POS data migration batches'),
    ('backups.manage', 'Admin', 'Manage database backups and restores'),
    ('audit.view', 'Admin', 'View security audit logs')
ON CONFLICT (code) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- SEED DATA: 8 SYSTEM ROLES
-- ────────────────────────────────────────────────────────────

INSERT INTO public.roles (id, company_id, code, name, description, is_system_role) VALUES
    ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'ADMIN', 'Administrador', 'Acesso total ao sistema', true),
    ('10000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'MANAGER', 'Gerente Operacional', 'Gestão comercial, de stock e financeira', true),
    ('10000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'STOCK_OP', 'Operador de Stock', 'Gestão de entradas, saídas e contagem de artigos', true),
    ('10000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'SALES_OP', 'Vendedor', 'Emissão de vendas, guias e facturas', true),
    ('10000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'CASHIER', 'Caixa', 'Recebimentos de clientes e fecho de caixa', true),
    ('10000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'PURCHASING_OP', 'Operador de Compras', 'Gestão de fornecedores e facturas de compra', true),
    ('10000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'ACCOUNTING_OP', 'Contabilidade', 'Gestão de contas correntes, extractos e relatórios fiscais', true),
    ('10000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'READ_ONLY', 'Leitura Simples', 'Consulta de artigos, stock e documentos sem permissão de alteração', true)
ON CONFLICT (company_id, code) DO NOTHING;

-- Grant ALL permissions to ADMIN role
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000001', id FROM public.permissions
ON CONFLICT DO NOTHING;

-- Grant Sales & Stock permissions to MANAGER role
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000002', id FROM public.permissions
WHERE code NOT IN ('users.manage', 'roles.manage', 'settings.manage', 'migration.manage', 'backups.manage')
ON CONFLICT DO NOTHING;

-- Grant Stock permissions to STOCK_OP role
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000003', id FROM public.permissions
WHERE code IN ('products.view', 'stock.view', 'stock.entry.create', 'stock.entry.confirm', 'stock.exit.create', 'stock.exit.confirm', 'stock.adjust', 'stock.transfer')
ON CONFLICT DO NOTHING;

-- Grant Sales permissions to SALES_OP role (NO cost price viewing)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000004', id FROM public.permissions
WHERE code IN ('products.view', 'stock.view', 'sales.create', 'sales.confirm', 'sales.print', 'customers.view', 'customers.create')
ON CONFLICT DO NOTHING;

-- Grant Cashier permissions to CASHIER role
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000005', id FROM public.permissions
WHERE code IN ('products.view', 'sales.create', 'sales.confirm', 'sales.print', 'payments.view', 'payments.receive', 'customers.view', 'customers.view_balance')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- DATABASE TRIGGER: PROVISION USER PROFILE ON SIGNUP
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    default_company_id UUID := 'a0000000-0000-0000-0000-000000000001';
    default_role_id UUID := '10000000-0000-0000-0000-000000000004'; -- SALES_OP by default
    default_branch_id UUID := 'b0000000-0000-0000-0000-000000000001';
    default_warehouse_id UUID := 'c0000000-0000-0000-0000-000000000001';
BEGIN
    -- Create user profile
    INSERT INTO public.user_profiles (
        id,
        company_id,
        username,
        full_name,
        email,
        phone
    ) VALUES (
        NEW.id,
        default_company_id,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.email,
        NEW.raw_user_meta_data->>'phone'
    ) ON CONFLICT (id) DO NOTHING;

    -- Assign default role
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (NEW.id, default_role_id)
    ON CONFLICT DO NOTHING;

    -- Assign default branch & warehouse access
    INSERT INTO public.branch_access (user_id, branch_id)
    VALUES (NEW.id, default_branch_id)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.warehouse_access (user_id, warehouse_id)
    VALUES (NEW.id, default_warehouse_id)
    ON CONFLICT DO NOTHING;

    RETURN NEW;
END;
$$;

-- Trigger execution on auth.users INSERT
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMIT;
