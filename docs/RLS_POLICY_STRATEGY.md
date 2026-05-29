# PostgreSQL Row Level Security (RLS) — Policy Strategy

## Purpose

RLS provides **defense-in-depth** tenant isolation at the database layer. The FastAPI application already scopes queries by `company_id`; RLS limits damage from application bugs, SQL injection with a restricted role, or direct PostgREST/Supabase access.

## Session context

Each authenticated API request sets transaction-local GUCs:

| GUC | Values | Set by |
|-----|--------|--------|
| `pulse.company_id` | UUID string or empty | `apply_pulse_rls_context_for_user()` in `get_current_user` |
| `pulse.is_system_admin` | `true` / `false` | Same; `true` for `system_admin` users |

Internal cron jobs call `apply_pulse_rls_system_context()` (`is_system_admin=true`) after secret verification.

## SQL helper functions (migration `1021_tenant_rls`)

- `pulse_rls_company_id()` — current tenant UUID
- `pulse_rls_is_system_admin()` — bypass flag
- `pulse_rls_tenant_visible(row_company_id)` — match tenant or admin
- `pulse_rls_tenant_visible_nullable(row_company_id)` — same, for nullable `company_id` columns

## Policies

For every table with a `company_id` column (discovered from `information_schema`):

- **SELECT / UPDATE / DELETE** — `USING (pulse_rls_tenant_visible(company_id))` (or companies-specific: `id = pulse_rls_company_id()`)
- **INSERT** — `WITH CHECK` same expression

**Global catalogs** (`rbac_catalog_permissions`, `badge_definitions`): SELECT allowed for all; writes require system admin.

**`system_logs`**: system admin only.

## Phase 2 — child tables (migration `1023_tenant_rls_child`)

**Implemented:** RLS policies on child/junction tables using `EXISTS` subqueries to parent `company_id`.

Previously application-scoped only:

`login_events`, `job_tools`, `job_inventory`, `tenant_role_grants`, PM/WO child tables, monitoring sensor subtree, `user_badges`, etc.

See `SECURITY_HARDENING_REPORT.md` for the full list.

## Production requirements

1. **Database role** — Create `pulse_app` **without** `BYPASSRLS`. Grant CRUD on application tables. Point `DATABASE_URL` at this role.
2. **`DATABASE_RLS_CONTEXT_ENABLED=true`** — API sets GUCs (default).
3. **`DATABASE_RLS_ENFORCED=true`** — Startup warns if URL uses `postgres` superuser.
4. **Migrations** — Run Alembic as a migration owner (may bypass RLS); app runtime uses `pulse_app`.

## Supabase note

If using Supabase PostgREST with the **service role**, RLS is bypassed. Restrict service role to server-side only; never ship to browsers.

## Testing

- Unit: `backend/tests/test_tenant_rls.py` (GUC + function existence)
- Enforced integration: set `TEST_DATABASE_RLS_ROLE=pulse_app` and grant that role in CI
