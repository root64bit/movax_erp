# Transformation Rule Register — PROD-WP10C

> **System:** XT-POS  

---

## 1. Core Rules

- **CP1252 to UTF-8:** Applied to all text fields (`DESCR`, `NOME`, `MORADA`).
- **ISO-8601 Date Format:** Converted dBase dates (`YYYYMMDD`) to `YYYY-MM-DD`.
- **Decimal Precision:** Preserved exact numeric representation (`NUMERIC(18,2)` / `NUMERIC(18,6)`).
