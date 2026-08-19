# Customer & Supplier Reconciliation Gate Guidelines

> **Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  

---

## 1. Reconciliation Functions

- `migration.reconcile_customer_batch(p_batch_id UUID)`
- `migration.reconcile_supplier_batch(p_batch_id UUID)`

---

## 2. Mandatory Reconciliation Metrics

| Metric Name | Calculation Method | Tolerance | Gate Decision |
|-------------|--------------------|-----------|---------------|
| Total Customers Count | `prod_count - raw_count` | 0.00 | Variance = 0 → PASS |
| Total Customer Opening Balance | `prod_balance - raw_balance` | 0.01 MZN | Variance < 0.01 → PASS |
| Total Suppliers Count | `prod_count - raw_count` | 0.00 | Variance = 0 → PASS |
| Total Supplier Opening Balance | `prod_balance - raw_balance` | 0.01 MZN | Variance < 0.01 → PASS |

---

## 3. Synthetic Gate Test Execution Result

```text
=== CUSTOMER RECONCILIATION ===
Metric: Total Customers Count | Raw: 5.00 | Prod: 5.00 | Variance: 0.00 | Status: PASS
Metric: Total Customer Opening Balance | Raw: 515,000.00 MZN | Prod: 515,000.00 MZN | Variance: 0.00 | Status: PASS

=== SUPPLIER RECONCILIATION ===
Metric: Total Suppliers Count | Raw: 5.00 | Prod: 5.00 | Variance: 0.00 | Status: PASS
Metric: Total Supplier Opening Balance | Raw: 3,695,000.00 MZN | Prod: 3,695,000.00 MZN | Variance: 0.00 | Status: PASS
```
