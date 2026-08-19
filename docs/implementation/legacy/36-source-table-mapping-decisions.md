# Source Table Mapping Decisions — PROD-WP10B

> **System:** XT-POS  

---

## 1. Key Mapping Decisions

- `ARTIGOS.DBF` mapped to `migration.products_raw`.
- `CLIENTES.DBF` mapped to `migration.customers_raw`.
- `FORNEC.DBF` mapped to `migration.suppliers_raw`.
- `FATURAS.DBF` mapped to `migration.documents_raw`.
- `RECIBOS.DBF` mapped to `migration.payments_raw`.
- All legacy keys preserved intact in `legacy_*` staging columns.
