# PROD-WP10C Pre-Transformation Audit

> Target project: `bkbcgndzsfylwsinxwbb`  
> Reverification time: 2026-07-28 18:16 SAST  
> Decision: **FAIL — STOP**

## Live read-only verification

The production database was queried in a read-only transaction using the active
`DATABASE_URL`. No database rows or objects were changed.

| Mandatory gate | Live result | Status |
|---|---:|---|
| System mode is `MIGRATION` | `MIGRATION` | PASS |
| Real raw migration batch exists and is ready | 3 batches; all remain `extracting` | FAIL |
| Batch raw totals are populated | All 3 batches report `total_records = 0` | FAIL |
| Required raw tables contain the extracted records | 0 rows across all 16 `migration.*_raw` tables | FAIL |
| Source-to-raw row counts reconcile | No raw rows and no `raw_import_results` | FAIL |
| No unexplained raw-record variance remains | Cannot be established | FAIL |
| Real transformation run exists | 0 `transformation_runs` | FAIL |
| Real transformation results exist | 0 `transformation_results` | FAIL |
| Reference mappings are approved | 0 unit, tax-code, and payment-method mappings | FAIL |
| Business decisions are approved | 0 database decision rows | FAIL |
| Reconciliation evidence exists | 0 `reconciliation_results` | FAIL |
| Migration history is consistent | `supabase_migrations.schema_migrations` contains 0 rows | FAIL |
| `.env` is not tracked | It was tracked at audit start | FAIL |

The three batch identifiers observed were:

- `7ac00386-da41-4e7d-9c96-ea59de1bbdf3`
- `311c2fbc-96fc-46e9-8181-37faa3195c6c`
- `9aeb79b6-f087-47ee-a1ce-67c6c037514f`

Each batch has four registered source rows, but registration alone is not raw
import evidence.

## Evidence discrepancy

Earlier repository reports claim 329,030 staged rows and a completed real
WP10C dry migration. The live database does not support those claims. The
existing WP10C test script creates one synthetic product transformation,
rolls it back, and deletes it; it does not transform the claimed legacy data.
Aggregate preview numbers without source-backed database results are not
acceptable migration evidence.

## Required remediation before WP10C

1. Identify the single approved real migration batch and resolve or retire the
   three incomplete batches through an approved, auditable process.
2. Import the preserved source extraction into the appropriate raw tables.
3. Populate batch totals and raw-import evidence from actual imported rows.
4. Reconcile source manifests, checksums, table counts, and raw rows.
5. Record all required business strategy and approval decisions.
6. Run real domain transformations and reconciliations in `DRY_RUN`.
7. Run an isolated, idempotent rollback rehearsal.
8. Establish authoritative migration history for the manually deployed schema.
9. Rotate any credentials that have appeared in Git history and verify old
   credentials are invalid.

WP10C transformation and WP10D APPLY are prohibited until every mandatory gate
passes. The system remains in `MIGRATION`.
