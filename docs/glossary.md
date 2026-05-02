# Helix Systems / Operations Intelligence — Codebase Glossary

Structured reference for major **frontend** surfaces, **backend** HTTP modules, **database** entities, and **cross-cutting systems**. Paths are relative to the repo root unless noted.

---

## Core feature systems (end-to-end)

### Projects (Pulse)

**Flow:** Tenant users create and manage **Pulse projects** (`pulse_projects`) with tasks, automation rules, and activity. The **frontend** `ProjectsApp` / `ProjectDetailApp` call **`/api/v1/projects`** (and nested task routes). **Backend** logic lives in `backend/app/api/projects_routes.py`, task router in the same module, and `backend/app/modules/pulse/project_service.py` for orchestration.

**Tables:** `pulse_projects`, `pulse_project_tasks`, `pulse_project_automation_rules`, related activity/hidden-field migrations.

---

### Scheduling (Pulse + Xplor)

**Flow:** **In-app scheduling** (shifts, assignments, definitions, periods, availability, acknowledgements) is exposed primarily through **`backend/app/modules/pulse/router.py`** under **`/api/v1/pulse/schedule/*`**. The **frontend** uses `ScheduleApp`, schedule pages under `frontend/app/schedule/`, and dashboard maintenance variants. A separate **read-only facility schedule** integration uses **`backend/app/api/routes_schedule.py`** → **`GET /api/schedule`** (Xplor-backed, `backend/app/services/xplor_client.py`). Internal/cron-style hooks may use `schedule_internal_routes.py`.

**Tables:** `pulse_schedule_shifts`, `pulse_schedule_assignments`, shift definitions/periods/availability (see `pulse_models.py` / Alembic `0077_*`, `0078_*`).

---

### Logs & inspections

**Flow:** **Compliance** records and rules (`ComplianceApp`, compliance dashboard) use **`backend/app/api/compliance_routes.py`** (`/api` prefix) and domain compliance models. **Maintenance logs** tie to `MaintenanceLog` and equipment CMMS flows (`equipment_routes`, PM tasks). **System / audit** visibility uses `SystemLog`, `AuditLog`, and **`backend/app/api/system_routes.py`** for admin operations.

**Tables:** `compliance_rules`, `compliance_records`, `maintenance_logs`, `system_logs`, `audit_logs` (exact names per `domain.py`).

---

### Work requests

**Flow:** Two HTTP surfaces exist: (1) **`backend/app/api/work_requests_routes.py`** — router prefix **`/work-requests`**, app mount **`/api`** → **`/api/work-requests`** (extended comments, activity, settings). (2) **`backend/app/modules/pulse/router.py`** (router prefix **`/pulse`**, mount **`/api/v1`**) — **`/api/v1/pulse/work-requests`** for the Pulse tenant dashboard (list/create/patch/delete, aligned with `PulseWorkRequest` ORM). **Frontend** maintenance/overview surfaces may use this; **`WorkRequestsApp`** uses **`/api/work-requests`** via `workRequestsService.ts`.

**Tables:** `pulse_work_requests` plus comment/activity/settings child tables in `pulse_models.py`.

---

### Inventory

**Flow:** **Pulse inventory** CRUD and low-stock paths on **`/api/v1/pulse/inventory`** in `pulse/router.py`. **Inventory portal** additions: **`backend/app/api/inventory_portal_routes.py`** mounted at **`/api`**. **Frontend** `InventoryApp` and dashboard inventory page.

**Tables:** `inventory_items`, job links (`job_inventory_links`).

---

### Drawings / facility maps / infrastructure graph

**Flow:** **Facility maps** store a base **image** plus **blueprint-style overlay JSON** (`FacilityMap` → **`/api/maps`** in `map_routes.py`). The **infrastructure overlay** (assets, connections, attributes, trace) scopes to **`project_id`** + **`map_id`** via **`/api/assets`**, **`/api/connections`**, **`/api/attributes`**, **`/api/trace-route`** in `infrastructure_map_routes.py`. **Frontend** `DrawingsPage`, `CanvasWrapper`, `useInfrastructureGraph`, Konva in `BlueprintReadOnlyCanvas` / `GraphOverlay` / `MapSemanticDrawLayer`.

**Tables:** `facility_maps`, `infra_assets`, `infra_connections`, `infra_attributes`.

---

### Zones / devices / blueprints (legacy vs Pulse)

**Flow:** **Floor-plan blueprints** (tenant blueprint documents) → **`/api/blueprints`** (`blueprint_routes.py`, models `Blueprint`, `BlueprintElement`). **Device hub** (gateways, BLE, ingest) → **`devices_routes`**, **`device_ingest_routes`**, **`gateway_register_routes`**. **Zones** for scheduling facilities appear in Pulse at **`/api/v1/pulse/zones`** and **`/api/v1/pulse/schedule-facilities`**. **Frontend** `zones-devices` app, `FloorPlanBlueprintSection`, `EquipmentApp`, etc.

**Tables:** `blueprints`, `blueprint_elements`, `zones`, automation device hub tables (`automation_gateways`, `automation_ble_devices`, …).

---

### Equipment & maintenance (PM)

**Flow:** **Facility equipment** registry **`/api/v1/equipment`** (`equipment_routes.py`). **PM tasks / tools / plans** → `pm_task_routes`, `pm_plans_routes`, internal PM router. **Maintenance hub** procedures UI → `maintenance_hub_routes.py`. **Frontend:** `EquipmentApp`, `EquipmentDetailApp`, `PreventativeMaintenanceApp`, `WorkOrdersMaintenanceApp`, `ProceduresApp`.

**Tables:** `facility_equipment`, `equipment_parts`, `pm_tasks`, related PM migrations.

---

## Frontend — pages (`frontend/app`)

Next.js **App Router** pages below; each **Type:** page, **Location:** as listed.

### `frontend/app/page.tsx`

**Type:** page  
**Location:** `frontend/app/page.tsx`  
**Purpose:** Root marketing or entry route for the public site shell.  
**Inputs:** None (static/SSR content).  
**Outputs:** Renders landing/navigation into the product.  
**Dependencies:** Layout, global styles.  
**Used By:** Browser `/`.  
**Notes:** Pair with `frontend/app/layout.tsx` for global providers.

---

### `frontend/app/login/page.tsx`

**Type:** page  
**Location:** `frontend/app/login/page.tsx`  
**Purpose:** Pulse user sign-in; obtains JWT/session for `apiFetch` / `NEXT_PUBLIC_API_URL`.  
**Inputs:** User credentials (form).  
**Outputs:** Writes session (`pulse-session`), redirects into app.  
**Dependencies:** `frontend/lib/api.ts`, `frontend/lib/pulse-session.ts`, auth API.  
**Used By:** Unauthenticated users.  
**Notes:** `NEXT_PUBLIC_USE_MOCK_AUTH` bypasses real API when set.

---

### `frontend/app/overview/page.tsx`

**Type:** page  
**Location:** `frontend/app/overview/page.tsx`  
**Purpose:** Supervisor **operations overview** dashboard after login.  
**Inputs:** Session, optional query.  
**Outputs:** `OperationalDashboard`, `DashboardViewTabs`.  
**Dependencies:** `@/components/dashboard/*`, Pulse APIs.  
**Used By:** `/overview`.  
**Notes:** Coordinates with `WelcomeLoaderModal` / readiness flags in page source.

---

### `frontend/app/worker/page.tsx`

**Type:** page  
**Location:** `frontend/app/worker/page.tsx`  
**Purpose:** Field **worker** dashboard variant (paired with overview tabs).  
**Inputs:** Session.  
**Outputs:** Worker-scoped dashboard shell.  
**Dependencies:** `DashboardViewTabs`, dashboard components.  
**Used By:** `/worker`.

---

### `frontend/app/pulse/page.tsx`

**Type:** page  
**Location:** `frontend/app/pulse/page.tsx`  
**Purpose:** Marketing **product** landing sections (hero, features).  
**Inputs:** None.  
**Outputs:** Static feature sections from `@/components/pulse`.  
**Used By:** `/pulse`.  
**Notes:** Not the authenticated CMMS shell; separate from `/dashboard/*`.

---

### `frontend/app/drawings/(main)/page.tsx` & `frontend/app/drawings/fullscreen/page.tsx`

**Type:** page  
**Location:** `frontend/app/drawings/(main)/page.tsx`, `frontend/app/drawings/fullscreen/page.tsx`  
**Purpose:** **Infrastructure map builder** — project/map picker, Konva canvas, graph overlays, tool rails, right inspector.  
**Inputs:** `fullscreen` optional prop on fullscreen route; URL state.  
**Outputs:** Renders `DrawingsPage`.  
**Dependencies:** `DrawingsPage.tsx`, `/api/maps`, `/api/assets`, etc.  
**Used By:** `/drawings`, `/drawings/fullscreen`.  
**Notes:** `useInfrastructureGraph` scopes graph to `map_id`.

---

### `frontend/app/projects/page.tsx` & `frontend/app/projects/[id]/page.tsx`

**Type:** page  
**Location:** `frontend/app/projects/page.tsx`, `frontend/app/projects/[id]/page.tsx`  
**Purpose:** **Project list** and **project detail** (tasks, automation, activity).  
**Inputs:** Dynamic `[id]` segment.  
**Outputs:** `ProjectsApp`, `ProjectDetailApp`.  
**Dependencies:** `/api/v1/projects` APIs.  
**Used By:** `/projects`, `/projects/:id`.

---

### `frontend/app/schedule/page.tsx` (+ `availability`, `availability-grid`, `shift-definitions`)

**Type:** page  
**Location:** `frontend/app/schedule/*`  
**Purpose:** Scheduling UI surfaces (calendar, availability, definitions).  
**Inputs:** Query params, session.  
**Outputs:** `ScheduleApp` and related schedule components.  
**Dependencies:** `/api/v1/pulse/schedule/*`, sometimes **`/api/schedule`** for Xplor read model.  
**Used By:** `/schedule` subtree.

---

### `frontend/app/dashboard/*` (inventory, workers, work-requests, maintenance, procedures, compliance, organization, profile-settings, team-insights, break-room, setup)

**Type:** page(s)  
**Location:** `frontend/app/dashboard/**/page.tsx`  
**Purpose:** Authenticated **Pulse dashboard** modules under a shared `dashboard/layout.tsx`.  
**Inputs:** Session, feature flags, route params.  
**Outputs:** Feature-specific `*App.tsx` components.  
**Dependencies:** Dashboard shell, `apiFetch`, tenant nav config.  
**Used By:** Role-based navigation to `/dashboard/...`.  
**Notes:** `maintenance/procedures` may redirect to `/dashboard/procedures` (legacy URL).

---

### `frontend/app/equipment/page.tsx` & `frontend/app/equipment/[id]/page.tsx`

**Type:** page  
**Location:** `frontend/app/equipment/*.tsx`  
**Purpose:** **Equipment registry** list and **equipment detail** (PM, parts, WR links).  
**Inputs:** `[id]` for detail.  
**Outputs:** `EquipmentApp`, `EquipmentDetailApp`.  
**Dependencies:** `/api/v1/equipment`.  
**Used By:** `/equipment`, `/equipment/:id`.

---

### `frontend/app/zones-devices/page.tsx` (+ `blueprint`, `zones` nested routes)

**Type:** page  
**Location:** `frontend/app/zones-devices/**`  
**Purpose:** **Zones & devices** planning UI (floor plans, blueprints).  
**Inputs:** Session, project context.  
**Outputs:** Blueprint canvas sections, zone lists.  
**Dependencies:** `/api/blueprints`, device APIs as used by components.  
**Used By:** `/zones-devices/*`.

---

### `frontend/app/operations/page.tsx`, `frontend/app/monitoring/page.tsx`, `frontend/app/live-map/page.tsx`

**Type:** page  
**Location:** respective `page.tsx`  
**Purpose:** **Operations** center, **monitoring** dashboards, **live map** telemetry views.  
**Inputs:** Session, API filters.  
**Outputs:** `OperationsApp`, `MonitoringApp`, live map widgets.  
**Dependencies:** `operations_routes`, `monitoring_routes`, `telemetry_positions_routes`, etc.  
**Used By:** Top-level app routes.

---

### `frontend/app/system/*` (users, companies, logs)

**Type:** page  
**Location:** `frontend/app/system/**`  
**Purpose:** **System administrator** UI (tenant users, companies, logs).  
**Inputs:** System-admin session.  
**Outputs:** Admin tables, impersonation entry points.  
**Dependencies:** `/api/system/*`, `/api/v1/users`, auth.  
**Used By:** `/system/*`.  
**Notes:** Uses bearer rules in `api.ts` for `/api/system` vs impersonation overlay.

---

### `frontend/app/settings/page.tsx`, `frontend/app/invite/page.tsx`, `frontend/app/join/page.tsx`, `frontend/app/reset-password/page.tsx`

**Type:** page  
**Location:** each `page.tsx`  
**Purpose:** **Tenant settings**, **invite** flow, **join** accept, **password reset**.  
**Inputs:** Tokens, forms.  
**Outputs:** Updates user/org state via APIs.  
**Dependencies:** Auth routes, org routes.  
**Used By:** Public/semi-public onboarding flows.

---

### Kiosk routes (`frontend/app/kiosk/*`)

**Type:** page  
**Location:** `frontend/app/kiosk/**`  
**Purpose:** Simplified **kiosk** UIs (worker overview, break room).  
**Inputs:** Kiosk layout wrapper.  
**Outputs:** Large-touch friendly panels.  
**Dependencies:** Shared dashboard data hooks.  
**Used By:** `/kiosk/*`.

---

## Frontend — major components (`frontend/components`)

### `WorkRequestsApp`

**Type:** component  
**Location:** `frontend/components/work-requests/WorkRequestsApp.tsx`  
**Purpose:** Full **work request** queue, filters, detail drawer, SLA/settings when enabled.  
**Inputs:** Session, `NEXT_PUBLIC_*`, route context.  
**Outputs:** Mutations to WR APIs, list refresh.  
**Dependencies:** `frontend/lib/workRequestsService.ts` → **`/api/work-requests`**; dropdowns also call **`/api/v1/pulse/zones`**, **`/api/v1/pulse/assets`**, **`/api/v1/pulse/workers`**; org module settings.  
**Used By:** `frontend/app/dashboard/work-requests/page.tsx`, maintenance WR pages.  
**Notes:** Issue-tracking REST is **`/api/work-requests`**, separate from **`/api/v1/pulse/work-requests`** on the Pulse router.

---

### `ProjectsApp` / `ProjectDetailApp`

**Type:** component  
**Location:** `frontend/components/projects/ProjectsApp.tsx`, `ProjectDetailApp.tsx`  
**Purpose:** **Project** portfolio and **per-project** task board, automation, documents.  
**Inputs:** Project id (detail), session.  
**Outputs:** CRUD on `/api/v1/projects` (+ tasks).  
**Dependencies:** Projects API schemas (TypeScript inferred or local types).  
**Used By:** `/projects` routes.

---

### `ScheduleApp`

**Type:** component  
**Location:** `frontend/components/schedule/ScheduleApp.tsx`  
**Purpose:** Manager scheduling UI (shifts, assignments, modals).  
**Inputs:** Company/facility context.  
**Outputs:** Calls Pulse schedule endpoints.  
**Dependencies:** `/api/v1/pulse/schedule/*`.  
**Used By:** Schedule pages.

---

### `InventoryApp`

**Type:** component  
**Location:** `frontend/components/inventory/InventoryApp.tsx`  
**Purpose:** **Stock** levels, edits, low-stock alerts.  
**Inputs:** Session.  
**Outputs:** PATCH inventory rows.  
**Dependencies:** `/api/v1/pulse/inventory`.  
**Used By:** Dashboard inventory page.

---

### `EquipmentApp` / `EquipmentDetailApp`

**Type:** component  
**Location:** `frontend/components/equipment/EquipmentApp.tsx`, `EquipmentDetailApp.tsx`  
**Purpose:** **Asset registry** and **deep** equipment profile (WO, PM, parts).  
**Inputs:** Optional equipment id.  
**Outputs:** Equipment CRUD, linked WR/PM actions.  
**Dependencies:** `/api/v1/equipment`, PM routes.  
**Used By:** `/equipment` routes.

---

### `InspectionsLogsApp` / `LogBuilder` / `InspectionBuilder`

**Type:** component  
**Location:** `frontend/components/inspections-logs/*`  
**Purpose:** **Inspections / logs** capture and builder flows (tenant compliance logging).  
**Inputs:** Forms, templates.  
**Outputs:** Posts to compliance or related APIs (check imports in builders).  
**Dependencies:** Compliance API, shared `app-field` styling (`globals.css`).  
**Used By:** Compliance or logs dashboard entries.

---

### `ComplianceApp`

**Type:** component  
**Location:** `frontend/components/compliance/ComplianceApp.tsx`  
**Purpose:** **Compliance** program UI (rules, records, harness forms).  
**Inputs:** Session.  
**Outputs:** `/api` compliance mutations.  
**Dependencies:** `compliance_routes.py` client calls.  
**Used By:** `/dashboard/compliance`.

---

### `OperationsApp` / `MonitoringApp`

**Type:** component  
**Location:** `frontend/components/operations/OperationsApp.tsx`, `frontend/components/monitoring/MonitoringApp.tsx`  
**Purpose:** **Ops** dashboards and **sensor/monitoring** alerts.  
**Inputs:** Filters, time ranges.  
**Outputs:** `operations_routes`, `monitoring_routes` data.  
**Dependencies:** Monitoring models on backend.  
**Used By:** `/operations`, `/monitoring`.

---

### `WorkersApp` / `TeamInsightsApp` / `ProfileSettingsApp`

**Type:** component  
**Location:** `frontend/components/workers/WorkersApp.tsx`, `frontend/components/team/TeamInsightsApp.tsx`, `frontend/components/profile/ProfileSettingsApp.tsx`  
**Purpose:** **HR/worker** directory, **team analytics**, **user profile** settings.  
**Inputs:** Session, roles.  
**Outputs:** Pulse worker/profile APIs, insights endpoints.  
**Dependencies:** **`/api/v1/pulse/workers`**; **`/api/v1/team/*`** (`team_insights_routes.py`, prefix `/team`); **`/api/v1/users/*`** (`worker_profile_routes.py`); **`/api/v1/profile/*`** (`profile_routes.py`).  
**Used By:** Dashboard workers, team-insights, profile-settings pages.

---

### `ProceduresApp` / `PreventativeMaintenanceApp` / `WorkOrdersMaintenanceApp`

**Type:** component  
**Location:** `frontend/components/procedures/ProceduresApp.tsx`, `frontend/components/maintenance/*.tsx`  
**Purpose:** **SOP/procedures** library, **PM** planning, **work orders** maintenance hub.  
**Inputs:** Session, facility context.  
**Outputs:** `maintenance_hub_routes`, PM routes.  
**Dependencies:** Pulse maintenance models.  
**Used By:** Dashboard maintenance subtree.

---

### `SetupApp` / `ConfigPanel`

**Type:** component  
**Location:** `frontend/components/setup/SetupApp.tsx`, `frontend/components/setup/ConfigPanel.tsx`  
**Purpose:** **Tenant setup** wizard and **config** saves.  
**Inputs:** Setup progress from API.  
**Outputs:** `setup_progress_routes`, `config_routes`.  
**Used By:** `/dashboard/setup`.

---

### `DrawingsPage` (+ `CanvasWrapper`, `MiniToolRail`, `DrawingCanvasToolbar`, hooks)

**Type:** component / system UI  
**Location:** `frontend/drawings/DrawingsPage.tsx`, `frontend/drawings/components/*`, `frontend/drawings/hooks/*`  
**Purpose:** **Facility map** editor: maps list, image upload, Konva **blueprint** + **graph** overlay, semantic draw tools, **infrastructure** API sync.  
**Inputs:** `fullscreen` prop, project/map selection, `useInfrastructureGraph(projectId, mapId)`.  
**Outputs:** PUT `/api/maps/:id`, POST/PATCH `/api/assets`, `/api/connections`, attributes.  
**Dependencies:** `BlueprintReadOnlyCanvas`, `GraphOverlay`, `MapSemanticDrawLayer`, `useBuilderMode`, `mapBuilderModes.ts`.  
**Used By:** Drawings pages.  
**Notes:** `FacilityMap.project_id` scopes maps; graph APIs require consistent `map_id` query.

---

### `Button` / `buttonVariants` / `BlueprintReadOnlyCanvas`

**Type:** component / design system / canvas primitive  
**Location:** `frontend/components/ui/Button.tsx`, `frontend/styles/button-variants.ts`, `frontend/components/zones-devices/BlueprintReadOnlyCanvas.tsx`  
**Purpose:** Shared **UI button** styles; **Konva** stage for blueprints/maps (pan/zoom/fit ref, wheel zoom, external base image).  
**Inputs:** Props per file (`interactionMode`, `ref` for viewport handle on canvas).  
**Outputs:** DOM/Konva; imperative `zoomIn` / `zoomOut` / `resetFit`.  
**Dependencies:** `react-konva`, Tailwind tokens.  
**Used By:** App-wide (Button); drawings + zones blueprints (canvas).

---

## Frontend — libraries & client infra

### `apiFetch` / `api.ts`

**Type:** system  
**Location:** `frontend/lib/api.ts`  
**Purpose:** Central **HTTP client** to backend: base URL, bearer token (session vs impersonation overlay), JSON parse, 401 handling.  
**Inputs:** URL path, method, optional JSON body.  
**Outputs:** Typed JSON or blob-friendly helpers; redirects on session expiry.  
**Dependencies:** `NEXT_PUBLIC_API_URL`, `pulse-session`, `impersonation-overlay-token`.  
**Used By:** Nearly all feature modules.  
**Notes:** `isApiMode()` false when API URL missing or mock auth.

---

### `pulse-session`

**Type:** system  
**Location:** `frontend/lib/pulse-session.ts` (and related)  
**Purpose:** Browser **session** storage for Pulse JWT and user payload.  
**Inputs:** Login response / refresh.  
**Outputs:** `readSession`, `writeApiSession`, `clearSession`.  
**Dependencies:** Auth endpoints.  
**Used By:** Layouts, `apiFetch`, route guards.

---

## Backend — API routers (`backend/app/api` + `backend/app/modules`)

Mount **prefixes** from `backend/app/main.py` are authoritative (e.g. `map_router` → `/api` + router internal `/maps` → **`/api/maps`**).

### `auth_routes.py`

**Type:** API route module  
**Location:** `backend/app/api/auth_routes.py`  
**Purpose:** **Login**, password reset accept, **impersonation** (system admin), **`/auth/me`**, effective permissions.  
**Inputs:** JSON bodies (`LoginRequest`, etc.), bearer tokens.  
**Outputs:** JWT, `UserOut`, audit/system logs on sensitive actions.  
**Dependencies:** `app/core/auth/security.py`, `User`, `Company`, `Invite`, `PermissionService`.  
**Used By:** Frontend login, session bootstrap.  
**Notes:** Mounted at **`/api/v1`** + router prefix `/auth` → `/api/v1/auth/...`.

---

### `map_routes.py`

**Type:** API route module  
**Location:** `backend/app/api/map_routes.py`  
**Purpose:** **Facility maps** CRUD — image URL, elements JSON, layers, tasks; scoped by company and optional `pulse_projects` FK.  
**Inputs:** Query `project_id`, JSON `MapCreateIn` / `MapUpdateIn`.  
**Outputs:** `MapDetailOut`, list summaries.  
**Dependencies:** `FacilityMap`, `PulseProject` existence checks, onboarding sync.  
**Used By:** `DrawingsPage`, any client of `/api/maps`.  
**Notes:** Router prefix **`/maps`**; full path **`/api/maps`**.

---

### `infrastructure_map_routes.py`

**Type:** API route module  
**Location:** `backend/app/api/infrastructure_map_routes.py`  
**Purpose:** **Infra graph** assets, connections, attributes, **trace-route** graph walk.  
**Inputs:** Query `project_id` & `map_id` (enforced for ownership), JSON create/patch bodies.  
**Outputs:** `InfraAssetOut`, `InfraConnectionOut`, `TraceRouteOut`.  
**Dependencies:** `InfraAsset`, `InfraConnection`, `InfraAttribute`, `FacilityMap`.  
**Used By:** `useInfrastructureGraph`, drawings canvas.  
**Notes:** Paths **`/api/assets`**, **`/api/connections`**, **`/api/attributes`**, **`/api/trace-route`** (no extra prefix on router).

---

### `blueprint_routes.py`

**Type:** API route module  
**Location:** `backend/app/api/blueprint_routes.py`  
**Purpose:** Legacy-style **blueprint documents** (elements, layers) tied to projects.  
**Inputs:** Blueprint CRUD payloads.  
**Outputs:** `BlueprintDetailOut`, element rows.  
**Dependencies:** `Blueprint`, `BlueprintElement`, `PulseProject`.  
**Used By:** Zones-devices / floor plan UI.  
**Notes:** **`/api/blueprints`**; distinct from `facility_maps` used by drawings module.

---

### `work_requests_routes.py`

**Type:** API route module  
**Location:** `backend/app/api/work_requests_routes.py`  
**Purpose:** Extended **work request** API (comments, activity, settings, priorities).  
**Inputs:** Path ids, JSON patches.  
**Outputs:** Work request DTOs,204 deletes.  
**Dependencies:** `PulseWorkRequest` + related tables, `event_engine` for domain events.  
**Used By:** `WorkRequestsApp` (verify `apiFetch` paths in file).  
**Notes:** **`/api/work-requests`**.

---

### `pulse/router.py` (module)

**Type:** API route module  
**Location:** `backend/app/modules/pulse/router.py`  
**Purpose:** Large **Pulse CMMS** surface: dashboard, work requests, workers, **schedule** (shifts/assignments/definitions/periods/availability/ack), zones, **inventory**, assets (tools), photos, etc.  
**Inputs:** Tenant-scoped JWT, JSON bodies per handler.  
**Outputs:** Pydantic `*Out` models, file streams for avatars/photos.  
**Dependencies:** `pulse_svc`, SQLAlchemy models in `pulse_models.py`, onboarding/gamification side effects.  
**Used By:** Most dashboard pages via **`/api/v1/...`**.  
**Notes:** Mounted at **`/api/v1`** with router prefix **`/pulse`** → e.g. **`/api/v1/pulse/dashboard`**, **`/api/v1/pulse/work-requests`**, **`/api/v1/pulse/schedule/...`**.

---

### `projects_routes.py` (+ tasks router)

**Type:** API route module  
**Location:** `backend/app/api/projects_routes.py`  
**Purpose:** **Pulse projects** REST (metadata, tasks, automation, activity) separate from monolithic pulse router slices.  
**Inputs:** Project id routes, task payloads.  
**Outputs:** Project/task JSON.  
**Dependencies:** `PulseProject`, `PulseProjectTask`, project services.  
**Used By:** `ProjectsApp`, `ProjectDetailApp`.  
**Notes:** Mounted under **`/api/v1`** (see `main.py` for `projects_router` vs `projects_tasks_router`).

---

### `equipment_routes.py`, `devices_routes.py`, `device_ingest_routes.py`, `gateway_register_routes.py`

**Type:** API route module(s)  
**Location:** `backend/app/api/*.py` (as named)  
**Purpose:** **Equipment** registry; **device** catalog; **ingest** pipelines; **gateway** registration for automation hub.  
**Inputs:** Multipart or JSON per route.  
**Outputs:** Equipment/device DTOs, ingest acknowledgements.  
**Dependencies:** `FacilityEquipment`, device hub models, automation services.  
**Used By:** Equipment pages, device admin, gateway hardware.

---

### `compliance_routes.py`, `maintenance_hub_routes.py`, `pm_task_routes.py`, `pm_plans_routes.py`

**Type:** API route module(s)  
**Location:** `backend/app/api/*.py`  
**Purpose:** **Compliance** checks; **maintenance hub** procedures; **PM task** execution and **PM plans**.  
**Inputs:** Route-specific bodies.  
**Outputs:** Compliance records; procedure revisions; PM task state.  
**Dependencies:** Compliance + PM ORM tables, `pm_task_service.py`.  
**Used By:** Compliance and maintenance dashboard modules.

---

### `operations_routes.py`, `monitoring_routes.py`, `telemetry_*_routes.py`

**Type:** API route module(s)  
**Location:** `backend/app/api/operations_routes.py`, `monitoring_routes.py`, `telemetry_ingest_routes.py`, `telemetry_positions_routes.py`  
**Purpose:** **Operations** summaries; **monitoring** alerts/facilities; **telemetry** ingest and **positions**.  
**Inputs:** Queries, ingest payloads.  
**Outputs:** Ops/monitoring DTOs; stored readings/positions.  
**Dependencies:** Monitoring models, ingest helpers.  
**Used By:** Operations and monitoring frontends.

---

### `organization_routes.py`, `company_routes.py`, `org_module_settings_routes.py`, `users_routes.py`, `admin_routes.py`

**Type:** API route module(s)  
**Location:** `backend/app/api/*.py`  
**Purpose:** **Tenant org** profile, **company** admin, **module settings**, **tenant users**, **admin** utilities.  
**Inputs:** JSON patches, role assignments.  
**Outputs:** Org/company/user DTOs.  
**Dependencies:** `Company`, `User`, `PulseOrgModuleSettings`, RBAC.  
**Used By:** Organization dashboard, system users UI.

---

### `notifications_routes.py`, `notification_internal_routes.py`

**Type:** API route module(s)  
**Location:** `backend/app/api/notifications_routes.py`, `notification_internal_routes.py`  
**Purpose:** User-facing **notifications** and **internal** dispatch hooks.  
**Inputs:** List/mark-read; internal auth.  
**Outputs:** Notification rows; delivery side effects.  
**Dependencies:** `notification_service.py`, notification engine migrations.  
**Used By:** Bell/feed UI, background jobs.

---

### `gamification_routes.py`, `onboarding_routes.py`, `setup_progress_routes.py`, `team_insights_routes.py`, `worker_profile_routes.py`

**Type:** API route module(s)  
**Location:** `backend/app/api/*.py`  
**Purpose:** **XP/badges**, **onboarding** steps, **setup progress**, **team insights**, **worker profiles** (skills, scheduling prefs).  
**Inputs:** JSON per feature.  
**Outputs:** Gamification state, onboarding flags, insights aggregates.  
**Dependencies:** `gamification_service.py`, `onboarding_service.py`, `pulse_worker_profile` tables.  
**Used By:** Dashboard widgets, profile, onboarding modals.

---

### `search_routes.py`, `proximity_routes.py`, `core_routes.py`, `demo_routes.py`, `public_routes.py`, `system_routes.py`

**Type:** API route module(s)  
**Location:** `backend/app/api/*.py`  
**Purpose:** **Search** across entities; **proximity** events; **core** health/misc; **demo** seed; **`/api/public/contact`**; **system admin** company/user lifecycle.  
**Inputs:** Varies.  
**Outputs:** JSON; email send for public contact.  
**Dependencies:** SMTP settings, system admin deps.  
**Used By:** Global search UI; marketing site; system shell.

---

### `routes_schedule.py` (Xplor)

**Type:** API route module  
**Location:** `backend/app/api/routes_schedule.py`  
**Purpose:** **External schedule** read model via Xplor client + cache.  
**Inputs:** `facility_id`, `date` query.  
**Outputs:** `ScheduleEvent` list.  
**Dependencies:** `XplorClient`, `transform_xplor_schedule`.  
**Used By:** Schedule pages that show external facility calendars.  
**Notes:** **`GET /api/schedule`**, **`/api/schedule/live`**.

---

### `realtime.py`

**Type:** API route module  
**Location:** `backend/app/api/realtime.py`  
**Purpose:** **Realtime** channel setup (WebSocket/SSE patterns as implemented).  
**Inputs:** Connection params.  
**Outputs:** Streaming or upgrade responses.  
**Dependencies:** App settings, auth.  
**Used By:** Live dashboards when wired on frontend.  
**Notes:** Inspect `realtime.py` for concrete paths; mounted under **`/api/v1`** in `main.py`.

---

## Backend — services (`backend/app/services`)

Selected **service** modules (not exhaustive; grep `app/services` for full list):

| Name | Location | Purpose |
|------|----------|---------|
| `automation/event_processor.py`, `ingest_pipeline.py`, `actions.py` | `backend/app/services/automation/` | Process **automation events**, device ingest, configured **actions**. |
| `pm_task_service.py`, `pm_plan_service.py` | `backend/app/services/` | **PM task** lifecycle and **PM plan** materialization. |
| `gamification_service.py`, `xp_grant.py`, `badge_engine.py` | `backend/app/services/` | **XP**, **badges**, task linkage to WRs. |
| `onboarding_service.py` | `backend/app/services/onboarding_service.py` | **Onboarding** step completion, sync from “reality”. |
| `notification_service.py` | `backend/app/services/notifications/` | **Notification** creation/dispatch. |
| `devices/device_service.py` | `backend/app/services/devices/` | **Device** registry operations. |
| `xplor_client.py` | `backend/app/services/xplor_client.py` | **Xplor** HTTP integration + cache for `/api/schedule`. |
| `schedule_facility_zones.py` | `backend/app/services/schedule_facility_zones.py` | Ensure **schedule facility** zone rows for scheduling UI. |

---

## Backend — core (`backend/app/core`)

| Name | Location | Purpose |
|------|----------|---------|
| `database.py` | `backend/app/core/database.py` | **Async SQLAlchemy** session factory (`AsyncSessionLocal`). |
| `config.py` | `backend/app/core/config.py` | **Pydantic settings** (CORS, SMTP, URLs, feature flags). |
| `auth/security.py` | `backend/app/core/auth/security.py` | **JWT** create/decode, password hash/verify. |
| `permissions/service.py` | `backend/app/core/permissions/` | **RBAC** resolution for users. |
| `tenant_feature_access.py`, `features/service.py` | `backend/app/core/` | **Tenant feature** contracts vs enabled modules. |
| `events/engine.py`, `events/types.py` | `backend/app/core/events/` | **Domain event** bus for side effects (WR, automation, etc.). |
| `inference/*` | `backend/app/core/inference/` | Rule-based **inference** jobs (maintenance due, proximity, etc.). |
| `audit/service.py`, `system_audit.py` | `backend/app/core/` | **Audit** trails for tenant and system actions. |

---

## Database — ORM models & tables

Alembic migrations live in **`backend/alembic/versions/`**. ORM definitions in **`backend/app/models/`**. Table names below match **`__tablename__`** where present.

### `FacilityMap` (`facility_maps`)

**Type:** model  
**Location:** `backend/app/models/facility_map_models.py`  
**Purpose:** Stores **facility map** metadata, **image_url**, **elements_json** / layers / tasks for the drawings experience.  
**Inputs:** SQL insert/update from `map_routes`.  
**Outputs:** Rows keyed by `id`, FK `company_id`, optional `project_id` → `pulse_projects`.  
**Dependencies:** `companies`, `pulse_projects`.  
**Used By:** `map_routes`, `infrastructure_map_routes` (map ownership).  
**Notes:** Distinct from blueprint documents table.

---

### `InfraAsset`, `InfraConnection`, `InfraAttribute` (`infra_assets`, `infra_connections`, `infra_attributes`)

**Type:** model  
**Location:** `backend/app/models/infrastructure_map_models.py`  
**Purpose:** **Graph nodes** (assets), **edges** (connections), **EAV attributes** for infrastructure map.  
**Inputs:** API create/patch.  
**Outputs:** JSON DTOs to frontend; trace uses connections + assets.  
**Dependencies:** `facility_maps`, `pulse_projects`, `companies`.  
**Used By:** `infrastructure_map_routes.py`, drawings hooks.

---

### `PulseProject`, `PulseProjectTask`, `PulseProjectAutomationRule`

**Type:** model  
**Location:** `backend/app/models/pulse_models.py`  
**Purpose:** **Project** header, **tasks**, and **automation** rules for Pulse PM/ops.  
**Inputs:** Projects API, pulse router.  
**Outputs:** Project lists, Gantt-style task payloads.  
**Dependencies:** `companies`, users.  
**Used By:** Projects UI, map/project FK validation.

---

### `PulseWorkRequest` (+ comments/activity/settings)

**Type:** model  
**Location:** `backend/app/models/pulse_models.py`  
**Purpose:** **Work request** issue tracking per tenant.  
**Inputs:** WR routes (dual surfaces).  
**Outputs:** List/detail DTOs.  
**Dependencies:** Users, zones, optional equipment links.  
**Used By:** WorkRequestsApp, gamification linkage.

---

### `PulseScheduleShift`, `PulseScheduleAssignment`, definitions/periods/availability

**Type:** model  
**Location:** `backend/app/models/pulse_models.py`  
**Purpose:** **Internal scheduling** domain (shifts published to workers, assignments, definitions, availability submissions).  
**Inputs:** Pulse schedule endpoints.  
**Outputs:** Shift/assignment JSON.  
**Dependencies:** Facilities/zones, worker profiles.  
**Used By:** ScheduleApp, pulse router schedule group.

---

### `FacilityEquipment`, `EquipmentPart`, `PmTask`, `MaintenanceLog`

**Type:** model  
**Location:** `backend/app/models/domain.py`, `backend/app/models/pm_models.py`  
**Purpose:** **Equipment** registry, **spare parts**, **PM tasks**, **maintenance logs**.  
**Inputs:** Equipment/PM routes.  
**Outputs:** CMMS payloads.  
**Dependencies:** Companies, zones, jobs.  
**Used By:** Equipment and maintenance UIs.

---

### `Blueprint`, `BlueprintElement` (`blueprints`, …)

**Type:** model  
**Location:** `backend/app/models/blueprint_models.py`  
**Purpose:** **Blueprint** documents for floor-plan style apps (pre–facility_maps or parallel product surface).  
**Inputs:** `blueprint_routes`.  
**Outputs:** Element geometry JSON.  
**Dependencies:** Projects/companies per schema.  
**Used By:** Zones-devices blueprint UI.

---

### `User`, `Company`, `Invite`, `RolePermission`, `CompanyFeature`

**Type:** model  
**Location:** `backend/app/models/domain.py`  
**Purpose:** **Multi-tenant identity**, **invites**, **RBAC**, **enabled features** per company.  
**Inputs:** Auth, system, org routes.  
**Outputs:** JWT claims inputs, admin DTOs.  
**Dependencies:** Auth security, permissions service.  
**Used By:** Entire platform.

---

### Automation & device hub (`AutomationEvent`, `AutomationGateway`, `AutomationBleDevice`, …)

**Type:** model  
**Location:** `backend/app/models/automation_engine.py`, `device_hub.py`  
**Purpose:** **Automation** config/state/logs and **physical gateway / BLE** inventory.  
**Inputs:** Ingest and config routes.  
**Outputs:** Events for processor, device status.  
**Dependencies:** Ingest pipeline, gateways.  
**Used By:** Device pages, automation debug routes.

---

### Monitoring (`MonitoringFacility`, `Sensor`, `MonitoringAlert`, …)

**Type:** model  
**Location:** `backend/app/models/monitoring_models.py`  
**Purpose:** **IoT-style monitoring** facilities, sensors, thresholds, alerts.  
**Inputs:** Monitoring routes, ingest.  
**Outputs:** Alert lists, sensor readings.  
**Dependencies:** Companies.  
**Used By:** MonitoringApp.

---

### Gamification (`UserStats`, `XpLedger`, `BadgeDefinition`, `UserBadge`, …)

**Type:** model  
**Location:** `backend/app/models/gamification_models.py`  
**Purpose:** **XP ledger**, **badges**, **reviews** for worker engagement.  
**Inputs:** Gamification routes, WR subscribers.  
**Outputs:** XP/badge DTOs.  
**Dependencies:** Users, tasks.  
**Used By:** Gamification widgets, `gamification_routes.py`.

---

## Systems (cross-cutting)

### Authentication & sessions

**Components:** `auth_routes.py`, `app/core/auth/security.py`, frontend `pulse-session` + `api.ts` bearer selection.  
**Behavior:** Login issues JWT; `apiFetch` attaches bearer; **system admin** may **impersonate** tenant via overlay token (see `api.ts` comments). **`/api/system`** always uses base session token.

---

### Multi-tenancy & RBAC

**Components:** `Company`, `User`, `RolePermission`, `PermissionService`, `FeatureGateMiddleware` (`main.py`), `tenant_feature_access`.  
**Behavior:** Requests carry **company** scope; routes use `get_current_company_user` / admin variants from `app/api/deps.py`.

---

### Domain events & automation

**Components:** `event_engine`, `AutomationEvent`, automation processor/ingest services.  
**Behavior:** WR transitions and device signals **emit events** that automation and notifications consume.

---

### Notifications engine

**Components:** `notifications_routes.py`, `notification_internal_routes.py`, `notification_service.py`, migration `0092_notif_engine`.  
**Behavior:** User notifications and internal triggers for SLA/engine rules.

---

## System relationships

1. **Browser** loads a Next.js **page** → layout wraps **`*App.tsx`** feature shell.  
2. **`*App.tsx`** calls **`apiFetch`** (`frontend/lib/api.ts`) against **`NEXT_PUBLIC_API_URL`**.  
3. **FastAPI** routes (`backend/app/main.py`) mount routers: public (`/api/public`), tenant (`/api`, `/api/v1`), system (`/api/system`).  
4. **Authenticated tenant** routes use **`get_db`** + **`get_current_company_user`** (`deps.py`) → **SQLAlchemy async** session → **ORM models** → PostgreSQL tables (Alembic-managed).  
5. **Pulse dashboard** data flows **`/api/v1/pulse/*`** (`pulse/router.py`) plus other **`/api/v1/*`** routers (e.g. **`/api/v1/projects`**, PM, gamification).  
6. **Drawings** flow: **`/api/maps`** (`FacilityMap` JSON) + **`/api/assets|connections|attributes|trace-route`** (`Infra*` tables), keyed by **`project_id`** + **`map_id`**.  
7. **Work requests:** extended REST at **`/api/work-requests`** (`WorkRequestsApp` via `workRequestsService`); Pulse CMMS list/detail at **`/api/v1/pulse/work-requests`** — use the path that matches the UI you are changing.  
8. **Side effects:** WR/automation changes go through **`event_engine`**; **onboarding** may advance via **`onboarding_service`**; **gamification** hooks sync from WR assignees.

---

## Maintenance

- When adding a feature, update this file **if** you introduce a new top-level route, model `__tablename__`, or user-visible system boundary.  
- For exhaustive HTTP path lists, generate OpenAPI from a running backend or grep `@router` in each `backend/app/api/*.py` and `backend/app/modules/pulse/router.py`.
