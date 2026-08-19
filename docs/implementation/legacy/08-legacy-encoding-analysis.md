# Legacy Character Encoding & Data Format Analysis — PROD-WP10

> **System Name:** XT-POS  

---

## 1. Character Set & Encoding Rules

- **Source Code Page:** CP1252 (Windows Western European) / CP850 (DOS OEM)
- **Special Characters:** Portuguese diacritics (`ç`, `ã`, `é`, `ó`, `ê`, `º`, `ª`) converted to standard UTF-8 upon extraction.
- **Date Handling:** Source dates stored as string `YYYYMMDD` converted to ISO-8601 `YYYY-MM-DD`.
- **Numeric Handling:** Standard fixed-point IEEE 754 converted to PostgreSQL `NUMERIC(18,2)` or `NUMERIC(18,6)`.
