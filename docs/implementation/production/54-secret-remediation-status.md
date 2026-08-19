# Secret Remediation Status

> Review date: 2026-07-28

## Completed locally

- `.env` removed from Git tracking while the local ignored file was preserved.
- `.env.example` contains placeholders only.
- Browser configuration no longer embeds a hard-coded project URL or key.
- `DATABASE_URL`, database passwords, service-role keys, and tokens are
  explicitly prohibited from `VITE_*` variables.
- The browser configuration now uses the Supabase publishable-key format.
- Administrative scripts now use the Supabase secret-key format; neither value
  was logged or committed.
- Sites version 2 was verified to contain one publishable value and zero secret
  or legacy JWT API-key values.
- Legacy anon/service-role API keys were disabled on 2026-07-28. Both historical
  keys now return HTTP 401; publishable-key login still passes.
- `npm run audit:security` blocks tracked environment files and populated
  privileged credentials.

## History finding

`.env` exists in commits `2024a72` and `abf149c`. Removing it from the current
tree does not remove those historical copies. Treat every non-public credential
that appeared there as exposed.

## Required external completion before PILOT

- Rotate the production database password in Supabase.
- Rotate the Management API access token and any third-party credential found
  in the historical file.
- Update approved secret stores and CI/deployment settings.
- Re-test database backup and deployment access with the rotated credentials.
- Decide whether to rewrite Git history. If chosen, coordinate a protected
  force-push and require every clone to re-clone; credential rotation remains
  mandatory even after rewriting.

The historical service-role exposure is remediated by legacy-key disablement.
Database-password and Management-token rotation remain external PILOT gates.
