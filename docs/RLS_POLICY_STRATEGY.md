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

## SQL helper functions (migration `1021_tenant_rls`, search_path fixed in `1051_rls_coverage`)

- `pulse_rls_company_id()` — current tenant UUID
- `pulse_rls_is_system_admin()` — bypass flag
- `pulse_rls_tenant_visible(row_company_id)` — match tenant or admin
- `pulse_rls_tenant_visible_nullable(row_company_id)` — same, for nullable `company_id` columns

All four functions are `STABLE` with `SET search_path TO pg_catalog` (bodies schema-qualify `public.pulse_rls_*`). This satisfies the Supabase `function_search_path_mutable` advisor.

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

## Phase 3 — remaining public tables (migration `1051_rls_coverage`)

**Implemented:** RLS + FORCE on tables created after 1021/1023 that the 2026-09-15 advisor flagged (`ops_*`, `planner_*`, `roadmap_*`), plus:

| Table | Policy model |
|-------|----------------|
| Any `public` table with `company_id` still missing policies | `pulse_rls_tenant_visible` / `_nullable` (same as phase 1) |
| `companies` | `id = pulse_rls_company_id()` (tenants cannot enumerate other municipalities) |
| `ops_checklist_templates` | SELECT allows `company_id IS NULL` system seeds; writes are tenant or system admin |
| `material_request_draft_items` | `EXISTS` parent `material_request_drafts.company_id` |
| `purchasing_quick_purchase_lines` | `EXISTS` parent `purchasing_quick_purchases.company_id` |
| `user_refresh_sessions` | `EXISTS` parent `users.company_id` |
| `alembic_version` | RLS **on**, **no** FORCE, **no** policies — app role sees nothing; migration owner still updates it |

New tables must enable RLS and policies **in the same Alembic revision**. CI `test_all_public_tables_have_rls_enabled` fails if a public table ships without RLS.

Operator SQL: [`scripts/sql/create_pulse_app_role.sql`](../scripts/sql/create_pulse_app_role.sql), [`scripts/sql/verify_rls_coverage.sql`](../scripts/sql/verify_rls_coverage.sql). IT checklist: [`IT_SECURITY_READINESS.md`](IT_SECURITY_READINESS.md).

## Production requirements

1. **Database role** — Create `pulse_app` **without** `BYPASSRLS`. Grant CRUD on application tables. Point `DATABASE_URL` at this role.
2. **`DATABASE_RLS_CONTEXT_ENABLED=true`** — API sets GUCs (default).
3. **`DATABASE_RLS_ENFORCED=true`** — Startup warns if URL uses `postgres` superuser.
4. **Migrations** — Run Alembic as a migration owner (may bypass RLS); app runtime uses `pulse_app`.

## Supabase note

If using Supabase PostgREST with the **service role**, RLS is bypassed. Restrict service role to server-side only; never ship to browsers.

## Testing

- Unit: `backend/tests/test_tenant_rls.py` (GUC, helpers, `search_path`, catalog coverage, non-superuser role)
- Enforced integration: set `TEST_DATABASE_RLS_ROLE=pulse_app` and grant that role in CI (optional extra; tests also create a temporary `NOBYPASSRLS` role)
