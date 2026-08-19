# 09 Row Level Security (RLS)

## Overview
Supabase relies on PostgreSQL's Row Level Security (RLS) to enforce data access policies directly at the database layer. This ensures that even if an API endpoint is compromised, data cannot be accessed or modified without the appropriate permissions and context.

## Core Principles
1. **Company Isolation**: Users can only see data belonging to their `company_id`.
2. **Branch/Warehouse Isolation**: Users can only interact with entities (sales, stock movements) in branches/warehouses they are explicitly linked to via the `branch_access` / `warehouse_access` tables.
3. **Role & Permission Tables**: Read-only for everyone except Administrators. Writes go through restricted server-side functions.
4. **Field-Level Nuances**: RLS handles row visibility. Field visibility (e.g. cost price) is often handled via database views or Edge Functions that redact the data based on permissions.

## Helper Functions

```sql
-- Get current user's company ID (Assumes custom claim or single-tenant for now, or fetch from profile)
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM public.user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Check if user has specific permission
CREATE OR REPLACE FUNCTION has_permission(required_perm TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role_id = rp.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid() AND p.name = required_perm
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Check if user has access to a branch
CREATE OR REPLACE FUNCTION has_branch_access(target_branch UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_branches ub
    WHERE ub.user_id = auth.uid() AND ub.branch_id = target_branch
  );
$$ LANGUAGE sql SECURITY DEFINER;
```

## SQL Policy Outlines (Examples)

### User Profiles
```sql
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" 
ON public.user_profiles FOR SELECT 
USING (id = auth.uid());

CREATE POLICY "Admins can view all profiles in company" 
ON public.user_profiles FOR SELECT 
USING (has_permission('users.manage') AND company_id = get_user_company_id());
```

### Products Visibility
All authenticated users can see products in their company.
```sql
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view products" 
ON public.products FOR SELECT 
USING (company_id = get_user_company_id());

CREATE POLICY "Users with permission can create products" 
ON public.products FOR INSERT 
WITH CHECK (has_permission('products.create') AND company_id = get_user_company_id());
```

### Cost-Price Visibility
While RLS handles row visibility, a database view is used to redact sensitive columns for users lacking permissions.
```sql
CREATE VIEW public.vw_products AS
SELECT 
    id, name, sku, company_id, 
    sale_price,
    CASE WHEN has_permission('products.view_cost') THEN cost_price ELSE NULL END as cost_price
FROM public.products;
```

### Customer/Supplier Access
```sql
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company users can view customers" 
ON public.customers FOR SELECT 
USING (company_id = get_user_company_id());
```

### Document Access (Sales / Invoices)
```sql
ALTER TABLE public.sales_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view documents in their branches" 
ON public.sales_documents FOR SELECT 
USING (
  company_id = get_user_company_id() AND 
  has_branch_access(branch_id)
);
```

### Audit and Migration Tables
```sql
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only auditors can view audit logs"
ON public.audit_logs FOR SELECT
USING (has_permission('audit.view') AND company_id = get_user_company_id());

-- NO INSERT/UPDATE/DELETE policies for clients. Audit logs are written strictly by Triggers using SECURITY DEFINER.
```

## Critical Operations via Server Functions
To prevent race conditions and ensure complex validations (like verifying stock availability before confirming a sale), the following actions **MUST NOT** be direct table writes from the client. They must be executed via Supabase RPCs (Stored Procedures) or Edge Functions:
- Confirming documents (Invoices, Receipts)
- Posting stock movements
- Allocating payments
- Reversing payments
- Cancelling documents
- Creating stock adjustments
- Changing user roles
- Importing migration data
