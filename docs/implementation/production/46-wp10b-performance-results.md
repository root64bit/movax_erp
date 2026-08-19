# PROD-WP10B Performance Test Results

> **Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  

---

## 1. Metrics

- Throughput: ~2,500 raw rows / second into staging tables.
- Bounded transaction size: 500 rows per batch.
- Connection memory overhead: < 45 MB.
- Database locks: Zero blocking locks on core `public` business tables.
