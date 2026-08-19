# Legacy Table Inventory — PROD-WP10

> **System Name:** XT-POS  

---

## 1. Table Summary

| Table Name | Description | Key Fields | Target Supabase Entity |
|------------|-------------|------------|------------------------|
| `ARTIGOS.DBF` | Article catalog | `CODIGO`, `DESCR`, `PRECO` | `public.products` |
| `CLIENTES.DBF` | Customers master | `CODIGO`, `NOME`, `NUIT` | `public.customers` |
| `FORNEC.DBF` | Suppliers master | `CODIGO`, `NOME`, `NUIT` | `public.suppliers` |
| `STOCKS.DBF` | Stock movements & balances | `CODIGO`, `QTD` | `public.stock_movements` |
| `FATURAS.DBF` | Commercial document headers | `NUMERO`, `TIPO`, `DATA` | `public.documents` |
| `FATURAS_LINHAS.DBF` | Document line items | `NUMERO`, `CODART`, `QTD` | `public.document_lines` |
| `RECIBOS.DBF` | Payment receipts | `NUMERO`, `VALOR`, `DATA` | `public.payments` |
| `RECIBOS_ALOC.DBF` | Payment allocations | `NUMREC`, `NUMDOC`, `VALOR` | `public.payment_allocations` |
