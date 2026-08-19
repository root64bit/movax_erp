# Login and session verification

- `/login` is the unauthenticated route.
- Both provisioned accounts authenticate successfully.
- Invalid credentials produce a Portuguese non-technical message.
- Email receives initial focus; password visibility and reset controls are present.
- Duplicate submission is disabled while authentication is pending.
- First login is blocked by the strong-password change gate.
- Logout returns to `/login`; session refresh was verified.
- Active state, role, permissions, branch, warehouse, and `MIGRATION` mode come from `get_current_user_context`.

No password was changed during verification, so the secure temporary handoff remains valid.
