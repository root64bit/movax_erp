# Commercial Document Role & Permission Matrix

> **Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  

---

## 1. Role Capabilities

| Role | View Docs | Create Sales | Confirm Sales | Create Purchases | Confirm Purchases | Cancel | Reverse | Cost Masking |
|------|-----------|--------------|---------------|------------------|-------------------|--------|---------|--------------|
| `ADMIN` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Full Cost Access |
| `MANAGER` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Full Cost Access |
| `SALES_OP` | Yes | Yes | Yes | No | No | Draft Only | No | Cost Hidden |
| `CASHIER` | Yes | Cash Sale Only | Cash Sale Only | No | No | No | No | Cost Hidden |
| `STOCK_OP` | Delivery Notes Only | Delivery Notes Only | Delivery Notes Only | Delivery Notes Only | Delivery Notes Only | No | No | Cost Hidden |
| `PURCHASING_OP` | Yes | No | No | Yes | Yes | Draft Only | No | Cost Visible |
| `ACCOUNTING_OP` | Yes | Financial Invoices | Financial Invoices | Financial Invoices | Financial Invoices | No | Reversal Permission | Cost Visible |
| `READ_ONLY` | Yes | No | No | No | No | No | No | Cost Hidden |
