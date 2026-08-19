# Static-data automated scan results

`npm run audit:static-data` passes. The scanner blocks mock imports, production mock switches, fabricated identifiers, initial operational collections, embedded credentials, hardcoded application UUIDs, example emails, and obsolete Supabase projects. It runs in the CI quality workflow.
