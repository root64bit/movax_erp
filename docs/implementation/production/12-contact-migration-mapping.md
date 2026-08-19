# Legacy Contact Migration Mapping & Staging Architecture

> **Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  
> **Source System:** XT-POS (`CLIENTES.DBF` & `FORNEC.DBF`)  

---

## 1. Staging Tables (`migration` Schema)

- `migration.customers_raw`: Holds raw legacy customer extracts, validation errors, and transformation status.
- `migration.suppliers_raw`: Holds raw legacy supplier extracts, validation errors, and transformation status.

---

## 2. Field Mapping Matrix

| XT-POS Legacy Field | Production Target Field | Transformation / Validation Rule |
|---------------------|-------------------------|-----------------------------------|
| `CODIGO` / `NUMERO` | `customer_number` / `supplier_number` | Preserved, trimmed, required. |
| `NOME` / `RAZAO_SOC` | `name` | Preserved, required. |
| `MORADA` / `ENDERECO` | `address_line_1` | Creates primary `GENERAL` address entry in `*_addresses`. |
| `CP` / `COD_POSTAL` | `postal_code` | Mapped to `postal_code`. |
| `TELEFONE` | `telephone` | Mapped to `telephone`. |
| `EMAIL` | `email` | Mapped to `email`. |
| `NUIT` / `NIF` | `tax_number` | Mapped to `tax_number`. |
| `CON_PAG` | `payment_term_id` | Mapped to `payment_terms.code` (`DINHEIRO`, `30_DIAS`, etc.). |
| `LIM_CRED` | `credit_limit` | Parsed to NUMERIC(18,2). Defaults to 0.00. |
| `SALDO_INIC` / `SALDO` | `opening_balance`, `current_balance` | Initialized via protected opening balance RPCs. |

---

## 3. Transformation RPCs

- `migration.process_customer_migration_batch(p_batch_id UUID)`
- `migration.process_supplier_migration_batch(p_batch_id UUID)`
