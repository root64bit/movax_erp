# Product Requirements Document: Casa de Pneus System

## 1. Global System Specifications
*   **Localization:** 
    *   Language: Portuguese (MZ)
    *   Currency: MZN (Metical). All currency fields must use precise `NUMERIC` types, stored to 2 decimal places.
    *   Date Format: DD/MM/YYYY
    *   Timezone: Africa/Maputo
*   **Platform Support:**
    *   Web-based application accessible via modern browsers (Chrome, Edge, Firefox, Safari).
    *   Progressive Web App (PWA) support for easy desktop installation and caching.
    *   Responsive, but optimized for desktop monitors (min 1024x768).

## 2. User Interface & Accessibility
*   **Design System:** "Sistema de Gestão Operacional"
*   **Layout:** 240px fixed left sidebar, 4px baseline grid, Inter font.
*   **Colors:** Primary `#003366`, Secondary/Success `#006e25` / `#28A745`, Error `#ba1a1a` / `#DC3545`.
*   **Keyboard-First Navigation:** 
    *   **F1:** Pesquisa / Search
    *   **F2:** Guardar / Save
    *   **F3:** Alterar / Edit
    *   **F4:** Consultar / View
    *   **F9:** Imprimir / Print
    *   **ESC:** Sair / Cancel
    *   Tab indexing must follow logical visual order.
*   **Accessibility:** High contrast modes, clear focus states for form fields.

## 3. User Roles (RBAC)
1.  **Administrator:** Full access to all modules, settings, user management, and destructive actions.
2.  **Manager (Gerente):** Can view everything, edit configurations, approve credit notes, and view all financial reports.
3.  **Stock Operator:** Access to Articles, Entradas, Saídas, and Stock Reports. No access to financial/pricing data.
4.  **Sales Operator:** Can create Guias de Remessa and Facturas. Cannot alter historical documents.
5.  **Cashier (Caixa):** Can process Receipts (Recebimentos) and view Customer Current Accounts.
6.  **Purchasing Operator:** Can create Supplier Guias and Invoices.
7.  **Accounting Operator:** Access to financial reports, Current Accounts, and Payments.
8.  **Read-Only:** View access based on assigned module.

## 4. Functional Requirements by Module

### 4.1 Articles (Artigos)
*   **FR-ART-01:** Create, read, update, delete (soft delete) articles.
*   **FR-ART-02:** Fields: Reference, Name, Description, Category, Tax/IVA rate, Retail Price, Cost Price, Minimum Stock, Barcode.
*   **Acceptance Criteria:** Fast barcode lookup works. Duplicate references are rejected.

### 4.2 Stock (Inventory)
*   **FR-STK-01:** Process manual stock adjustments via Entrada (Entry) and Saída (Exit) documents.
*   **FR-STK-02:** Maintain real-time stock balances per warehouse.
*   **FR-STK-03:** Prevent negative stock optionally based on global settings.
*   **Acceptance Criteria:** Moving 5 units out decreases stock by exactly 5. Concurrent updates are handled safely.

### 4.3 Customers & Suppliers (Entities)
*   **FR-ENT-01:** Manage Customer and Supplier records.
*   **FR-ENT-02:** Fields: Name, NUIT (Tax Number), Address, Contact Details, Credit Limit, Payment Terms.
*   **Acceptance Criteria:** NUIT is validated for formatting.

### 4.4 Sales (Commercial Documents)
*   **FR-SAL-01:** Create Guia de Remessa a Cliente (Delivery Note), reducing physical stock but not altering financials.
*   **FR-SAL-02:** Create Factura a Cliente (Invoice), updating financials (Current Account) and stock (if not linked to a Guia).
*   **FR-SAL-03:** Support Nota de Crédito (Credit Note) and Nota de Débito (Debit Note).
*   **FR-SAL-04:** Convert a Guia to a Factura automatically pulling lines.
*   **Acceptance Criteria:** Documents are immutable once finalized (State = Closed). Invoice numbering is strictly sequential.

### 4.5 Purchases (Procurement Documents)
*   **FR-PUR-01:** Record Guia de Remessa de Fornecedor (Supplier Delivery Note), increasing stock.
*   **FR-PUR-02:** Record Factura de Fornecedor (Supplier Invoice).
*   **Acceptance Criteria:** Similar rules to sales, but interacting with Supplier Accounts.

### 4.6 Payments & Current Accounts
*   **FR-FIN-01:** Manage Conta Corrente (Current Account) for Customers and Suppliers.
*   **FR-FIN-02:** Process partial and full payments against open invoices.
*   **FR-FIN-03:** Generate Recibo de Pagamento (Payment Receipt).
*   **Acceptance Criteria:** Payment cannot exceed the open balance of an invoice. Customer balance strictly reflects the sum of open invoices minus unallocated receipts.

### 4.7 Reports & Dashboards
*   **FR-REP-01:** Relatório de Stock (Stock levels, valuation).
*   **FR-REP-02:** Relatório de Vendas (Sales by date, by user, by article).
*   **FR-REP-03:** Contas a Receber e Pagar (Accounts Receivable/Payable aging).
*   **Acceptance Criteria:** Reports exportable to PDF and Excel/CSV.

## 5. Non-Functional Requirements
*   **Performance:** Lookup by barcode or Reference must resolve in < 200ms. Lists must support pagination and load in < 500ms.
*   **Reliability:** Document creation and stock deduction must happen within a transactional boundary (all or nothing). 
*   **Resilience:** System must fail gracefully if network is temporarily lost (though full offline mode is out of scope for Phase 1).
*   **Scalability:** Must support up to 50 concurrent users without degradation. Database should easily handle millions of document line rows via PostgreSQL.
*   **Auditability:** Every create, update, or soft-delete action must be logged with a timestamp and User UUID.
