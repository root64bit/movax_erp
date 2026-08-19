# Production Migration Runbook

> **Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  
> **Purpose:** Standard Operating Procedure for Deploying Supabase Database Migrations  

---

## Pre-Deployment Verification Checklist

- [ ] Git working directory is clean (`git status`)
- [ ] New migration file created under `supabase/migrations/YYYYMMDDHHMMSS_name.sql`
- [ ] Rollback script created under `supabase/rollbacks/YYYYMMDDHHMMSS_name_undo.sql`
- [ ] Local stack test passed (`supabase db reset` locally)
- [ ] Pre-deployment database dump created (`05-pre-deployment-backup-report.md`)

---

## Deployment Execution Steps

```bash
# Step 1: Link local CLI to target project (if not linked)
supabase link --project-ref bkbcgndzsfylwsinxwbb

# Step 2: Run pre-flight dry run
supabase db push --dry-run

# Step 3: Inspect migration diff output
# Verify ONLY intended migration files are listed

# Step 4: Execute production push
supabase db push

# Step 5: Verify post-migration state
# Run automated schema and RLS verification tests
```

---

## Post-Deployment Logging

After every deployment, write an evidence report to:
`docs/implementation/production/deployments/DEPLOYMENT-YYYY-MM-DD-NN.md`

Must include:
- Migration filenames applied
- Git commit SHA
- Pre-deployment backup reference
- Dry-run output summary
- Execution status
- Post-deployment test results
