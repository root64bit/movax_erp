# 24 Screen to API Mapping

| Screen | Primary Entity | Secondary Entities | Queries (GET) | Commands (POST/PUT) | Required Permission | Validation Rules | Status Rules | Audit Events | Print Outputs |
|---|---|---|---|---|---|---|---|---|---|
| Início | Dashboard | products, documents, payments | `getDailySales`, `getLowStock`, `getPendingDebts` | — | (authenticated) | — | — | — | — |
| Nova Venda | Document (invoice) | products, customers | `searchProducts`, `searchCustomers` | `createDraftInvoice`, `addLine`, `removeLine`, `confirmInvoice` | `sales.create`, `sales.confirm` | all lines required, customer required for credit | draft→confirmed | `document.created`, `document.confirmed` | Invoice PDF |
| Artigos e Stock | Product | inventory_balances, prices | `getProducts`, `searchProducts` | `updateProductStatus` | `products.view` | — | active/inactive | `product.status_changed` | List PDF |
| Entrada de Stock | StockMovement | products, warehouses | `getProducts`, `getWarehouses` | `createStockEntry` | `stock.in` | qty > 0, reason required | pending→completed | `stock.entry_created` | Entry Note PDF |
| Saída de Stock | StockMovement | products, warehouses | `getProducts`, `getWarehouses` | `createStockExit` | `stock.out` | qty > 0, reason required | pending→completed | `stock.exit_created` | Exit Note PDF |
| Extrato de Movimentos | StockMovement | products | `getMovementHistory` | — | `stock.view` | valid date range | — | — | Statement PDF |
| Lista de Fornecedores | Supplier | — | `getSuppliers`, `searchSuppliers` | — | `suppliers.view` | — | active/inactive | — | List PDF |
| Novo/Editar Fornecedor | Supplier | addresses, contacts | `getSupplierDetails` | `createSupplier`, `updateSupplier` | `suppliers.edit` | name required, unique NUIT | active/inactive | `supplier.created`, `supplier.updated` | — |
| Guia Remessa Cliente | Document | customers, products | `searchCustomers`, `searchProducts` | `createDeliveryNote`, `confirmDeliveryNote` | `sales.delivery` | lines required | draft→confirmed | `document.created`, `document.confirmed` | Delivery Note PDF |
| Factura a Cliente | Document | customers, products | `searchCustomers`, `searchProducts` | `createInvoice`, `confirmInvoice` | `sales.invoice` | lines required | draft→confirmed | `document.created`, `document.confirmed` | Invoice PDF |
| Nota Crédito Cliente | Document | customers, invoices | `getInvoicesForCredit` | `createCreditNote`, `confirmCreditNote` | `sales.credit` | reference invoice required | draft→confirmed | `document.created`, `document.confirmed` | Credit Note PDF |
| Nota Débito Cliente | Document | customers, invoices | `getInvoicesForDebit` | `createDebitNote`, `confirmDebitNote` | `sales.debit` | reference invoice required | draft→confirmed | `document.created`, `document.confirmed` | Debit Note PDF |
| Guia Remessa Fornecedor| Document | suppliers, products | `searchSuppliers`, `searchProducts` | `createSupplierDelivery`| `purchases.delivery` | lines required | draft→confirmed | `document.created`, `document.confirmed` | Delivery Note PDF |
| Registo Factura Fornecedor| Document | suppliers, products | `searchSuppliers`, `searchProducts` | `createSupplierInvoice` | `purchases.invoice` | lines required, supplier invoice ref | draft→confirmed | `document.created`, `document.confirmed` | — |
| Aviso Débito Fornecedor| Document | suppliers | `getSupplierInvoices` | `createSupplierDebit` | `purchases.debit` | lines required | draft→confirmed | `document.created`, `document.confirmed` | — |
| Aviso Crédito Fornecedor| Document | suppliers | `getSupplierInvoices` | `createSupplierCredit` | `purchases.credit` | lines required | draft→confirmed | `document.created`, `document.confirmed` | — |
| Pagamento Fornecedor | Payment | suppliers, invoices | `getPendingSupplierInvoices` | `createSupplierPayment`, `allocatePayment` | `payments.out` | amount > 0, allocations <= amount| pending→allocated | `payment.created`, `payment.allocated` | Payment Note PDF |
| Conta Corrente Fornecedor| LedgerEntry | suppliers | `getSupplierLedger` | — | `ledgers.view` | valid date range | — | — | Account PDF |
| Conta Corrente Cliente | LedgerEntry | customers | `getCustomerLedger` | — | `ledgers.view` | valid date range | — | — | Account PDF |
| Recebimento Cliente | Payment | customers, invoices | `getPendingCustomerInvoices` | `createCustomerReceipt`, `allocateReceipt` | `payments.in` | amount > 0, allocations <= amount| pending→allocated | `payment.created`, `payment.allocated` | Receipt PDF |
| Distribuição Pagamento | PaymentAllocation | payments, invoices | `getPaymentDetails` | `allocatePayment` | `payments.allocate` | total allocated = amount | partial/full | `payment.allocated` | — |
| Recibo de Pagamento | Payment | customers | `getReceiptDetails` | — | `payments.view` | — | — | — | Receipt PDF |
| Pesquisa Documentos | Document | — | `searchDocuments` | — | `documents.search` | — | — | — | List PDF |
| Relatório de Stock | InventoryBalance| products, warehouses | `getStockReport` | — | `reports.stock` | valid filters | — | — | Report PDF |
| Relatório de Vendas | Document | products, customers | `getSalesReport` | — | `reports.sales` | valid filters | — | — | Report PDF |
| Contas Receber Pagar | LedgerEntry | customers, suppliers | `getFinancialsReport` | — | `reports.financials` | valid filters | — | — | Report PDF |
| Utilizadores | UserProfile | roles | `getUsers` | `updateUserStatus` | `settings.users` | — | active/inactive | `user.status_changed` | — |
| Perfis e Permissões | Role | permissions | `getRoles`, `getPermissions` | `createRole`, `updateRolePermissions` | `settings.roles` | unique name | — | `role.updated` | — |
| Tabelas e Configurações| Settings | taxes, sequences | `getSettings` | `updateSettings` | `settings.general` | valid config format | — | `settings.updated` | — |
| Auditoria/Migração | AuditLog | migration_batches | `getAuditLogs`, `getMigrations` | `runMigrationBatch` | `settings.admin` | — | pending→success/fail | `migration.run` | Audit Report PDF |
| Criar/Editar Artigo | Product | categories, prices | `getProductDetails` | `createProduct`, `updateProduct` | `products.edit` | unique code, valid price | active/inactive | `product.created`, `product.updated` | — |
| Lista de Clientes | Customer | — | `getCustomers`, `searchCustomers` | — | `customers.view` | — | active/inactive | — | List PDF |
| Criar/Editar Cliente | Customer | addresses, contacts | `getCustomerDetails` | `createCustomer`, `updateCustomer` | `customers.edit` | name required, unique NUIT | active/inactive | `customer.created`, `customer.updated` | — |
| Detalhes Cliente | Customer | documents, ledger | `getCustomerProfile` | — | `customers.view` | — | — | — | Profile PDF |
