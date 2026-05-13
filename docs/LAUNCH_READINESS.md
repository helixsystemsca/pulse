# Pulse launch readiness

This checklist tracks **security and operations** items raised in internal review (`claudereview.md`) and what the codebase enforces automatically.

## Implemented in code (this repo)

| Item | What we did |
|------|----------------|
| Weak JWT signing in production | `Settings` rejects `ENVIRONMENT=production` unless `SECRET_KEY` is **≥ 32 characters** and not the dev placeholders (`backend/app/core/config.py`). |
| DB pooling / Supabase pooler | Async engine uses **`NullPool`** when the URL contains `pooler.supabase.com` or port **`6543`** (transaction pooler); otherwise bounded `pool_size` / `max_overflow` (`backend/app/core/database.py`). |
| Health probes | **`GET /health`** (liveness), **`GET /health/ready`** (DB `SELECT 1`) — no `/api` prefix (`backend/app/api/health_routes.py`). |
| Login brute-force surface | Password **`POST /api/v1/auth/login`**: **8/minute** per IP; Microsoft OAuth: **12/minute** (`backend/app/api/auth_routes.py`). |
| Account lockout | After **`LOGIN_LOCKOUT_MAX_ATTEMPTS`** failed password checks for the same user, sign-in is blocked until **`LOGIN_LOCKOUT_MINUTES`** elapse (`users.failed_login_attempts`, `users.locked_until`). |
| Password policy (new passwords) | Invites, employee invite accept, password reset confirm, and profile password change must meet **`PASSWORD_MIN_LENGTH`** (default 12) and **three of four** character classes unless **`PASSWORD_REQUIRE_CHARACTER_CLASSES=false`** (`backend/app/core/auth/password_policy.py`). |
| JWT revocation (password change) | JWTs carry a **`tv`** claim matching **`users.token_version`**; bumping the version invalidates outstanding tokens (`backend/app/api/deps.py`, `backend/app/core/auth/security.py`). |
| Error monitoring (optional) | **`SENTRY_DSN`** enables Sentry on the API (`backend/app/main.py`). **`NEXT_PUBLIC_SENTRY_DSN`** enables browser reports (`frontend/components/app/SentryInit.tsx`). |
| CI | **`.github/workflows/ci.yml`** runs backend pytest (PostgreSQL service) and frontend lint / tests / production build check. |

## Manual / infrastructure (you must do)

1. **Secrets in git**  
   If `.env` or `.env.local` was ever committed, treat them as **burned**: rotate **database password**, **SECRET_KEY**, **SYS_ADMIN** bootstrap password, **cron secrets**, **Vercel OIDC**, etc. Use platform env vars only; keep files local and ignored (see root `.gitignore`).

2. **Production env**  
   Set `ENVIRONMENT=production`, `REQUIRE_HTTPS=true` (behind TLS), a strong `SECRET_KEY`, and correct `CORS_ORIGINS` / `PULSE_APP_PUBLIC_URL` (see `backend/.env.example`).

3. **Uploads**  
   Avatars and binary uploads need **persistent disk** (`PULSE_UPLOADS_DIR`) or **`PULSE_STORAGE_BACKEND=s3`** — see `backend/.env.example`.

4. **Sentry**  
   Create a Sentry project, copy the DSN, and set **`SENTRY_DSN`** on the API host and **`NEXT_PUBLIC_SENTRY_DSN`** on the Next.js host. Optional: tune **`SENTRY_TRACES_SAMPLE_RATE`** (default `0`).

5. **Automated database backups**  
   Not implemented in application code. Enable **scheduled backups** in your host (e.g. Supabase **Point-in-time recovery** / daily backups, Render **PostgreSQL backups**, RDS snapshots). Document restore drills in your runbook.

6. **JWT in `localStorage` vs HttpOnly cookies**  
   Still the SPA model today (`frontend/lib/pulse-session.ts`). Moving tokens to **HttpOnly cookies** requires the browser to send cookies to the API **Origin** — typically a **same-site** API hostname (e.g. `https://api.helixsystems.ca` with the SPA on `https://panorama.helixsystems.ca` and careful **`SameSite` / `Domain`**), or a **BFF** that shares the SPA origin. A cross-site SPA (`panorama.…`) calling a different API host (`*.onrender.com`) is a poor fit for third-party cookies; plan routing/DNS before migrating.

7. **Token revocation, CSRF depth, MFA**  
   Password change / reset now bumps **`token_version`** (invalidates JWTs). Broader revocation lists, CSRF for cookie-based auth, and MFA remain roadmap items per your risk tolerance.

## Quick verification

- `curl -s https://<api-host>/health` → `{"status":"ok",...}`  
- `curl -s https://<api-host>/health/ready` → `200` and `"database":"ok"`  
- Staging with `ENVIRONMENT=production` and a short `SECRET_KEY` → process should **fail fast** at startup with a clear `ValueError`.
