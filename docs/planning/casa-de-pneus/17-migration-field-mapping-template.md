# Migration Field Mapping Templates

This document provides templates for mapping fields from the legacy XT-POS PRO v3.50 system to the new Casa de Pneus PostgreSQL schema.

*Action Types: `direct_copy`, `transform`, `derive`, `default`, `skip`*

## 1. Products / Articles (Target Table: `articles`)

| Legacy Field | Target Field | Action | Transformation / Validation | Default | Notes |
|---|---|---|---|---|---|
| `ART_ID` | `legacy_id` | direct_copy | Convert to string | - | Unique identifier |
| `DESCRICAO` | `name` | transform | CP1252 to UTF-8, TRIM() | 'Unknown Article' | - |
| `COD_BARRAS` | `barcode` | direct_copy | Validate length and characters | NULL | - |
| `PRECO_CUSTO`| `cost_price` | transform | String/Float to NUMERIC | 0.00 | - |
| `PRECO_VENDA`| `selling_price` | transform | String/Float to NUMERIC | 0.00 | Includes VAT? verify. |
| `IVA_TAXA` | `tax_percentage` | transform | Map to standard 16% or 0% | 16.00 | - |
| `FAMILIA` | `category_id` | derive | Lookup/Create in categories table | Default Category | - |
| `ACTIVO` | `is_active` | transform | 'S'/'N' or 1/0 to Boolean | TRUE | - |

## 2. Customers (Target Table: `customers`)

| Legacy Field | Target Field | Action | Transformation / Validation | Default | Notes |
|---|---|---|---|---|---|
| `CLI_ID` | `legacy_id` | direct_copy | Convert to string | - | - |
| `NOME` | `name` | transform | CP1252 to UTF-8, TRIM() | 'Cliente Desconhecido' | - |
| `NUIT` | `tax_id` | direct_copy | Strip non-numeric characters | NULL | Must be 9 digits if present |
| `MORADA` | `address` | transform | CP1252 to UTF-8 | NULL | - |
| `TELEFONE` | `phone` | transform | Standardize format (e.g., +258) | NULL | - |
| `EMAIL` | `email` | direct_copy | Regex validation | NULL | - |
| `LIM_CRED` | `credit_limit` | transform | Convert to NUMERIC | 0.00 | - |

## 3. Suppliers (Target Table: `suppliers`)

| Legacy Field | Target Field | Action | Transformation / Validation | Default | Notes |
|---|---|---|---|---|---|
| `FORN_ID` | `legacy_id` | direct_copy | Convert to string | - | - |
| `NOME` | `name` | transform | CP1252 to UTF-8, TRIM() | 'Fornecedor Desconhecido'| - |
| `NUIT` | `tax_id` | direct_copy | Strip non-numeric characters | NULL | - |
| `TELEFONE` | `phone` | transform | Standardize format | NULL | - |

## 4. Documents (Target Table: `documents`)

| Legacy Field | Target Field | Action | Transformation / Validation | Default | Notes |
|---|---|---|---|---|---|
| `DOC_ID` | `legacy_id` | direct_copy | Convert to string | - | - |
| `TIPO_DOC` | `type` | transform | Map (e.g., 'FT' -> 'invoice') | - | - |
| `NUM_DOC` | `document_number` | transform | Combine with series if separated | - | e.g. "FT A/001" |
| `DATA_DOC` | `issue_date` | transform | Parse string to TIMESTAMPTZ | - | Requires valid date |
| `CLI_ID` | `customer_id` | derive | Lookup target UUID by legacy_id | - | Requires Customers imported first |
| `TOTAL` | `total_amount` | transform | Convert to NUMERIC | 0.00 | Validate against sum of lines |
| `ESTADO` | `status` | transform | Map ('N'->draft, 'F'->confirmed) | 'draft' | - |

## 5. Document Lines (Target Table: `document_lines`)

| Legacy Field | Target Field | Action | Transformation / Validation | Default | Notes |
|---|---|---|---|---|---|
| `LINHA_ID` | `legacy_id` | direct_copy | Convert to string | - | - |
| `DOC_ID` | `document_id` | derive | Lookup target UUID by legacy_id | - | Must exist |
| `ART_ID` | `article_id` | derive | Lookup target UUID by legacy_id | - | Must exist |
| `QTD` | `quantity` | transform | Convert to NUMERIC | 0.00 | - |
| `PRECO_UNIT` | `unit_price` | transform | Convert to NUMERIC | 0.00 | - |
| `DESCONTO` | `discount_perc` | transform | Convert to NUMERIC | 0.00 | - |

## 6. Stock Movements (Target Table: `stock_movements`)

| Legacy Field | Target Field | Action | Transformation / Validation | Default | Notes |
|---|---|---|---|---|---|
| `MOV_ID` | `legacy_id` | direct_copy | Convert to string | - | - |
| `ART_ID` | `article_id` | derive | Lookup target UUID | - | - |
| `TIPO` | `movement_type` | transform | Map ('E'->'in', 'S'->'out') | - | - |
| `QTD` | `quantity` | transform | Convert to NUMERIC | - | - |
| `DATA_MOV` | `movement_date` | transform | Parse to TIMESTAMPTZ | - | - |

## 7. Payments (Target Table: `payments`)

| Legacy Field | Target Field | Action | Transformation / Validation | Default | Notes |
|---|---|---|---|---|---|
| `PAG_ID` | `legacy_id` | direct_copy | Convert to string | - | - |
| `CLI_ID` | `customer_id` | derive | Lookup target UUID | - | - |
| `VALOR` | `amount` | transform | Convert to NUMERIC | - | - |
| `METODO` | `payment_method` | transform | Map (e.g., 'NU'->'cash', 'TB'->'transfer')| 'cash' | - |
| `DATA_PAG` | `payment_date` | transform | Parse to TIMESTAMPTZ | - | - |

## 8. Current Account Balances (Target Table: Opening Balances)
*Note: Depending on data quality, we may not import all historical documents. Instead, we compute the final balance per customer/supplier in XT-POS and create a single "Opening Balance" document in the new system.*

| Legacy Field | Target Field | Action | Transformation / Validation | Default | Notes |
|---|---|---|---|---|---|
| `CLI_ID` | `customer_id` | derive | Lookup target UUID | - | - |
| `SALDO_FINAL`| `amount` | transform | Convert to NUMERIC | 0.00 | Create Opening Balance Doc |
