# Production Database Disaster Recovery & Restore Procedure

> **Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  
> **Classification:** Disaster Recovery / Emergency Operating Procedure  

---

## 1. Trigger Conditions for Restore Procedure

A database rollback/restore procedure is initiated ONLY if:
1. A production migration fails halfway leaving the database in an inconsistent state.
2. Unrecoverable data corruption occurs during a legacy batch import.
3. System security is breached during pre-live testing.

---

## 2. Step-by-Step Restoration Protocol

### Step 1: Immediately Switch System to MAINTENANCE Mode
```sql
UPDATE public.system_settings 
SET setting_value = 'MAINTENANCE' 
WHERE setting_key = 'SYSTEM_MODE';
```

### Step 2: Verify Backup File Integrity
Verify the checksum of the backup file against its recorded SHA-256 hash:
```powershell
certutil -hashfile backups/pre_deploy_backup.sql SHA256
```

### Step 3: Execute Controlled SQL Restoration
Apply the SQL backup via psql or Supabase CLI:
```bash
supabase db push --file backups/pre_deploy_backup.sql
```

### Step 4: Verify Database Object Counts
Verify row counts, table definitions, and constraints against the pre-deployment baseline report.

### Step 5: Resume Operations in MIGRATION / PILOT Mode
Restore mode to `MIGRATION` once schema integrity is re-established.
