# Production Cutover & Activation Checklist

> **Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  
> **Target System Mode Transition:** `MIGRATION` / `PILOT` → `LIVE`  

---

## 1. Pre-Cutover Verification Gates

- [ ] All 13 Work Packages (PROD-WP01 through PROD-WP12) deployed and verified.
- [ ] All legacy XT-POS data imported into `migration.*` staging and transformed.
- [ ] 100% Reconciliation Gate Pass:
  - [ ] Article count & stock balances match legacy within tolerance (0.000 variance).
  - [ ] Customer & supplier account balances match legacy.
  - [ ] Historical document totals & payment allocations match legacy.
- [ ] Security Gate Pass:
  - [ ] 0 public tables with RLS disabled.
  - [ ] 0 SECURITY DEFINER views.
  - [ ] Cost-price masking verified for non-authorized roles.
- [ ] Pre-live backup completed and verified.

---

## 2. Cutover Execution Protocol

1. **Freeze Legacy XT-POS:** Freeze write operations in legacy XT-POS system.
2. **Final Delta Import:** Run final delta migration batch for any end-of-day transactions.
3. **Run Final Reconciliation:** Execute full reconciliation views.
4. **Obtain Formal Business Approval:** Present reconciliation report to Casa de Pneus management.
5. **Activate LIVE Mode:** Execute system mode update:
   ```sql
   UPDATE public.system_settings 
   SET setting_value = 'LIVE' 
   WHERE setting_key = 'SYSTEM_MODE';
   ```
6. **Archive Legacy System:** Set legacy XT-POS system to READ-ONLY reference mode.
