# Reporting Architecture

## 1. Overview
The Casa de Pneus system requires robust, accurate, and performant reporting capabilities to manage operations, stock, and finances. Reports will be integrated into the Next.js frontend using Stitch UI components, powered by the Supabase PostgreSQL database.

## 2. Report Categories and Data Sources

### Real-Time Reports
*Data source: Direct queries to operational tables, un-cached.*
- Current Stock Levels
- Article Search & Availability
- Document Lookup & Status

### End-of-Day Reports
*Data source: Operational tables, aggregated by date.*
- Daily Cash Report (Fecho de Caixa)
- Daily Sales Summary
- Daily Stock Movements

### Historical & Analytical Reports
*Data source: Materialized views or aggregated queries.*
- Sales by Period (Month/Year)
- Purchases by Supplier
- Margin & Profitability Analysis
- Customer / Supplier Account Extracts

## 3. Implementation Approach
- **Direct SQL Queries**: For real-time and end-of-day reports, we will use direct parameterized queries via Supabase RPC functions (plpgsql) to ensure performance and complex logic execution on the server side.
- **Database Views**: Frequently used aggregations (e.g., current stock per article, current balance per customer) will be implemented as standard PostgreSQL Views.
- **Materialized Views**: For heavy historical reporting (e.g., Monthly Sales Summaries across years), we will use Materialized Views that refresh on a schedule (e.g., nightly via a pg_cron task).

## 4. Cost-Price Masking in Reports
- **Requirement**: Only authorized roles (e.g., `Admin`, `Manager`) can view the `cost_price` and resulting profit margins. Cashiers (`Operator`) must not see this data.
- **Implementation**:
  - We will implement PostgreSQL Row Level Security (RLS) and Column-Level privileges where possible.
  - More practically, Supabase RPC functions returning report data will check the user's role `auth.jwt() ->> 'role'`.
  - If the user lacks the `view_cost` permission, the function will mask the `cost_price`, `total_cost`, and `margin` fields by returning `NULL` or `0`.

## 5. Export Formats
Reports must be exportable for external processing and compliance.
- **CSV**: Standard data export for Excel compatibility. Generated client-side or via a lightweight API route.
- **Excel (.xlsx)**: Formatted spreadsheets. Generated using a library like `exceljs` on a Next.js API route.
- **PDF**: For official reports and sharing. Generated via server-side rendering (e.g., using `puppeteer` or `pdfmake` on a Next.js backend/Edge Function) to ensure consistent layout and typography independent of the user's browser.

## 6. Print Support
- **Receipt Printing**: Thermal printers (80mm/58mm). Supported via specific CSS media queries (`@media print`) optimizing for narrow widths, hiding sidebars, and removing backgrounds.
- **Document Printing**: A4 printing for Invoices, Delivery Notes, Credit Notes. Handled by CSS print stylesheets or direct PDF generation.
- **Report Printing**: A4 landscape/portrait printing for data tables.

## 7. Specific Report Definitions (The 17 Reports)
*(Mapping to the specified requirements)*
1. **Extrato de Movimentos (Screen 6)**: Stock movements by article and date range.
2. **Guia de Remessa a Cliente (Screen 9)**: Delivery Note to customer.
3. **Factura a Cliente (Screen 10)**: Standard customer invoice.
4. **Nota de Crédito a Cliente (Screen 11)**: Credit note.
5. **Nota de Débito a Cliente (Screen 12)**: Debit note.
6. **Guia de Remessa de Fornecedor (Screen 13/18)**: Supplier delivery note.
7. **Registo de Factura de Fornecedor (Screen 14)**: Supplier invoice entry.
8. **Avisos a Débito/Crédito Fornecedor (Screen 15/16)**: Supplier financial adjustments.
9. **Pagamento a Fornecedor (Screen 17)**: Payment voucher.
10. **Conta Corrente de Fornecedor (Screen 18)**: Supplier current account statement.
11. **Conta Corrente de Cliente (Screen 19)**: Customer current account statement.
12. **Recebimento de Cliente (Screen 20)**: Customer receipt.
13. **Recibo de Pagamento (Screen 22)**: Official printed receipt.
14. **Relatório de Stock (Screen 24)**: Current inventory valuation and quantities.
15. **Relatório de Vendas (Screen 25)**: Sales aggregated by period, user, and article.
16. **Contas a Receber (Screen 26)**: Outstanding customer debts.
17. **Contas a Pagar (Screen 26)**: Outstanding supplier debts.
