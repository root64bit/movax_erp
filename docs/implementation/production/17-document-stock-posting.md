# Document Stock Posting Rules & Engine Integration

> **Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  

---

## 1. Stock Effect Rules Matrix

| Document Type | Default Stock Effect | Movement Type | Direct Balances Update |
|---------------|----------------------|---------------|------------------------|
| `CUSTOMER_DELIVERY_NOTE` | OUT | `sales_exit` | No (via `post_stock_movement`) |
| `CUSTOMER_INVOICE` | OUT (unless linked to Delivery Note) | `sales_exit` | No (via `post_stock_movement`) |
| `CASH_SALE` | OUT | `sales_exit` | No (via `post_stock_movement`) |
| `CUSTOMER_CREDIT_NOTE` | IN (if return enabled) | `customer_return` | No (via `post_stock_movement`) |
| `SUPPLIER_DELIVERY_NOTE` | IN | `purchase_entry` | No (via `post_stock_movement`) |
| `SUPPLIER_INVOICE` | IN (unless linked to Delivery Note) | `purchase_entry` | No (via `post_stock_movement`) |
| `SUPPLIER_RETURN` | OUT | `supplier_return` | No (via `post_stock_movement`) |
