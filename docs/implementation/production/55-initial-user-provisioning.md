# Initial user provisioning

Provisioned on 2026-07-28 through Supabase Auth and protected profile/role tables.

| User | Auth ID | Role | Active | Forced password change |
|---|---|---|---|---|
| Administrador Casa de Pneus | `de3cef25-1221-4468-8062-b573dd49b7d1` | `ADMINISTRATOR` | Yes | Yes |
| Gestor Casa de Pneus | `c3aaabef-f676-4241-8752-800f8c8ad7cf` | `MANAGER_LIMITED` | Yes | Yes |

Both users are scoped to branch `b0000000-0000-0000-0000-000000000001` and warehouse `c0000000-0000-0000-0000-000000000001`. Temporary credentials were generated at runtime, were not logged, and exist only in the ACL-restricted handoff outside the repository.
