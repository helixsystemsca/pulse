# JWT & Session Security — Incremental Migration Plan

**Status:** Design / phased rollout (no breaking change to current bearer + `localStorage` flow).

## Current state

- HS256 access JWT (~62 min), `tv` (`token_version`) invalidation on password change
- Token stored in browser `localStorage` (XSS exposure)
- No refresh tokens; no HttpOnly cookies; no CSRF token for API (bearer-only)

## Target state (enterprise)

| Control | Target |
|---------|--------|
| Access token | Short-lived (15–30 min), in memory or HttpOnly cookie |
| Refresh token | HttpOnly, `Secure`, `SameSite=Lax/Strict`, rotation on use |
| CSRF | Double-submit or SameSite + custom header for cookie mode |
| Logout | Server revokes refresh family (`refresh_token_version` on user) |
| XSS impact | Access token not readable from JS when cookie mode enabled |

## Phase 1 — Preparation (implemented / in progress)

- [x] `token_version` invalidates access JWTs on password change
- [x] Request correlation IDs (`X-Request-Id`)
- [x] Security audit events for password change, RBAC deny, tenant deny
- [ ] Document API gateway same-site routing (SPA + API subdomain)

## Phase 2 — Dual mode (feature flag) — **scaffolded**

**Implemented (backend, opt-in via `AUTH_SESSION_MODE=dual`):**

1. Table `user_refresh_sessions` (migration `1024`)
2. `POST /api/v1/auth/refresh` — rotate refresh token → new access + refresh
3. `POST /api/v1/auth/logout` — revoke single refresh token
4. `POST /api/v1/auth/logout/all` — revoke all refresh sessions + bump `token_version`
5. Login / Microsoft login return `refresh_token` in JSON when mode is `dual`

**Remaining for phase 2 completion:**

1. Frontend: store refresh token securely; call `/auth/refresh` on 401
2. Env: `AUTH_SESSION_MODE=dual` in staging only until UI ready

## Phase 3 — Cookie-primary

1. Set access token HttpOnly cookie (`pulse_access`) + refresh (`pulse_refresh`)
2. CSRF: issue `pulse_csrf` readable cookie + require `X-CSRF-Token` on mutating routes
3. CORS: `allow_credentials=true` with explicit origins (already configured)
4. Deprecate `localStorage` token write behind flag

## Phase 4 — Hardening

- Optional RS256 + JWKS (if multi-service verification needed)
- Refresh token reuse detection → revoke all sessions for user
- Device/session management UI

## CSRF plan (cookie mode)

- **SameSite=Lax** on refresh cookie (blocks cross-site POST from evil.com)
- **Mutations** require `X-CSRF-Token` matching non-HttpOnly `pulse_csrf` cookie
- Bearer mode unchanged (no CSRF risk for `Authorization` header from attacker origin without token)

## Compatibility

- Existing mobile/scripts keep `Authorization: Bearer` until Phase 4
- No forced migration day — `dual` mode indefinitely if needed

## Estimated effort

| Phase | Complexity | Duration |
|-------|------------|----------|
| 1 | Low | Done / 1 day |
| 2 | Medium | 1–2 weeks |
| 3 | Medium–High | 1–2 weeks |
| 4 | Low–Medium | 1 week |
