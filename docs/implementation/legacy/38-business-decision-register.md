# Business Decision Register — PROD-WP10C

> **System:** XT-POS  

---

## 1. Approved Decision Policies

| Anomaly Type | Decision | Reason / Policy |
|--------------|----------|-----------------|
| Duplicate Article Barcodes | `NORMALISE` | Retain primary code; flag duplicate barcode in audit log |
| Missing Customer NUIT | `MIGRATE_AS_IS` | Allow null tax number for retail cash customers |
| Historical Rounding Variances | `NORMALISE` | Reconcile to 0.00 MZN tolerance; preserve original header |
| Unapplied Legacy Receipts | `MIGRATE_AS_IS` | Preserve as unapplied customer credit balance |
