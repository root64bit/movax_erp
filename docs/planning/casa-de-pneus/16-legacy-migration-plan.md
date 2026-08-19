# Legacy Migration Plan

## 1. Migration Strategy Overview
The migration from XT-POS PRO v3.50 to the new Casa de Pneus system will follow a structured 7-phase approach to ensure data integrity, security, and minimal downtime.

## 2. The 7-Phase Migration Process

### Phase 1: Discovery
- Locate physical database files and executables on the Windows XP machine.
- Identify the database engine and map legacy tables to the target schema.
- Extract sample data to identify encoding, formats, and anomalies.

### Phase 2: Preservation
- **Full Disk Image**: Clone the hard drive of the XP machine to prevent catastrophic data loss due to aging hardware.
- **Backups**: Take a final, complete application backup using native XT-POS tools.
- **File Hashes**: Generate checksums (SHA-256) of the database files to guarantee the copies have not been altered.
- **Read-only Archive**: Store the preserved data in a secure, read-only location.

### Phase 3: Raw Extraction
- Export the legacy database tables into standard CSV format.
- Import these raw CSV files directly into staging tables in a temporary PostgreSQL database or a specific `legacy_*_raw` schema within Supabase. 
- Do not perform transformations in this phase; maintain exactly the original data types and encoding (as string fields if necessary).

### Phase 4: Transformation
- Execute SQL scripts or specialized migration scripts (e.g., Python/Node.js) to transform the raw data:
  - **Field Mapping**: Map legacy columns to the target schema columns.
  - **Type Conversion**: Convert strings to numeric/timestamps/booleans.
  - **Encoding Fix**: Convert `CP1252`/`ISO-8859-1` text to `UTF-8`.
  - **Date Correction**: Fix invalid dates (e.g., 00/00/0000) and convert to `TIMESTAMPTZ`.
  - **VAT Mapping**: Map legacy VAT codes to the standard Mozambique 16% VAT rate (or exempt codes).
  - **Duplicate Handling**: Merge duplicate records for customers, articles, etc.
  - **Opening Balance Creation**: Calculate the final stock and current account balances to set as opening balances in the new system.

### Phase 5: Reconciliation
- Perform automated queries to compare legacy raw data against transformed data.
- **Count Comparisons**: Number of customers, articles, invoices.
- **Balance Comparisons**: Total customer debts, total supplier credits.
- **Total Checks**: Total stock quantities and valuation.

### Phase 6: Test Migration (Dry Runs)
- Perform a complete end-to-end migration run using a recent snapshot.
- Generate an error report detailing records that failed validation.
- Provide the transformed data to key users to test in a staging environment.
- Repeat the transformation and reconciliation steps until the error rate is negligible and users sign off.

### Phase 7: Final Migration (Cutover)
- **Cutoff**: Halt operations on the old XT-POS system (typically over a weekend).
- **Final Backup**: Extract the absolute latest state.
- **Delta Import**: Import the delta or run the full migration one last time.
- **Reconcile**: Perform final reconciliation checks.
- **Approve & Activate**: Stakeholder sign-off. Activate the new Casa de Pneus system for live operations.

## 3. Technical Implementation Details

### Migration Batch Management
- Implement a script that processes the migration in batches (e.g., 1000 records at a time) to avoid memory overload and transaction timeouts during Phase 4.

### Idempotent Imports
- The migration scripts must be idempotent. Running the script multiple times should not create duplicate entries in the target database. 
- Achieved by using `ON CONFLICT (legacy_id) DO UPDATE` or checking for existence before inserting.

### Rollback Support
- Each major transformation step should be wrapped in a database transaction.
- If a critical error occurs, the transaction is rolled back, leaving the target tables untouched.

### Error Classification
- **Blocking**: Corrupted primary keys, missing foreign key references (e.g., invoice line with no invoice header). Fails the batch or record.
- **Warning**: Missing non-critical fields (e.g., customer missing a phone number). Record imported, warning logged.
- **Info**: Data normalization actions (e.g., trimming whitespace).

### Legacy-ID Traceability
- Every target table (articles, customers, documents, etc.) will contain a `legacy_id` column (String or Int).
- This is vital for Phase 5 reconciliation and tracing back specific records to the old system.

### Hash-based Duplicate Detection
- For entities like customers, generate a hash of normalized fields (e.g., `LOWER(TRIM(name)) + NUIT`).
- Use this hash to identify potential duplicates during Phase 4 and automatically flag them for manual review or automated merging.
