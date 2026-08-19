# Production Acceptance Criteria & Verification Gates

> **Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  

---

## 1. Safety & Production Infrastructure Gates (PROD-WP01)

- [x] Target project identity confirmed as clean, dedicated Supabase project `bkbcgndzsfylwsinxwbb`.
- [x] Baseline database audit completed with 0 pre-existing schema conflicts identified.
- [x] Deployment strategy, disaster recovery, pre-deployment backup protocols, and restoration runbook documented.
- [x] System activation modes (`MIGRATION`, `PILOT`, `LIVE`, `MAINTENANCE`) specified.

## 2. Core Schema & Security Gates (PROD-WP02 & PROD-WP03)

- [ ] 100% of public tables created with RLS enabled in the same migration file.
- [ ] Company, branch, and warehouse isolation enforced on every multi-tenant query.
- [ ] Cost-price masking verified for non-authorized roles (`products.view_cost`).
- [ ] No `SECURITY DEFINER` views in `public`.

## 3. Migration & Reconciliation Gates (PROD-WP06, PROD-WP07, PROD-WP10)

- [ ] Legacy imports executed strictly via isolated `migration.*_raw` staging tables.
- [ ] 100% match on article count, stock quantities, and stock valuation against legacy XT-POS.
- [ ] 100% match on customer and supplier current account balances.
- [ ] Zero duplicate document numbers or un-reconciled transactions.

## 4. Cutover & Activation Gate (PROD-WP13)

- [ ] Successful completion of PROD-WP12 Pilot testing with zero blocking defects.
- [ ] Formal sign-off on final reconciliation report.
- [ ] Successful server-side transition of system mode from `PILOT` to `LIVE`.
