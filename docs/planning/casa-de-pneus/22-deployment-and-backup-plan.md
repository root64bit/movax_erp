# Revised Deployment & Backup Plan (Production Pre-Live Mode)

> **Fixed Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  
> **Project Ref:** `bkbcgndzsfylwsinxwbb`  
> **Deployment Architecture:** Vercel (Frontend) + Supabase Production Pre-Live (Backend/DB/Auth)

---

## 1. Production Target & Pre-Live Operating Model

- **Fixed Target:** The hosted Supabase project `bkbcgndzsfylwsinxwbb` is the production target from Day 1.
- **Pre-Live Isolation:** The database defaults to system mode `MIGRATION`. Server-side guardrails prevent normal public access until formal cutover to `LIVE`.
- **Database Safety Controls:**
  - Zero un-versioned dashboard SQL execution.
  - Zero `supabase db reset --linked` (strictly prohibited).
  - Every migration validated locally on Docker before production push (`supabase db push`).
  - Pre-deployment dry runs (`supabase db push --dry-run`).

---

## 2. Backup Protocol & Disaster Recovery

- **Daily Supabase Backups:** Active on project `bkbcgndzsfylwsinxwbb`.
- **Pre-Migration Backups:** Schema and data snapshots generated before every production migration batch and stored offline with SHA-256 checksums.
- **Storage Backup:** Separate backup procedure for Supabase Storage buckets via CLI/S3 API.
- **Restore Protocol:** Documented in `docs/implementation/production/06-restore-procedure.md`.
