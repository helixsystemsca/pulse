# MFA Readiness — Microsoft Entra + Future TOTP

## Recommended path (production)

**Microsoft SSO via Supabase Auth → Entra ID** with **Conditional Access MFA**. Pulse does not need native TOTP for Entra-backed users when CA enforces MFA at login.

### IT checklist

1. Azure app registration + redirect URIs (Supabase callback + SPA `/auth/callback`)
2. Supabase Auth → Azure provider enabled
3. Entra Conditional Access: require MFA for Pulse app / all users
4. API env: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (server verify only — **not** service role on API if avoidable)

### Pulse hooks (migration `1022`)

**`companies.security_policy` (JSONB):**

```json
{
  "auth_mode": "password_allowed | sso_preferred | sso_required",
  "mfa_required": true,
  "mfa_provider": "entra | totp | none",
  "password_login_allowed": true,
  "microsoft_sso_allowed": true
}
```

**`users` columns:**

| Column | Purpose |
|--------|---------|
| `mfa_enrolled_at` | Set on successful Microsoft login (Entra MFA assumed) |
| `mfa_method` | `entra` or future `totp` |
| `sso_subject` | Supabase user id / stable IdP subject |

**Platform env flags:**

- `PLATFORM_ALLOW_PASSWORD_LOGIN` — kill-switch
- `PLATFORM_ALLOW_MICROSOFT_SSO` — kill-switch

### Code integration

- `password_login_allowed_for_user()` / `microsoft_sso_allowed_for_company()` gate login routes
- Microsoft login sets `mfa_enrolled_at` when Entra path succeeds (MFA enforced upstream)
- `/auth/me` can expose `mfa_enrolled` for UI badges (future)

## Future TOTP (not implemented)

Architecture placeholder only:

1. `companies.security_policy.mfa_provider = "totp"`
2. Enrollment tables: `user_totp_secrets` (encrypted), recovery codes
3. Login flow: password → `POST /auth/mfa/verify` with TOTP
4. Do **not** store TOTP seeds in `security_policy` JSON

## Feature flag summary

| Flag | Scope | Effect |
|------|-------|--------|
| `PLATFORM_ALLOW_PASSWORD_LOGIN` | Platform | Disables password login globally |
| `PLATFORM_ALLOW_MICROSOFT_SSO` | Platform | Disables Microsoft OAuth |
| `security_policy.auth_mode` | Tenant | `sso_required` blocks password |
| `security_policy.mfa_required` | Tenant | Policy check + UI (enforce via Entra today) |

## Audit

- `auth.microsoft_login` — includes provider metadata
- Future: `auth.mfa_challenge_failed`, `auth.mfa_enrolled`
