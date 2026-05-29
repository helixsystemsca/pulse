# Security Hardening Report — Pulse Platform

**Date:** 2026-05-26 (updated: continuation pass)  
**Scope:** Enterprise readiness — tenant isolation, authentication, operations, dependencies  
**Architecture:** FastAPI + PostgreSQL (Supabase) + React/Next.js  

This report documents **findings**, **remediations implemented in this pass**, and **recommended next steps**. It is intended for IT, security, and legal review alongside [`SECURITY_OVERVIEW.md`](SECURITY_OVERVIEW.md).

### Continuation pass (same date)

- **RLS phase 2** — migration `1023` (child/junction tables)
- **Permission audit dual-write** — `record_permission_change()` → `rbac_audit_events` + `audit_logs`
- **Tenant role CRUD** — security audit on create/update/delete
- **JWT phase 2 scaffold** — `user_refresh_sessions`, `/auth/refresh`, `/auth/logout`, `/auth/logout/all` (`AUTH_SESSION_MODE=dual`)

---

## Executive summary

| Priority | Status | Summary |
|----------|--------|---------|
| P1 RLS | **Implemented (phase 1)** | Migration `1021`, session GUCs, ~90 tables with `company_id` policies |
| P2 JWT / cookies | **Designed** | Incremental plan in [`JWT_SESSION_MIGRATION.md`](JWT_SESSION_MIGRATION.md) — no breaking auth change |
| P3 MFA | **Prepared** | Tenant policy JSON, user hooks, Entra path documented in [`MFA_READINESS.md`](MFA_READINESS.md) |
| P4 Secrets | **Improved** | Startup validation, production `SECRET_KEY` guard (existing), `.env` gitignored |
| P5 Audit / logging | **Improved** | Request IDs, security audit actions, RBAC/tenant deny events, redaction helpers |
| P6 Rate limiting | **Improved** | Exponential lockout, profile password limit, internal route limits |
| P7 Internal endpoints | **Improved** | Constant-time secrets, optional replay window, system RLS context for cron |
| P8 Dependencies | **Tooling** | `scripts/security-audit-deps.sh` + CI recommendations |
| P9 Infrastructure | **Verified / documented** | HTTPS, CORS, trusted hosts, Sentry PII off — operator checklist below |

---

## Finding severity legend

| Level | Meaning |
|-------|---------|
| **Critical** | Exploitable or high-likelihood tenant/data compromise |
| **High** | Significant risk; address before broad enterprise rollout |
| **Medium** | Defense gap or compliance friction |
| **Low** | Hardening opportunity |

**Complexity:** S (hours), M (days), L (weeks)

---

## Priority 1 — PostgreSQL Row Level Security

### Implemented

- Alembic **`1021_tenant_rls`**: enables RLS on all `public` tables with `company_id`; policies use `pulse.company_id` / `pulse.is_system_admin` session variables.
- **`1022_tenant_security_policy`**: `companies.security_policy`, `users.mfa_*` / `sso_subject`.
- **`app/core/security/tenant_rls.py`**: sets GUCs per request in `get_current_user`.
- **`assert_company_scope()`** in deps: app-layer cross-tenant deny + audit.
- Docs: [`RLS_POLICY_STRATEGY.md`](RLS_POLICY_STRATEGY.md).
- Tests: `backend/tests/test_tenant_rls.py`.

### Findings

| ID | Severity | Finding | Affected | Remediation | Complexity |
|----|----------|---------|----------|-------------|------------|
| RLS-01 | **High** | App DB user likely `postgres`/owner → **RLS bypassed** | All tenant data | Create `pulse_app` role without BYPASSRLS; `DATABASE_RLS_ENFORCED=true` | M |
| RLS-02 | **Medium** | ~26 child tables lack direct `company_id` policies (phase 2) | Monitoring subtree, WO children, `user_badges` | Add policies via parent FK or denormalize `company_id` | L |
| RLS-03 | **Medium** | Nullable `company_id` on audit/automation rows | `audit_logs`, `automation_events` | Tighten app writes; optional NOT NULL for tenant events | M |
| RLS-04 | **Low** | Supabase service role bypasses RLS | Direct SQL API | Never expose service role to clients; server-only | S |

### Operator actions

1. Run `alembic upgrade head` (includes `1021`, `1022`).
2. Create DB role `pulse_app` (no BYPASSRLS), grant table privileges, update `DATABASE_URL`.
3. Set `DATABASE_RLS_CONTEXT_ENABLED=true`, `DATABASE_RLS_ENFORCED=true` in production.

---

## Priority 2 — JWT & session security

### Implemented

- Design doc only: [`JWT_SESSION_MIGRATION.md`](JWT_SESSION_MIGRATION.md) (phased bearer → dual → cookie).
- Existing: `token_version` / `tv` claim invalidation on password change.

### Findings

| ID | Severity | Finding | Affected | Remediation | Complexity |
|----|----------|---------|----------|-------------|------------|
| JWT-01 | **Critical** | Access JWT in `localStorage` (XSS → session theft) | Web SPA | Phases 2–4: HttpOnly cookies + refresh rotation | L |
| JWT-02 | **High** | No refresh tokens / logout revocation endpoint | All users | `user_refresh_sessions` + `/auth/logout` | M |
| JWT-03 | **Medium** | HS256 symmetric key only | API | Acceptable short-term; consider RS256 multi-service | M |
| JWT-04 | **Low** | No `iss`/`aud` JWT claims | API | Add on cookie migration | S |

**No breaking changes** in this pass — current login/OAuth flows unchanged.

---

## Priority 3 — MFA preparation

### Implemented

- `companies.security_policy` + user MFA/SSO columns (migration `1022`).
- `tenant_auth_policy.py` — password/SSO gates; Microsoft login sets `sso_subject`, `mfa_method=entra`, `mfa_enrolled_at`.
- Platform flags: `PLATFORM_ALLOW_PASSWORD_LOGIN`, `PLATFORM_ALLOW_MICROSOFT_SSO`.
- Doc: [`MFA_READINESS.md`](MFA_READINESS.md).

### Findings

| ID | Severity | Finding | Affected | Remediation | Complexity |
|----|----------|---------|----------|-------------|------------|
| MFA-01 | **High** | No native TOTP; password login without MFA | Email/password tenants | Entra SSO + CA MFA (preferred) or future TOTP phase | M–L |
| MFA-02 | **Medium** | Microsoft auto-provisions `worker` on first login | Tenants without invite-only | Policy: `sso_required` + disable auto-create (future flag) | M |
| MFA-03 | **Medium** | `mfa_enrolled_at` assumes Entra MFA — not verified from token | Compliance claims | Document reliance on Conditional Access; optional Graph check later | S |

---

## Priority 4 — Secrets & environment

### Implemented

- `startup_validation.py` — logs security config summary without secret values; warns on weak keys, missing cron secrets, superuser+RLS enforced, service role on API.
- `.gitignore` covers `.env`, `backend/.env`, `frontend/.env.local`.
- Production validator blocks placeholder `SECRET_KEY` (existing).

### Findings

| ID | Severity | Finding | Affected | Remediation | Complexity |
|----|----------|---------|----------|-------------|------------|
| SEC-01 | **Critical** | Historical risk: credentials committed to git | All secrets | Rotate DB, `SECRET_KEY`, cron, SMTP, Supabase keys | S |
| SEC-02 | **High** | `SUPABASE_SERVICE_ROLE_KEY` on API bypasses DB RLS | DB | Use anon key for OAuth verify only | S |
| SEC-03 | **Medium** | No automated secret scanning in CI | Repo | Add gitleaks/trufflehog job | S |
| SEC-04 | **Low** | Dev placeholder in `.env.example` | Local dev | Document; never use in prod | S |

### Secret scan (manual)

No live secrets found in tracked source; test fixtures use dummy passwords. **Rotate** if `.env` was ever committed.

---

## Priority 5 — Audit logging & monitoring

### Implemented

- `RequestContextMiddleware` — `X-Request-Id` on all responses.
- `security_events.py` — redaction, `record_security_event`.
- New audit actions: `security.tenant_access_denied`, `security.rbac_denied`, `auth.password_changed`, `auth.password_change_failed`, `security.internal_cron.denied`.
- `suspicious_activity.py` — structured warning hook for cross-tenant attempts.
- RBAC denials and profile password events write to `audit_logs`.

### Findings

| ID | Severity | Finding | Affected | Remediation | Complexity |
|----|----------|---------|----------|-------------|------------|
| AUD-01 | **Medium** | `audit_logs` lacks IP/UA columns | Forensics | Add optional columns or ship to SIEM from gateway logs | M |
| AUD-02 | **Medium** | Role/permission matrix changes not uniformly audited | RBAC | Audit in `tenant_roles_routes`, permission matrix save | M |
| AUD-03 | **Low** | No WORM / export pipeline | Compliance | S3/archive + retention policy | L |

---

## Priority 6 — Rate limiting & abuse

### Implemented

- Exponential account lockout (`login_lockout_exponential`).
- `POST /profile/password` — 8/min + failed attempt audit.
- Internal cron routes — 12–30/min per IP.
- Existing: login 8/min, Microsoft 12/min, invites 15/min, reset 10/min.

### Findings

| ID | Severity | Finding | Affected | Remediation | Complexity |
|----|----------|---------|----------|-------------|------------|
| RL-01 | **High** | SlowAPI in-memory per instance — not global | Login abuse | Redis-backed limiter at edge or API | M |
| RL-02 | **Medium** | OAuth login not counted in password lockout | Microsoft path | Optional per-email rate limit on OAuth | S |
| RL-03 | **Low** | `/auth/me` only default 120/min | Enumeration | Stricter limit if needed | S |

---

## Priority 7 — Internal endpoints

### Implemented

- `verify_internal_cron_secret()` — `hmac.compare_digest`, optional `X-Cron-Timestamp` replay window.
- Rate limits on all four internal POST routes.
- `apply_pulse_rls_system_context()` after auth for cron DB work.
- Audit log on invalid cron attempts (structured log; sync helper).

### Endpoints

| Route | Secret header | Env |
|-------|---------------|-----|
| `POST /api/v1/internal/pm-tasks/run-due-scan` | `X-PM-Cron-Key` | `PM_CRON_SECRET` |
| `POST /api/v1/internal/maintenance-inferences/cleanup` | `X-PM-Cron-Key` | `PM_CRON_SECRET` |
| `POST /api/v1/internal/schedule/reminders/run` | `X-PM-Cron-Key` | `PM_CRON_SECRET` |
| `POST /api/v1/internal/notifications/run-evaluations` | `X-Notification-Cron-Secret` | `NOTIFICATION_CRON_SECRET` |

### Findings

| ID | Severity | Finding | Affected | Remediation | Complexity |
|----|----------|---------|----------|-------------|------------|
| INT-01 | **Medium** | PM + schedule share one secret | Blast radius | Split `SCHEDULE_CRON_SECRET` | S |
| INT-02 | **Medium** | Cron paths on public API host | Network | IP allowlist / private Render service | S |
| INT-03 | **Low** | Timestamp header optional | Replay | Require `X-Cron-Timestamp` in prod cron jobs | S |

---

## Priority 8 — Dependencies

### Implemented

- `scripts/security-audit-deps.sh` — `pip-audit` + `npm audit`.

### CI recommendations

```yaml
# Example GitHub Actions jobs
- pip-audit -r backend/requirements.txt
- npm audit --audit-level=high --prefix frontend
- gitleaks detect --source .
```

### Findings

| ID | Severity | Finding | Affected | Remediation | Complexity |
|----|----------|---------|----------|-------------|------------|
| DEP-01 | **Medium** | No automated CVE gate in CI | Supply chain | Add audit jobs above | S |
| DEP-02 | **Low** | Large frontend dependency tree | XSS surface | Periodic `npm audit fix`, review | Ongoing |

Run `scripts/security-audit-deps.sh` locally for current CVE list.

---

## Priority 9 — Infrastructure readiness

### Verified in codebase

| Control | Status | Notes |
|---------|--------|-------|
| HTTPS enforcement | ✅ | `REQUIRE_HTTPS`, `RequireHttpsMiddleware` |
| Security headers | ✅ | `SecurityHeadersMiddleware`, Next.js headers |
| CORS | ✅ | Explicit origins; credentials enabled |
| Trusted hosts | ✅ | `TrustedHostMiddleware` when set |
| Production docs disabled | ✅ | OpenAPI off when `ENVIRONMENT=production` |
| Sentry PII | ✅ | `send_default_pii=False` |
| DB TLS | ⚙️ | Operator: use `sslmode=require` in `DATABASE_URL` |
| Backups / PITR | ⚙️ | Operator: enable on Supabase/RDS |
| JWT production key | ✅ | Startup fails on weak `SECRET_KEY` |

### Findings

| ID | Severity | Finding | Affected | Remediation | Complexity |
|----|----------|---------|----------|-------------|------------|
| INF-01 | **High** | Backup/DR not defined in app | Data loss | Enable PITR; test restore | S (ops) |
| INF-02 | **Medium** | No SOC2/ISO package | Sales/legal | Use this report + `SECURITY_OVERVIEW` as technical appendix | L |
| INF-03 | **Low** | Single-region deployment | Availability | Document RTO/RPO | S |

---

## Files changed (this pass)

| Area | Path |
|------|------|
| RLS migration | `backend/alembic/versions/1021_tenant_row_level_security.py` |
| Security policy migration | `backend/alembic/versions/1022_tenant_security_policy.py` |
| RLS context | `backend/app/core/security/tenant_rls.py` |
| Internal cron | `backend/app/core/security/internal_cron.py` |
| Auth policy | `backend/app/core/security/tenant_auth_policy.py` |
| Startup validation | `backend/app/core/security/startup_validation.py` |
| Audit | `backend/app/core/audit/security_events.py` |
| Middleware | `backend/app/middleware/request_context.py` |
| Lockout | `backend/app/core/auth/lockout.py` |
| Tests | `backend/tests/test_tenant_rls.py`, `test_internal_cron.py`, … |
| Scripts | `scripts/security-audit-deps.sh` |

---

## Recommended rollout order

1. **Deploy migrations** `1021` + `1022` to staging.
2. **Create `pulse_app` DB role** and test with `DATABASE_RLS_ENFORCED=true`.
3. **Rotate secrets** if any ever leaked; set cron secrets + `X-Cron-Timestamp` on schedulers.
4. **Enable Entra MFA** + Microsoft SSO for pilot tenant (`security_policy.auth_mode=sso_preferred`).
5. **CI**: dependency audit + gitleaks.
6. **Plan JWT phase 2** when IT approves cookie/same-site routing.

---

## Related documents

- [`SECURITY_OVERVIEW.md`](SECURITY_OVERVIEW.md) — architecture for reviewers  
- [`RLS_POLICY_STRATEGY.md`](RLS_POLICY_STRATEGY.md)  
- [`JWT_SESSION_MIGRATION.md`](JWT_SESSION_MIGRATION.md)  
- [`MFA_READINESS.md`](MFA_READINESS.md)  
- [`MICROSOFT_SSO_SETUP.md`](MICROSOFT_SSO_SETUP.md)  
- [`LAUNCH_READINESS.md`](LAUNCH_READINESS.md)  

---

*This report reflects codebase state at generation time. Re-run dependency scans and penetration tests before production certification.*
