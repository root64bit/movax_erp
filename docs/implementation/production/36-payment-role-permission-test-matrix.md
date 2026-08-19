# Payment Role Permission Matrix

> **Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  

---

## 1. Role Capabilities Matrix

| Role | View Payments | Customer Receipts | Supplier Payments | Auto Allocation | Reversal | Reprint Receipts |
|------|---------------|-------------------|-------------------|-----------------|----------|------------------|
| `ADMIN` | Yes | Yes | Yes | Yes | Yes | Yes |
| `MANAGER` | Yes | Yes | Yes | Yes | Yes | Yes |
| `CASHIER` | Customer Only | Yes | No | Customer Only | No | Yes |
| `SALES_OP` | Customer Only | No | No | No | No | No |
| `PURCHASING_OP` | Supplier Only | No | No | No | No | No |
| `STOCK_OP` | No | No | No | No | No | No |
| `READ_ONLY` | Yes (View) | No | No | No | No | No |
