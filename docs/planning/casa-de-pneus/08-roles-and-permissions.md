# 08 Roles and Permissions

## Overview
Casa de Pneus uses a robust Role-Based Access Control (RBAC) model. All access relies on a set of granular permissions grouped by module. 

## 8 Core Roles
1. **Administrator (Admin)**: Full system access.
2. **Manager (Gerente)**: High-level access, overriding approvals, reporting.
3. **Stock Operator**: Inventory movements, counting, transfers.
4. **Sales Operator**: POS sales, issuing quotes, basic customer management.
5. **Cashier (Caixa)**: Receiving payments, managing tills.
6. **Purchasing Operator**: Receiving supplier invoices and delivery notes.
7. **Accounting Operator**: Debtors/creditors, extratos, tax reporting.
8. **Read-Only (Auditor)**: Viewing documents and reports without modification rights.

## Complete Permission List (~70+ Permissions)

### Articles
- `products.view`
- `products.create`
- `products.update`
- `products.deactivate`
- `products.view_cost` (Sensitive)
- `products.change_cost`
- `products.change_sale_price`

### Stock
- `stock.view`
- `stock.entry.create`
- `stock.entry.confirm`
- `stock.exit.create`
- `stock.exit.confirm`
- `stock.adjust`
- `stock.transfer`
- `stock.allow_negative`
- `stock.view_valuation` (Sensitive)

### Sales
- `sales.create`
- `sales.confirm`
- `sales.apply_discount`
- `sales.override_price`
- `sales.sell_below_cost` (Requires secondary confirmation)
- `sales.cancel`
- `sales.print`
- `sales.reprint`

### Customers
- `customers.view`
- `customers.create`
- `customers.update`
- `customers.view_balance`
- `customers.change_credit_limit`

### Suppliers
- `suppliers.view`
- `suppliers.create`
- `suppliers.update`
- `suppliers.view_balance`
- `suppliers.view_bank_details`

### Payments
- `payments.view`
- `payments.receive`
- `payments.pay_supplier`
- `payments.allocate`
- `payments.reverse`

### Reports
- `reports.stock`
- `reports.sales`
- `reports.margin` (Sensitive)
- `reports.receivables`
- `reports.payables`
- `reports.tax`
- `reports.audit`
- `reports.export`

### Admin
- `users.manage`
- `roles.manage`
- `settings.manage`
- `migration.manage`
- `backups.manage`
- `audit.view`

## Default Role-Permission Matrix (Highlights)
- **Admin**: All permissions.
- **Sales Operator**: `products.view`, `stock.view`, `sales.create`, `sales.confirm`, `sales.print`, `customers.view`. NO `products.view_cost`.
- **Stock Operator**: `products.view`, `stock.view`, `stock.entry.create`, `stock.exit.create`, `stock.transfer`.
- **Manager**: All Sales/Stock/Reports permissions including `products.view_cost` and `reports.margin`.
- **Accounting Operator**: `customers.view_balance`, `suppliers.view_balance`, `payments.view`, `reports.tax`.

## Screen-to-Permission Mapping
Using the 30 Stitch Screens:
1. **Início (Home)**: Basic auth required.
2. **Nova Venda**: `sales.create`
3. **Artigos e Stock**: `products.view` / `stock.view`
4. **Entrada de Stock**: `stock.entry.create`
5. **Saída de Stock**: `stock.exit.create`
6. **Extrato de Movimentos**: `stock.view` / `reports.stock`
7. **Lista de Fornecedores**: `suppliers.view`
8. **Novo ou Editar Fornecedor**: `suppliers.create` / `suppliers.update`
9. **Guia de Remessa a Cliente**: `sales.create`
10. **Factura a Cliente**: `sales.confirm`
11. **Nota de Crédito a Cliente**: `sales.cancel` / `sales.create`
12. **Nota de Débito a Cliente**: `sales.create`
13. **Guia de Remessa de Fornecedor**: `stock.entry.create`
14. **Registo de Factura de Fornecedor**: `payments.pay_supplier`
15. **Aviso de Lançamento a Débito de Fornecedor**: `payments.pay_supplier`
16. **Aviso de Lançamento a Crédito de Fornecedor**: `payments.pay_supplier`
17. **Pagamento a Fornecedor**: `payments.pay_supplier`
18. **Conta Corrente de Fornecedor**: `suppliers.view_balance`
19. **Conta Corrente de Cliente**: `customers.view_balance`
20. **Recebimento de Cliente**: `payments.receive`
21. **Distribuição de Pagamento Parcial**: `payments.allocate`
22. **Recibo de Pagamento**: `payments.view` / `payments.receive`
23. **Pesquisa de Documentos**: `sales.view` (implicitly part of sales.create/reports)
24. **Relatório de Stock**: `reports.stock`
25. **Relatório de Vendas**: `reports.sales`
26. **Contas a Receber e Pagar**: `reports.receivables` / `reports.payables`
27. **Utilizadores**: `users.manage`
28. **Perfis e Permissões**: `roles.manage`
29. **Tabelas e Configurações**: `settings.manage`
30. **Auditoria, Backup e Migração**: `audit.view`, `backups.manage`, `migration.manage`

*Missing Screens from plan:*
- **Create or Edit Article**: `products.create` / `products.update`
- **Customer List**: `customers.view`
- **Create or Edit Customer**: `customers.create` / `customers.update`
- **Customer Details**: `customers.view`
- **Supplier Delivery Note**: `stock.entry.create`

## Cost-Hiding Rules
Cost prices, stock valuations, and profit margins are extremely sensitive. Any API endpoint or DB view exposing cost (e.g. `custo_medio`, `valor_stock`) will explicitly check for `products.view_cost` or `reports.margin` permissions via RLS or application logic. If lacking, these fields return `null`.

## Branch and Warehouse Scope
A user is assigned to one or more branches/warehouses in the `user_branches` table.
- Operations can only be executed for branches the user has access to.
- E.g. A stock operator in Maputo Branch cannot confirm stock entries for the Beira Branch.

## Secondary Confirmation Requirements
Certain actions require manager approval (e.g., selling below cost). This is implemented via a secondary prompt where a Manager enters their credentials/PIN to authorize the specific transaction payload before it is submitted to the server.

## Server-Side Authorization Helpers
- `checkPermission(userId, permission)`: Validates if the user's role array includes the permission.
- `checkBranchAccess(userId, branchId)`: Ensures the user is authorized for the target branch.
- `isManager(userId)`: Fast-path check for managerial overrides.
