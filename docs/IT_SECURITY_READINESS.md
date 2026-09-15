# IT security readiness — municipal review (pre-SSO)

**Date:** 2026-09-15  
**Audience:** municipal IT / security reviewers  
**Scope:** multi-tenant isolation at PostgreSQL, production enforcement, residual SSO/MFA items  
**Related:** [`SECURITY_OVERVIEW.md`](SECURITY_OVERVIEW.md), [`SECURITY_HARDENING_REPORT.md`](SECURITY_HARDENING_REPORT.md), [`RLS_POLICY_STRATEGY.md`](RLS_POLICY_STRATEGY.md), [`MFA_READINESS.md`](MFA_READINESS.md), [`MICROSOFT_SSO_SETUP.md`](MICROSOFT_SSO_SETUP.md)

Pulse is a multi-tenant operations platform (FastAPI + PostgreSQL on Supabase + Next.js). Application queries are already scoped by `company_id`. Row Level Security (RLS) is the database backstop so a bug, a compromised SQL client, or accidental PostgREST access cannot read another municipality’s rows.

---

## What is solid now (code in this repository)

| Control | Status | Notes |
|---------|--------|-------|
| Tenant RLS helpers | Done | `pulse.company_id` / `pulse.is_system_admin` GUCs set per request (`app/core/security/tenant_rls.py`) |
| RLS phase 1 | Done | Migration `1021` — tables with `company_id` that existed then |
| RLS phase 2 | Done | Migration `1023` — child/junction tables via parent `EXISTS` |
| RLS phase 3 | Done | Migration `1051` — remaining public tables (see list below) + helper `search_path` |
| RLS FORCE | Done | Forced on application tables so table-owner bypass does not apply to `pulse_app` |
| `alembic_version` lockdown | Done | RLS enabled, **no** app policies (migration owner still updates it) |
| App-layer tenant deny | Done | `assert_company_scope()` + security audit events |
| HTTPS / HSTS / security headers | Done | `REQUIRE_HTTPS`, `SecurityHeadersMiddleware`, Next.js headers |
| CORS / trusted hosts | Done | Explicit origins; production OpenAPI disabled |
| Password policy + lockout | Done | Length/classes, exponential lockout, `token_version` on password change |
| Internal cron | Done | HMAC compare, optional replay window, system RLS context |
| Sentry PII | Done | `send_default_pii=False` |
| JWT cookie migration | **Not in this change** | Scaffold only (`AUTH_SESSION_MODE=dual`). Default remains bearer + `localStorage` |

### Tables covered by migration `1051` (advisor gap 2026-09-15)

**Ops:** `ops_knowledge_articles`, `ops_meetings`, `ops_people`, `ops_contractors`, `ops_regulations`, `ops_facilities`, `ops_quick_notes`, `ops_contacts`, `ops_entity_links`, `ops_revisions`, `ops_personal_profiles`, `ops_role_responsibilities`, `ops_authority_matrix_rows`, `ops_checklist_templates`, `ops_checklist_instances`, `ops_checklist_items`, `ops_knowledge_gaps`, `ops_skills`, `ops_skill_ratings`, `ops_development_plans`, `ops_team_risks`

**Planner:** `planner_categories`, `planner_settings`, `planner_routine_blocks`, `planner_tasks`, `planner_calendar_events`, `planner_interruptions`, `planner_blockers`, `planner_schedule_blocks`, `planner_task_history`, `planner_time_entries`, `planner_daily_metrics`

**Roadmap:** `roadmap_projects`, `roadmap_milestones`

**Child / special:** `material_request_draft_items`, `purchasing_quick_purchase_lines`, `user_refresh_sessions`, `companies`, `alembic_version`

`1051` also enables tenant policies on **any other** `public` table with `company_id` that still lacked them (defense against tables added between 1021 and this revision).

Policies use the existing helpers `pulse_rls_tenant_visible` / `pulse_rls_tenant_visible_nullable` or parent `EXISTS` (same model as 1021/1023). Special cases:

- **`companies`** — tenant sees only `id = pulse.company_id`; system admin sees all
- **`ops_checklist_templates`** — `company_id IS NULL` system seeds are readable by tenants; writes stay tenant- or admin-scoped
- **`user_refresh_sessions`** — visible only via parent `users.company_id`
- **`alembic_version`** — RLS on, no policies for the app role

---

## Residual risks (talking points for SSO / MFA)

| Topic | Risk | Planned path | This PR |
|-------|------|--------------|---------|
| Access JWT in `localStorage` | XSS can steal the session | HttpOnly cookies + refresh rotation ([`JWT_SESSION_MIGRATION.md`](JWT_SESSION_MIGRATION.md) phases 2–4) | **Not forced.** Dual mode is opt-in (`AUTH_SESSION_MODE=dual`) after the SPA refresh flow is tested. Cross-site SPA (Vercel) → API (Render) is a poor fit for third-party cookies until same-site DNS is ready. |
| No native TOTP | Password tenants without MFA | Microsoft Entra SSO + Conditional Access MFA ([`MFA_READINESS.md`](MFA_READINESS.md)) | Hooks exist (`companies.security_policy`, `users.mfa_*`). Enforcement is an IdP/CA operator step. |
| Microsoft auto-provision | First SSO login can create a `worker` | Tenant `sso_required` + invite-only flag (future) | Documented; not enabled globally here |
| SMTP | Invite/reset mail depends on operator credentials | Google Workspace or M365 SMTP with app passwords; health checks exist | Operator config only; no secrets in git |
| Supabase service role | Bypasses RLS | Server-only; never in the browser. Prefer anon key on the API for OAuth verify | Startup warns if service role is set in production |
| App DB user is `postgres` | **RLS not enforced** until role switch | `pulse_app` runtime + `MIGRATION_DATABASE_URL` owner + system RLS GUCs on seeds | Temporary rollback: owner `DATABASE_URL`. Long-term: dual URL + this PR’s catalog/startup context |
| `btree_gist` in `public` | Advisor WARN only | Leave unless IT wants it moved to `extensions` | Not a tenant-isolation gap |
| Rate limits are in-memory | Multi-instance login abuse | Edge / Redis limiter later | Per-process SlowAPI remains |

---

## Apply steps (staging, then production)

1. **Migrate** as the current owner/superuser:
   ```bash
   cd backend && alembic upgrade head
   ```
   Head includes `1051_rls_coverage`.
2. **Create / tighten `pulse_app`** — run [`scripts/sql/create_pulse_app_role.sql`](../scripts/sql/create_pulse_app_role.sql) as owner. Set the password in the SQL editor or secret store. **Do not put passwords in git.**
3. **Switch Render `DATABASE_URL`** to `pulse_app` with `sslmode=require`. Set a **separate** owner URL for Alembic only — do not put the owner password in git:
   - `DATABASE_URL` = `pulse_app` (RLS enforced; API runtime)
   - `MIGRATION_DATABASE_URL` (or `DATABASE_URL_MIGRATIONS`) = `postgres` / table owner (DDL)
   Start command (`scripts/render_start.sh` → `python scripts/alembic_migrate.py`) uses the migration URL when set, otherwise falls back to `DATABASE_URL` (local/dev). If the database is already at Alembic head, migrate is a no-op (reads/updates `alembic_version` only; no application DDL).
   Alembic connections and startup catalog/seed writes set `pulse.is_system_admin=true` (FORCE RLS on `rbac_catalog_permissions` rejects inserts otherwise).
   **Temporary rollback:** if a deploy still fails after the role switch, point `DATABASE_URL` back at the owner/`postgres` URL to restore service. Long-term remains `pulse_app` + `MIGRATION_DATABASE_URL` + system RLS context on seeds (this change). Do not leave owner as the runtime URL.
4. **Set API env:**
   - `DATABASE_RLS_CONTEXT_ENABLED=true` (default; GUC per request)
   - `DATABASE_RLS_ENFORCED=true` (startup warns if the URL still uses `postgres` / `supabase_admin`)
5. **Re-check Supabase advisors** — target **zero** `rls_disabled_in_public`. Paste [`scripts/sql/verify_rls_coverage.sql`](../scripts/sql/verify_rls_coverage.sql) in the SQL editor.
6. **Smoke-test** a tenant login and a second tenant: each must see only own ops/planner/roadmap/company row. System admin still sees all. Password `POST /api/v1/auth/login` must succeed as `pulse_app` (auth bootstrap sets system GUCs for the email lookup, then tenant GUCs for lockout / `login_events` / audit). `/health/ready` being 200 is not enough — that probe does not touch `users`. Keep Render `DATABASE_URL` on `pulse_app` and `MIGRATION_DATABASE_URL` on the owner; do not revert runtime to superuser.

Migrations continue to run as owner (may bypass RLS). Runtime must not.

---

## Operator checklist

### Supabase

- [ ] `alembic upgrade head` applied (or SQL equivalent) on Pulse-DB
- [ ] Advisors: **0** `rls_disabled_in_public`
- [ ] `pulse_rls_*` functions show a fixed `search_path` (`pg_catalog`)
- [ ] Role `pulse_app` exists, `rolbypassrls = false`, `rolsuper = false`
- [ ] `alembic_version` has RLS on and **no** `pulse_app` table grants
- [ ] Database API / PostgREST: do **not** expose `public` to `anon` / `authenticated` if the product API is FastAPI-only; never ship `service_role` to browsers
- [ ] PITR / daily backups enabled; restore drill documented
- [ ] `sslmode=require` on all client URLs

### Render (API)

- [ ] `ENVIRONMENT=production`
- [ ] Strong `SECRET_KEY` (≥ 32 chars, not a placeholder)
- [ ] `DATABASE_URL` → `pulse_app` (not `postgres`; `sslmode=require`)
- [ ] `MIGRATION_DATABASE_URL` → owner/`postgres` (Alembic/DDL only; never commit this password)
- [ ] `DATABASE_RLS_CONTEXT_ENABLED=true`
- [ ] `DATABASE_RLS_ENFORCED=true`
- [ ] Temporary rollback only: owner `DATABASE_URL` if a `pulse_app` cutover fails; restore dual URL after this deploy
- [ ] `REQUIRE_HTTPS=true`, `ENABLE_HSTS=true` behind TLS
- [ ] `TRUSTED_HOSTS` set to the API hostname
- [ ] `CORS_ORIGINS` / `PULSE_APP_PUBLIC_URL` = SPA origin (not the API host)
- [ ] `PM_CRON_SECRET` / `NOTIFICATION_CRON_SECRET` set; cron sends `X-Cron-Timestamp`
- [ ] SMTP vars set if invites/resets are required; confirm `/api/system/smtp-health`
- [ ] `SUPABASE_ANON_KEY` for OAuth verify; avoid `SUPABASE_SERVICE_ROLE_KEY` on the API
- [ ] Leave `AUTH_SESSION_MODE=bearer` until cookie/same-site routing is tested

### Vercel (SPA)

- [ ] No `SERVICE_ROLE` or database passwords in Vercel env
- [ ] `NEXT_PUBLIC_*` keys are publishable only
- [ ] `NEXT_PUBLIC_AUTH_SESSION_MODE` matches API (`bearer` today)
- [ ] Security headers remain in `next.config.js`
- [ ] Production SPA origin is listed on the API CORS allow-list

### Entra / SSO (follow-on, not blocked by RLS)

- [ ] Azure app registration + redirect URIs (Supabase callback + SPA `/auth/callback`)
- [ ] Conditional Access: require MFA for Pulse
- [ ] Tenant `security_policy.auth_mode` (`sso_preferred` / `sso_required`) for the pilot municipality
- [ ] Confirm `PLATFORM_ALLOW_PASSWORD_LOGIN` / `PLATFORM_ALLOW_MICROSOFT_SSO` match policy

---

## Verification commands

```sql
-- Must return zero rows
SELECT c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;
```

Automated tests: `backend/tests/test_tenant_rls.py` (helpers, catalog coverage, optional non-superuser role).

---

*This note is the municipal IT appendix for the RLS completeness pass. Re-run Supabase advisors after apply; do not certify production until `pulse_app` is the runtime role.*
