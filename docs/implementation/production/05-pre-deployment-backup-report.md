# Pre-Deployment Backup Gate & Disaster Recovery Plan

> **Target Project Ref:** `bkbcgndzsfylwsinxwbb`  
> **Date:** 2026-07-28  

---

## 1. Backup Protocol & Verification

Before applying any production migration batch, the following backup verification steps must be completed:

1. **Daily Automated Backups:** Verify Supabase project daily backup schedule is active.
2. **Pre-Migration Baseline Dump:** Generate a full schema and data dump of the target database prior to running new migrations:
   ```bash
   supabase db dump --linked --schema public,private,migration,audit -f backups/pre_deploy_backup.sql
   ```
3. **Checksum Generation:** Generate SHA-256 checksums for backup files and store them in secure storage:
   ```bash
   certutil -hashfile backups/pre_deploy_backup.sql SHA256 > backups/pre_deploy_backup.sql.sha256
   ```
4. **Storage Isolation:** Backups are stored in encrypted private offline storage outside the public git repository.

---

## 2. Storage Objects Backup Procedure

Database dumps do NOT include Supabase Storage objects. If storage objects exist:
1. Sync storage buckets using Supabase CLI / S3 API:
   ```bash
   aws s3 sync s3://bkbcgndzsfylwsinxwbb-storage backups/storage_backup/
   ```
2. Verify file counts and total byte sizes.
