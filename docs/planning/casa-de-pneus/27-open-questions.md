# Open Questions & Business Decision Log

> **Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  

---

## Technical & Credentials Requirements

1. **Supabase CLI Access Credential:** For automated production migration pushes (`supabase db push`) to project `bkbcgndzsfylwsinxwbb`, should CI/CD use `SUPABASE_ACCESS_TOKEN` or direct database password (`SUPABASE_DB_PASSWORD`)?
2. **Legacy Database File Format:** When XT-POS data is exported for PROD-WP06 / PROD-WP10, will the source files be provided as DBF, Access MDB, Firebird FDB, or CSV/SQL dumps?

## Commercial & Operational Decisions

3. **Mozambique Fiscal IVA Rate:** Tax code defaults to standard 16% IVA. Are there exempt or zero-rated tire categories required for agricultural or commercial fleet customers?
4. **Document Series Prefix:** Default series prefix is `A` (e.g. `FT A/00001`). Does Casa de Pneus require multiple series per branch/warehouse?
5. **Pilot Group Roster:** Which specific staff members will participate in PROD-WP12 pilot testing before full LIVE cutover?
