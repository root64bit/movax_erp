# Security Test Results — PROD-WP10C

> **Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  
> **Test Date:** 2026-07-28  

---

## 1. Credential Security

| Test | Result |
|------|--------|
| Old exposed password `casadepeneus` fails authentication | **PASS** |
| Old exposed password `CasaPeneus_Prod_2026_Key9872` fails authentication | **PASS** |
| Active `DATABASE_URL` authenticates successfully | **PASS** |
| `.env` is in `.gitignore` | **PASS** |
| No credentials in tracked files (`git grep`) | **PASS** |

## 2. Schema Isolation

| Test | Result |
|------|--------|
| `anon` role cannot SELECT from `migration.*` | **PASS** |
| `authenticated` role cannot SELECT from `migration.*` | **PASS** |
| `service_role` can SELECT from `migration.*` | **PASS** |
| `migration.rollback_batch()` is `SECURITY DEFINER` | **PASS** |

## 3. RLS Status

| Test | Result |
|------|--------|
| RLS enabled on all `public.*` business tables | **PASS** |
| Migration schema tables accessible only via `service_role` | **PASS** |
