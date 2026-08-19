# 23 Screen to Component Mapping

| # | Screen Title (PT) | Stitch ID | Route | Primary Component | Child Components | State Management | Forms | Modals | Keyboard Shortcuts |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Início | dd56cd8f/514df40d | `/` | `DashboardPage` | `QuickActions`, `SalesSummary`, `StockAlerts`, `PendingDebts` | Server state (React Query) | None | None | None |
| 2 | Nova Venda | 0587efb8 | `/sales/new` | `NewSalePage` | `CustomerSelect`, `ArticleSearch`, `LineItemTable`, `TotalsPanel`, `PaymentModal` | Local + server | `SaleForm` | `PaymentModal` | F2 (Save), F3 (Search), ESC (Cancel) |
| 3 | Artigos e Stock | 5e21e469 | `/articles` | `ArticlesPage` | `ArticleTable`, `FilterBar`, `SearchInput`, `StatusChips` | Server state | None | `ArticleFilterModal` | Ctrl+F (Search) |
| 4 | Entrada de Stock | 27c382d1 | `/stock/in` | `StockInPage` | `ArticleSelect`, `QuantityInput`, `ReasonSelect` | Local + server | `StockMoveForm` | None | F2 (Save) |
| 5 | Saída de Stock | 9022f703 | `/stock/out` | `StockOutPage` | `ArticleSelect`, `QuantityInput`, `ReasonSelect` | Local + server | `StockMoveForm` | None | F2 (Save) |
| 6 | Extrato de Movimentos | 559f5ad3 | `/stock/statement` | `StockStatementPage` | `MovementTable`, `DateRangePicker` | Server state | None | None | None |
| 7 | Lista de Fornecedores | dd9e33c8 | `/suppliers` | `SuppliersPage` | `SupplierTable`, `FilterBar` | Server state | None | None | Ctrl+F (Search) |
| 8 | Novo ou Editar Fornecedor | bb89dda9 | `/suppliers/[id]` | `SupplierEditPage` | `ContactInfo`, `AddressFields`, `BankDetails` | Local + server | `SupplierForm` | `ConfirmDeleteModal` | F2 (Save) |
| 9 | Guia de Remessa a Cliente | 7963d61f | `/sales/delivery` | `DeliveryNotePage` | `CustomerSelect`, `LineItemTable` | Local + server | `DocumentForm` | None | F2 (Save) |
| 10 | Factura a Cliente | 7aa10be2 | `/sales/invoice` | `InvoicePage` | `CustomerSelect`, `LineItemTable`, `TotalsPanel` | Local + server | `DocumentForm` | `ConfirmModal` | F2 (Save) |
| 11 | Nota de Crédito a Cliente | 9952ebea | `/sales/credit` | `CreditNotePage` | `CustomerSelect`, `InvoiceSelect`, `LineItemTable` | Local + server | `DocumentForm` | None | F2 (Save) |
| 12 | Nota de Débito a Cliente | d6a2ae8c | `/sales/debit` | `DebitNotePage` | `CustomerSelect`, `LineItemTable` | Local + server | `DocumentForm` | None | F2 (Save) |
| 13 | Guia de Remessa de Fornecedor | c4af07ee | `/purchases/delivery` | `SupplierDeliveryPage`| `SupplierSelect`, `LineItemTable` | Local + server | `DocumentForm` | None | F2 (Save) |
| 14 | Registo de Factura de Fornecedor| 659276c9 | `/purchases/invoice` | `PurchaseInvoicePage` | `SupplierSelect`, `LineItemTable`, `TotalsPanel` | Local + server | `DocumentForm` | None | F2 (Save) |
| 15 | Aviso de Lançamento a Débito | ef3e9b64 | `/purchases/debit` | `PurchaseDebitPage` | `SupplierSelect`, `LineItemTable` | Local + server | `DocumentForm` | None | F2 (Save) |
| 16 | Aviso de Lançamento a Crédito | 50aa77e7 | `/purchases/credit` | `PurchaseCreditPage` | `SupplierSelect`, `LineItemTable` | Local + server | `DocumentForm` | None | F2 (Save) |
| 17 | Pagamento a Fornecedor | ae5e4b93 | `/payments/out` | `SupplierPaymentPage` | `SupplierSelect`, `InvoiceList`, `PaymentMethod` | Local + server | `PaymentForm` | `AllocationModal` | F2 (Save) |
| 18 | Conta Corrente de Fornecedor | 7cbfa969 | `/suppliers/[id]/account` | `SupplierAccountPage` | `LedgerTable`, `DateRangePicker` | Server state | None | None | None |
| 19 | Conta Corrente de Cliente | c5128405 | `/customers/[id]/account` | `CustomerAccountPage` | `LedgerTable`, `DateRangePicker` | Server state | None | None | None |
| 20 | Recebimento de Cliente | e55e7636 | `/payments/in` | `CustomerReceiptPage` | `CustomerSelect`, `InvoiceList`, `PaymentMethod` | Local + server | `ReceiptForm` | `AllocationModal` | F2 (Save) |
| 21 | Distribuição de Pagamento Parcial| 3c2a4712 | `/payments/allocation`| `PaymentAllocationPage`| `PaymentInfo`, `AllocationTable` | Local + server | `AllocationForm`| None | F2 (Save) |
| 22 | Recibo de Pagamento | f819ec0e | `/payments/receipt` | `ReceiptPrintPage` | `ReceiptPreview`, `PrintActions` | Server state | None | None | Ctrl+P (Print) |
| 23 | Pesquisa de Documentos | 958f05fe | `/documents/search` | `DocumentSearchPage` | `SearchForm`, `DocumentTable` | Server state | `SearchForm` | None | Ctrl+F (Search) |
| 24 | Relatório de Stock | 08a6bc73 | `/reports/stock` | `StockReportPage` | `ReportFilters`, `ReportDataGrid` | Server state | `FilterForm` | None | Ctrl+P (Print) |
| 25 | Relatório de Vendas | 5310ba4b | `/reports/sales` | `SalesReportPage` | `ReportFilters`, `ReportChart`, `ReportTable` | Server state | `FilterForm` | None | Ctrl+P (Print) |
| 26 | Contas a Receber e Pagar | b488c8ab | `/reports/financials` | `FinancialsReportPage`| `ReportFilters`, `AccountsTable` | Server state | `FilterForm` | None | Ctrl+P (Print) |
| 27 | Utilizadores | da0b1af3 | `/settings/users` | `UsersPage` | `UserTable`, `RoleSelect` | Server state | None | `UserEditModal` | None |
| 28 | Perfis e Permissões | 171d010c | `/settings/roles` | `RolesPage` | `RoleList`, `PermissionGrid` | Local + server | `RoleForm` | None | F2 (Save) |
| 29 | Tabelas e Configurações | c9f0f224 | `/settings/general` | `SettingsPage` | `TaxRates`, `DocSequences`, `PaymentMethods` | Local + server | `SettingsForm`| None | F2 (Save) |
| 30 | Auditoria, Backup e Migração | eb733c60 | `/settings/audit` | `AuditPage` | `AuditLogTable`, `BackupControls`, `MigrateTool` | Server state | None | `ConfirmModal` | None |
| 31 | Criar ou Editar Artigo | N/A | `/articles/[id]` | `ArticleEditPage` | `BasicInfo`, `Pricing`, `StockLevels` | Local + server | `ArticleForm` | None | F2 (Save) |
| 32 | Lista de Clientes | N/A | `/customers` | `CustomersPage` | `CustomerTable`, `FilterBar` | Server state | None | None | Ctrl+F (Search) |
| 33 | Criar ou Editar Cliente | N/A | `/customers/[id]` | `CustomerEditPage` | `ContactInfo`, `AddressFields`, `Financials` | Local + server | `CustomerForm`| None | F2 (Save) |
| 34 | Detalhes Cliente | N/A | `/customers/[id]/view`| `CustomerViewPage` | `CustomerCard`, `RecentSales`, `CreditStatus` | Server state | None | None | None |
| 35 | Guia de Remessa Fornecedor | N/A | `/purchases/delivery` | `SupplierDeliveryPage`| `SupplierSelect`, `LineItemTable` | Local + server | `DocumentForm` | None | F2 (Save) |
