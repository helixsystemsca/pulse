# Helix Systems — codebase map

Living overview of **helixsystems-landing** (marketing + Pulse app), the **operations backend**, and suggested cleanups.

---

## Part 1 — Pulse app (by feature module)

Feature modules group routes, UI, and client libs that work together. Shared shell: `AppLayout` / `AppNavbar` / `AppSideNav` (`components/app/*`).

| Module | Route(s) | Primary UI / libs | Role |
|--------|----------|-------------------|------|
| **Auth & session** | `/login`, `/invite`, `/reset-password` | `app/login/*`, `app/invite/*`, `app/reset-password/*`, `lib/pulse-session.ts`, `lib/api.ts`, `middleware.ts` (Pulse host `/` → `/login`) | Sign-in, session storage, API bearer attachment |
| **Operations overview** | `/overview` | `app/overview/*`, `components/dashboard/OperationalDashboard.tsx` | Live/demo ops dashboard; `apiFetch("/api/v1/pulse/dashboard")` |
| **Schedule** | `/schedule` | `app/schedule/*`, `components/schedule/*`, `lib/schedule/*` | Shifts, calendar, Zustand store, workforce UI |
| **Compliance** | `/dashboard/compliance` | `app/dashboard/compliance/*`, `components/compliance/ComplianceApp.tsx`, `lib/complianceService.ts`, `hooks/useCompliance.ts` | SOP / acknowledgment analytics; ` /api/compliance` |
| **Work requests** | `/dashboard/work-requests` | `app/dashboard/work-requests/*`, `components/work-requests/WorkRequestsApp.tsx`, `lib/workRequestsService.ts` | Issue tracking; `/api/work-requests` (managers+; `company_id` for system admins) |
| **Workers & roles** | `/dashboard/workers` | `app/dashboard/workers/*`, `components/workers/WorkersApp.tsx`, `lib/workersService.ts` | Roster, HR, permission matrix; `/api/workers` |
| **Inventory** | `/dashboard/inventory` | `app/dashboard/inventory/*`, `components/inventory/InventoryApp.tsx`, `lib/inventoryService.ts` | Items, movements, WR usage; `/api/inventory` (managers+; `company_id` for system admins) |
| **Payments / billing** | `/dashboard/payments` | `app/dashboard/payments/*`, `components/payments/PaymentsApp.tsx`, `lib/paymentsService.ts`, `hooks/usePayments.ts` | Cards, banks, invoices (mock); `/api/payments` |
| **Dashboard shell** | `/dashboard/*` | `app/dashboard/layout.tsx` | Shared layout for dashboard sub-routes |
| **System administration** | `/system`, `/system/companies`, `/system/users`, `/system/logs`, `/system/companies/[id]` | `app/system/*`, `components/system/*` (if any), companies detail | System admin APIs `/api/system/*`; tenant picker patterns on some dashboards |
| **Pulse marketing (in-app)** | `/pulse` | `app/pulse/*`, `components/pulse/*` | Product story, feature sections, links with hash anchors (issue tracking, inventory, etc.) |

**Shared app infrastructure**

| Area | What it does |
|------|----------------|
| `lib/pulse-app.ts` | App/marketing origins, sidebar + top nav definitions, post-login paths |
| `lib/pulse-nav-active.ts` | Which sidebar item is active for current `pathname` |
| `lib/api-base-url.ts` | Normalizes `NEXT_PUBLIC_API_URL` |
| `lib/parse-client-api-error.ts` | Turns `apiFetch` errors into UI-friendly messages |
| `hooks/usePulseAuth.ts` | Subscribes to session changes |

---

## Part 2 — Backend (operations API)

Single FastAPI service under **`backend/`** (not the removed standalone `maintenance_system` tree).

| Layer | Contents | What it does |
|-------|-----------|--------------|
| **Entry** | `app/main.py` | App factory, CORS, middleware, router mount order |
| **HTTP — public** | `app/api/public_routes.py`, `schemas/contact.py` | Public/contact endpoints |
| **HTTP — v1** | `app/api/auth_routes.py`, `admin_routes.py`, `users_routes.py`, `core_routes.py`, `realtime.py` | Auth, admin, users, core, realtime (`/api/v1/...`) |
| **HTTP — system** | `app/api/system_routes.py`, `schemas/system_admin.py` | Companies, impersonation, logs, invites, feature catalog (`/api/system/...`) |
| **HTTP — top-level API** | `app/api/compliance_routes.py`, `app/api/payments_routes.py`, `app/api/work_requests_routes.py`, `app/api/workers_routes.py` | Compliance, payments, work requests, workers (`/api/compliance`, `/api/payments`, `/api/work-requests`, `/api/workers`) |
| **Deps & security** | `app/api/deps.py`, `app/core/auth/*` | JWT, `require_*` guards, DB session |
| **Config & DB** | `app/core/config.py`, `database.py`, `bootstrap.py` | Settings, async SQLAlchemy, bootstrap system admin |
| **Domain models** | `app/models/domain.py`, `pulse_models.py`, `models/__init__.py` | Tenants, users, RBAC, tools, jobs, inventory, **compliance**, **payments/invoices**, Pulse CMMS tables |
| **Pulse product** | `app/modules/pulse/router.py`, `service.py`, `schemas/pulse.py` | Dashboard aggregate, work requests, schedule, assets, inventory, equipment (`/api/v1/pulse/...`) |
| **Compliance logic** | `app/modules/compliance/service.py` | Aggregations, effective status, repeat offenders |
| **Other modules** | `modules/inventory`, `maintenance`, `analytics`, `notifications`, `tool_tracking`, `jobs` | Feature-flagged / auxiliary routers (see `registry.py`) |
| **Platform** | `app/core/events`, `inference`, `state`, `permissions`, `features`, `middleware/*` | Event bus, rules engine, RBAC templates, feature gates |
| **Migrations** | `backend/alembic/versions/` | Schema history (`0001` … `0009` payments, etc.) |

---

## Part 3 — Marketing landing page (by section)

The **home page** is `app/page.tsx`. Order and purpose:

| Order | Section component | Purpose |
|-------|--------------------|---------|
| — | `HelixNavbar` | Site nav |
| 1 | `CompanyHero` | Hero / company introduction |
| 2 | `HowWeWorkSection` | Process / how you work |
| 3 | `WhatWeBuildSection` (`id="products"`) | Products / capabilities |
| 4 | `PulsePreviewSection` | Pulse product preview |
| 5 | `ContactSection` (`id="contact"`) | Contact form / CTA |
| — | `HelixFooter` | Footer |

Supporting pieces: `components/site/*`, shared `app/layout.tsx`, `globals.css`, Tailwind `pulse` / `helix` tokens.

---

## Cleanups & decisions

### `maintenance_system/` (removed)

- **Status:** Standalone `maintenance_system/backend` + `frontend` were **not referenced** by `helixsystems-landing` or `backend/` (only self-references in its own README).
- **Decision:** Treated as an old or experimental slice. **Folder deleted** from this repo so you can reintroduce maintenance features cleanly on the main `backend` + Pulse app stack when ready.

### Optional follow-ups (from earlier audit)

| Item | Suggestion |
|------|------------|
| `components/app/index.ts` | Barrel exists; codebase mostly imports paths like `@/components/app/AppLayout`. Either use the barrel consistently or remove it to avoid two styles. |
| `parseClientApiError` | Already centralized in `lib/parse-client-api-error.ts`. |
| API path split | `/api` (compliance, payments) vs `/api/v1` (auth, pulse) is intentional; merging is a later refactor if you want one version prefix. |

---

*Last updated from repo layout review; adjust this file when you add modules or routes.*
