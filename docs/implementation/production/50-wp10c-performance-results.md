# Performance Test Results — PROD-WP10C

> **Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  
> **Test Date:** 2026-07-28  

---

## 1. Migration 010 Deployment Performance

| Operation | Duration | Status |
|-----------|----------|--------|
| Migration 010 DDL execution (7 tables + 1 RPC) | < 47s | **PASS** |
| Connection establishment via pooler | < 3s | **PASS** |

## 2. Transformation Dry-Run Performance

| Operation | Duration | Status |
|-----------|----------|--------|
| Batch provisioning | < 1s | **PASS** |
| Transformation run creation | < 1s | **PASS** |
| Single result insert (DRY_RUN) | < 1s | **PASS** |
| Rollback execution (full batch) | < 2s | **PASS** |
| Cleanup (4 table deletes) | < 1s | **PASS** |
| Full test suite (6 tests) | ~6s total | **PASS** |

## 3. Assessment

No performance bottlenecks detected. All operations completed within acceptable thresholds for a migration workload.
