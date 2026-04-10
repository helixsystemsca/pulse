# Security overview — Helix Pulse / IoT gateway architecture

This document is aimed at **enterprise IT and security reviewers**. It describes how the platform aligns with an **outbound-only, internet-first** deployment model: field gateways and browsers reach the cloud over TLS; **no inbound connections to customer LANs** are required.

## 1. Architecture principles

| Principle | How we implement it |
|-----------|---------------------|
| **Outbound-only** | ESP32 gateways and browsers initiate **HTTPS** to the API host. No requirement for VPN, reverse tunnels, or opened inbound ports on customer firewalls. |
| **Guest / public Wi‑Fi** | Devices only need outbound **443** (and DNS). No dependency on corporate VLANs or internal DNS for core operation. |
| **TLS everywhere** | API traffic is expected to be **TLS 1.2+** end-to-end. The backend can enforce “HTTPS only” when `REQUIRE_HTTPS=true` (see below). |
| **Isolation from internal IT** | Gateways do not scan or authenticate against Active Directory, LDAP, or internal services by default. Credentials are **per-gateway secrets** issued by the tenant admin UI. |

**Note:** MQTT over TLS on 443 (e.g. AWS IoT custom authorizer, WebSockets) is a common alternative to HTTPS POST; the same trust and provisioning model applies. This repository’s reference path is **HTTPS ingest** (`POST /api/v1/device/events`).

## 2. Trust boundaries

```text
[ BLE tags ]  →  [ ESP32 gateway ]  →  TLS (443)  →  [ Load balancer / CDN ]  →  [ FastAPI ]  →  [ DB ]
                      ↑                                                      ↑
                 No open ports                                        Terminates TLS,
                 on LAN for cloud                                      sets X-Forwarded-Proto
```

- **BLE layer:** Untrusted broadcast medium. Gateways must **whitelist** known tag IDs / MACs, **ignore** unknown frames, and **debounce** to limit flooding (see `firmware/esp32/README.md`).
- **Gateway → cloud:** Authenticated with **per-gateway secret** (bcrypt hash stored server-side; plaintext only at rotate time).
- **User → cloud:** JWT bearer tokens for interactive users; **RBAC** via `UserRole` and permission checks on routes.
- **Server → customer:** No callback channel required for ingestion (pull/poll from devices is not used for the event path described here).

## 3. Encryption and authentication

### 3.1 In transit

- **HTTPS** with valid server certificates on the public API hostname.
- Enable **HSTS** on the edge (`enable_hsts` / CDN) once HTTPS is verified.
- Backend **`RequireHttpsMiddleware`:** when `REQUIRE_HTTPS=true`, requests whose effective scheme is not `https` (using `X-Forwarded-Proto` from the load balancer) receive **403** with `{"detail":"https_required"}`.

### 3.2 Gateway (device) authentication

1. Manager creates a gateway record in Pulse (existing flow).
2. Manager calls **`POST /api/v1/gateways/{gateway_id}/ingest-secret/rotate`** (manager+). Response returns **`ingest_secret` once**.
3. Gateway stores the secret in **NVS** (encrypted on flash where supported), **never** in firmware source.
4. Each ingest request:
   - Header **`X-Gateway-Id`:** gateway UUID (primary key).
   - Header **`Authorization: Bearer <ingest_secret>`**.

Secrets are stored as **bcrypt hashes** in `automation_gateways.ingest_secret_hash`. Wrong secrets emit **`device.ingest_auth_failed`** audit rows (tenant-scoped).

**Legacy path:** `POST /api/v1/events` with a **user JWT** remains for backward compatibility; new field hardware should prefer **`/api/v1/device/events`**.

### 3.3 User authentication

- **JWT** (HS256 by default) with expiry (`ACCESS_TOKEN_EXPIRE_MINUTES`).
- Failed logins append **`auth.login_failed`** audit records (generic “Invalid credentials” response to callers).
- Login and impersonation routes are **rate-limited** (SlowAPI).

### 3.4 At rest

- Passwords: **bcrypt**.
- Gateway ingest secrets: **bcrypt hash** only in the database.
- Operational data: follow your **database encryption at rest** policy (RDS/Azure Disk encryption, etc.).

## 4. Authorization (RBAC)

- Roles include **system_admin**, **company_admin**, **manager**, **worker**, etc.
- Dependencies such as `require_manager_or_above`, `require_system_admin`, and `require_permission` gate APIs.
- **Feature flags** (middleware) restrict module paths by tenant subscription.

## 5. Input validation and abuse resistance

- Request bodies use **Pydantic** models; automation ingest allows controlled `extra` fields for device payloads but **company_id** for device ingest is taken from the **authenticated gateway**, not from client trust.
- **SlowAPI** default limit: **120/minute** per IP; stricter limits on `/auth/login`, `/auth/impersonate`, and **600/minute** on **`POST /api/v1/device/events`**.
- Automation **enrichment** applies additional **per-gateway / per-tag** rate limiting (existing logic).

## 6. HTTP security headers

- **FastAPI:** `SecurityHeadersMiddleware` sets `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`; optional **HSTS** when enabled.
- **Next.js (Pulse UI):** `next.config.js` sets baseline headers on all routes (`nosniff`, `DENY` framing, `Referrer-Policy`, restricted `Permissions-Policy`).

## 7. Frontend notes (XSS / CSRF)

- The SPA stores the JWT in **`localStorage`** (`pulse_auth_v1`) for API bearer auth. **CSRF against the API** is low risk for pure bearer flows because browsers do not attach `Authorization` on cross-site form posts.
- **XSS** in the app remains a priority: rely on React’s escaping, avoid `dangerouslySetInnerHTML`, sanitize rich text if added, and keep dependencies updated.
- **Hardening roadmap:** migrate to **HttpOnly, Secure, SameSite** cookies for session tokens if product requirements allow same-site deployment patterns.

## 8. Monitoring and audit

- **Audit log** (`record_audit`): logins, impersonation, failed logins, gateway secret rotation, failed device ingest.
- **Automation logs** (existing): enrichment, gateway arbitration, deduplication.
- **Operational alerts:** combine audit queries (failed `device.ingest_auth_failed` bursts), gateway **last_seen** (existing status API), and infra metrics (5xx, latency).

## 9. Deployment checklist for IT

1. Terminate TLS at load balancer / CDN; forward **`X-Forwarded-Proto: https`**.
2. Set **`REQUIRE_HTTPS=true`** on the API.
3. Set **`TRUSTED_HOSTS`** to your API hostnames.
4. Set strong **`SECRET_KEY`** and database credentials via **secrets manager** or env injection — never commit `.env`.
5. Restrict **`CORS_ORIGINS`** to known Pulse and marketing origins (each hostname is a separate Origin). **`PULSE_APP_PUBLIC_URL`** must be the **Pulse web app** URL users open in the browser (for example `https://pulse.helixsystems.ca`), **not** the API hostname (`…onrender.com`). The API merges `scheme://host` from that setting into the CORS allow list; if it points at the API, browsers will report *“blocked by CORS… No `Access-Control-Allow-Origin`”* when the SPA calls the API.
6. Run DB migrations through **`0033`** so gateway ingest hashes exist.
7. Rotate gateway secrets after provisioning; disable decommissioned gateways in UI (future: explicit revoke flag).

## 10. Risk summary

| Risk | Mitigation |
|------|------------|
| BLE spoofing | Whitelist + optional manufacturer data checks on gateway; server maps MAC → registered tags only. |
| Stolen gateway secret | Rotate secret; rate limits; audit; short TLS cert lifetimes on server. |
| Credential stuffing | Login rate limits + failed-login audit. |
| Cleartext HTTP | `REQUIRE_HTTPS` + HSTS at edge. |
| Over-broad CORS | Explicit allow-lists + optional origin regex. |

This design is intended to be **easy to approve**: devices behave like **standard corporate IoT clients** (outbound 443 only), with **no inbound exposure** of the facility network to the cloud.
