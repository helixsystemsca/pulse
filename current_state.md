# Scheduling System · Current State (for Claude)

This document summarizes **only** the scheduling / availability / assignments / shift logic currently in the repo.

---

## 1) Database schema (authoritative)

### Core tables

#### `pulse_schedule_shifts`
Represents a scheduled time window for one worker.

- **Columns**
  - `id` (UUID, PK)
  - `company_id` (UUID, FK → `companies.id`, **required**, indexed)
  - `assigned_user_id` (UUID, FK → `users.id`, **required**, indexed)
  - `facility_id` (UUID, FK → `zones.id`, nullable, indexed)
  - `shift_definition_id` (UUID, FK → `pulse_schedule_shift_definitions.id`, nullable, indexed)
  - `shift_code` (string(16), nullable) (denormalized display code from definition)
  - `is_draft` (bool, default `true`)
  - `published_at` (timestamptz, nullable)
  - `starts_at` (timestamptz, required, indexed)
  - `ends_at` (timestamptz, required, indexed)
  - `shift_type` (string(64), default `"shift"`)
  - `requires_supervisor` (bool, default `false`)
  - `requires_ticketed` (bool, default `false`)
  - `shift_kind` (string(32), default `"workforce"`)  
    - also used as `"project_task"` when created as a calendar mirror of a project task
  - `display_label` (string(512), nullable) (used for project task title)
  - `created_at` (timestamptz)

- **Relationships**
  - `assigned_user_id` → `users.id` (**tenant users**; `company_id` enforced separately)
  - `facility_id` → `zones.id` (see “Schedule facilities” below)

- **Constraints**
  - **No overlap per worker per company** (Postgres exclusion constraint):
    - `no_user_shift_overlap`: `(company_id, assigned_user_id, tstzrange(starts_at, ends_at, '[)'))` must not overlap.

#### `pulse_schedule_assignments`
Per-day “assignment board” rows (area + notes) intended for “night shift assignments” style workflows. This is **separate** from workforce shifts.

- **Columns**
  - `id` (UUID, PK)
  - `company_id` (UUID, FK → `companies.id`, required, indexed)
  - `date` (date, required, indexed)
  - `shift_type` (string(32), default `"night"`, indexed)
  - `area` (string(128), required)
  - `assigned_user_id` (UUID, FK → `users.id`, nullable, indexed)
  - `notes` (text, nullable)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

- **Constraints**
  - `uq_pulse_schedule_assign_area`: unique `(company_id, date, shift_type, area)`

#### `pulse_worker_profiles`
Stores worker scheduling hints (availability windows, certifications) keyed by user.

- **Columns**
  - `id` (UUID, PK)
  - `company_id` (UUID, FK → `companies.id`, required, indexed)
  - `user_id` (UUID, FK → `users.id`, required, indexed, **unique**)
  - `certifications` (JSONB array of strings, default `[]`)
  - `notes` (text, nullable)
  - `availability` (JSONB object, default `{}`)
  - `scheduling` (JSONB object, default `{}`)  
    - observed keys used by API: `employment_type`, `recurring_shifts`
  - `updated_at` (timestamptz)

#### `pulse_schedule_shift_definitions` (Phase 1)
Tenant-scoped catalog of shift templates (codes + time window).

- **Columns**
  - `id` (UUID, PK)
  - `company_id` (UUID, FK → `companies.id`)
  - `code` (string(16), required) (e.g. `D1`, `PM2`)
  - `name` (string(128), nullable)
  - `start_min` / `end_min` (int minutes from midnight, 0–1439)
  - `shift_type` (string(32))
  - `color` (string(32), nullable)
  - `cert_requirements` (JSONB array, default `[]`)
  - `created_at`, `updated_at` (timestamptz)

- **Constraints**
  - unique `(company_id, code)`

#### `pulse_schedule_periods` (Phase 1)
Defines a scheduling “period” and deadlines (minimal workflow).

- **Columns**
  - `id` (UUID, PK)
  - `company_id` (UUID, FK → `companies.id`)
  - `start_date` / `end_date` (date)
  - `availability_deadline` (timestamptz, nullable)
  - `publish_deadline` (timestamptz, nullable)
  - `status` (string; currently values like `draft`, `published`)
  - `created_at` (timestamptz)

#### `pulse_schedule_availability_submissions` (Phase 2)
One submission per worker per period.

- **Columns**
  - `id` (UUID, PK)
  - `company_id` (UUID, FK → `companies.id`)
  - `worker_id` (UUID, FK → `users.id`)
  - `period_id` (UUID, FK → `pulse_schedule_periods.id`)
  - `submitted_at` (timestamptz)
  - `windows` (JSONB; canonical weekday-keyed format)
  - `exceptions` (JSONB; stored but not used yet)

- **Constraints**
  - unique `(worker_id, period_id)`

#### `pulse_schedule_acknowledgements` (Phase 2)
One acknowledgement per worker per period.

- **Columns**
  - `id` (UUID, PK)
  - `company_id` (UUID, FK → `companies.id`)
  - `worker_id` (UUID, FK → `users.id`)
  - `period_id` (UUID, FK → `pulse_schedule_periods.id`)
  - `acknowledged_at` (timestamptz)

- **Constraints**
  - unique `(worker_id, period_id)`

#### `users` (only fields relevant to scheduling)
- `id` (UUID, PK)
- `company_id` (UUID, FK → `companies.id`)
- `roles` (varchar[]; used for supervisor/manager checks)
- `operational_role` (string(32); used by workforce enrollment checks)
- `is_active` (bool)
- `full_name`, `email` (display)

### Schedule facilities (important modeling note)
Workforce scheduling uses “facilities” which are stored as **rows in `zones`**, identified by `zones.meta.schedule_facility === true` and a `slot_index`.

- `pulse_schedule_shifts.facility_id` points to one of these schedule-facility zones.
- Auto-seeded/kept in sync from org module settings by `backend/app/services/schedule_facility_zones.py`.

---

## 2) Backend (FastAPI)

### Shift + assignment endpoints (Pulse module)
Implemented in `backend/app/modules/pulse/router.py` under router prefix `/api/v1/pulse`.

#### Shifts
- **GET** `/api/v1/pulse/schedule/shifts`
  - **Purpose**: list shifts in a time window (optional `from`, `to` query params).
  - **Key logic**:
    - filters by `PulseScheduleShift.company_id == cid`
    - windowing: `ends_at > from` and `starts_at < to`
    - joins project metadata **in-app** for shifts with `shift_kind == "project_task"` by looking up `PulseProjectTask.calendar_shift_id`

- **POST** `/api/v1/pulse/schedule/shifts`
  - **Purpose**: create a workforce shift row.
  - **Key logic**:
    - validates `facility_id` belongs to tenant via `_zone_in_company` (note: “facility” is a zone row)
    - optionally accepts `shift_definition_id` and auto-fills `shift_code`
    - calls `pulse_svc.validate_shift_assignment(...)` to return `(errors, warnings)`
    - errors block creation; warnings are returned in response

- **PATCH** `/api/v1/pulse/schedule/shifts/{shift_id}`
  - **Purpose**: edit a shift (time, assignee, facility, requirements).
  - **Key logic**:
    - loads shift by id and checks `company_id`
    - recomputes validation against the proposed values (with `exclude_shift_id` to allow self)
    - if `shift_definition_id` changes, rewrites `shift_code`
    - then applies patch and calls `proj_task_svc.sync_task_from_linked_shift(db, sh)` to mirror updates back to a linked project task (only when `shift_kind == "project_task"`)

- **DELETE** `/api/v1/pulse/schedule/shifts/{shift_id}`
  - **Purpose**: delete a shift row.
  - **Key logic**: checks company ownership, then deletes.

#### Assignments (“night shift areas + notes”)
- **GET** `/api/v1/pulse/schedule/assignments`
  - **Purpose**: list assignment rows (optional `from`, `to`, `shift_type`).
  - **Key logic**: filters by company and optional date range; orders by date/type/area.

- **POST** `/api/v1/pulse/schedule/assignments`
  - **Purpose**: create an assignment row for a date+shift_type+area.
  - **Key logic**: relies on unique constraint; returns 400 on duplicate.

- **PATCH** `/api/v1/pulse/schedule/assignments/{assignment_id}`
  - **Purpose**: update an assignment (area, assigned_user_id, notes).
  - **Key logic**: checks company ownership; returns 400 on duplicate after change.

- **DELETE** `/api/v1/pulse/schedule/assignments/{assignment_id}`
  - **Purpose**: delete assignment.

#### Facilities list
- **GET** `/api/v1/pulse/schedule-facilities`
  - **Purpose**: returns schedule-facility “zones” for the schedule UI.
  - **Key logic**: `ensure_schedule_facility_zones(db, cid)` seeds them from org settings when missing.

#### Shift definitions (Phase 1)
- **GET** `/api/v1/pulse/schedule/shift-definitions`
- **POST** `/api/v1/pulse/schedule/shift-definitions`
- **PATCH** `/api/v1/pulse/schedule/shift-definitions/{id}`
- **DELETE** `/api/v1/pulse/schedule/shift-definitions/{id}`
  - **Purpose**: simple CRUD for tenant-scoped shift templates (no advanced business logic yet).

#### Schedule periods (Phase 1)
- **GET** `/api/v1/pulse/schedule/periods`
- **POST** `/api/v1/pulse/schedule/periods`

#### Availability + acknowledgement (Phase 2)
- **POST** `/api/v1/pulse/schedule/availability`
  - **Purpose**: submit/update the current user’s availability for a period.
- **GET** `/api/v1/pulse/schedule/availability?period_id=...`
  - **Purpose**: supervisor view of all submissions for a period (role-gated).
- **POST** `/api/v1/pulse/schedule/acknowledge`
  - **Purpose**: mark a user as having acknowledged a period (minimal stub UI exists).

#### Reminder runner (internal) (Phase 2)
- **POST** `/api/v1/internal/schedule/reminders/run`
  - **Auth**: `X-PM-Cron-Key` (reuses `PM_CRON_SECRET`)
  - **Purpose**: returns counts for “missing availability submissions soon” and “unacknowledged published periods” (no notification delivery yet).

### Shift validation rules (server-side)
Implemented in `backend/app/modules/pulse/service.py`:

- **Overlap**: checks for existing overlapping shifts (also enforced by DB exclusion constraint).
- **Workforce enrollment**: blocks assignment if user is not in workforce operations.
- **Supervisor requirement**: if `requires_supervisor`, blocks unless user role is manager/company_admin/supervisor.
- **Ticketed requirement**: if `requires_ticketed`, blocks unless `certifications` contains a string with `"ticketed"`.
- **Availability**: does **not** block; returns a warning if shift start is outside saved windows.
  - Supports both legacy v1 and Phase 2 v2 formats.

Key non-trivial behavior:
- v2: `{"monday":[{"start":480,"end":1020}], ...}` (preferred)
- v1: `{"windows":[{"weekday":0,"start_min":480,"end_min":1020}]}` (legacy)

### Worker scheduling fields API (availability + recurring templates)
Scheduling-related worker fields are exposed in multiple places (not a single “availability module”):

- `pulse_worker_profiles.availability` is returned in:
  - `backend/app/modules/pulse/router.py` worker payloads (for schedule UI)
  - `backend/app/api/workers_routes.py` worker detail payloads
- `pulse_worker_profiles.scheduling` stores:
  - `employment_type` (validated against: `full_time | regular_part_time | part_time`)
  - `recurring_shifts` (list of dicts; frontend maps to recurring templates)

---

## 3) Frontend (React / Next.js)

### Entry point
- `frontend/app/schedule/page.tsx`
  - **Purpose**: auth guard + renders `<ScheduleApp />`

### Phase 1 builder page
- `frontend/app/schedule/shift-definitions/page.tsx`
  - **Purpose**: minimal CRUD UI for shift definitions
  - **API**: `/api/v1/pulse/schedule/shift-definitions`

### Phase 2 availability pages
- `frontend/app/schedule/availability/page.tsx`
  - **Purpose**: “My availability” submit + acknowledgement stub
  - **API**: `/api/v1/pulse/schedule/periods`, `/api/v1/pulse/schedule/availability`, `/api/v1/pulse/schedule/acknowledge`
- `frontend/app/schedule/availability-grid/page.tsx`
  - **Purpose**: supervisor view of submissions + missing list (minimal)
  - **API**: `/api/v1/pulse/schedule/availability?period_id=...`

### Main schedule app
- `frontend/components/schedule/ScheduleApp.tsx`
  - **Purpose**: main schedule UI; fetches snapshot from Pulse API and syncs edits.
  - **Backend interactions**
    - GET `/api/v1/pulse/schedule-facilities`
    - GET `/api/v1/pulse/schedule/shift-definitions` (legend + shift_code display)
    - GET `/api/v1/pulse/schedule/shifts?from=...&to=...`
    - PATCH `/api/v1/pulse/schedule/shifts/{id}` (writes `facility_id`)
    - POST `/api/v1/pulse/schedule/shifts` (writes `facility_id`)
    - DELETE `/api/v1/pulse/schedule/shifts/{id}`

### Supporting UI components (non-exhaustive, all in `frontend/components/schedule/`)
- `ScheduleCalendarGrid.tsx`, `ScheduleWeekView.tsx`, `ScheduleDayView.tsx`
  - **Purpose**: month/week/day views and drag targets.
- `ShiftEditModal.tsx`
  - **Purpose**: edit/create a shift client-side; pushes to API when in “API mode”.
- `ScheduleCompactCellRows.tsx`
  - **Purpose**: compact per-day rows + conflict badges + drag affordances.
- `ScheduleWorkerPanel.tsx`, `SchedulePersonnel.tsx`
  - **Purpose**: worker roster/sidebar, includes availability display hints.
- `ScheduleSettingsModal.tsx`
  - **Purpose**: schedule settings UI (local store-driven).
- `TimeOffRequestModal.tsx`
  - **Purpose**: time-off blocks UI (**currently local-only**; no backend persistence).

### API ↔ UI mapping layer
- `frontend/lib/schedule/pulse-bridge.ts`
  - **Purpose**: maps Pulse API JSON → local schedule types.
  - **Note**: local schedule type still uses `zoneId`, but this is actually the **facility** id.
    - Mapping uses `facility_id ?? zone_id ?? fallback` for back-compat.

---

## 4) Existing logic (how it works today)

### How shifts are defined
- A shift is a **single worker assignment** with a start/end time (timestamptz), stored in `pulse_schedule_shifts`.
- Shifts optionally reference a **schedule facility** (`facility_id`), which is implemented as a `zones` row with `meta.schedule_facility=true`.

### How workers get assigned
- Server-side: creating/updating a shift sets `assigned_user_id` directly.
- Client-side: Schedule UI supports drag/drop and edits that eventually POST/PATCH shifts to the API.

### Drag/drop
- Frontend supports:
  - dragging **workers** onto dates (uses availability + recurring templates + hour-limit hints)
  - dragging **shifts** to move/duplicate (guarded by a feature flag in schedule module settings)

### Conflicts / constraints
- **Hard constraint (blocking)**:
  - No overlapping shifts for the same worker in the same company (DB exclusion constraint + API validation).
  - Role constraints for `requires_supervisor` and `requires_ticketed` (blocking).
- **Soft constraints (warnings only)**:
  - Availability mismatch: server returns warning if shift starts outside saved availability windows.
  - Frontend-only conflict hints: understaffed, missing supervisor/lead, missing certifications, time-off overlaps, long shifts, etc.
    - These are explicitly non-blocking (“badges”, “tooltips”).

### Recurring shifts + time off (frontend-generated)
The UI generates **ephemeral** shifts on top of API data:

- Recurring shifts come from `worker.recurringShifts` (stored on server in `pulse_worker_profiles.scheduling.recurring_shifts`).
- Approved time-off blocks are currently **local-only** in the schedule store; UI creates “vacation/sick marker shifts” to block hints.

```79:91:frontend/lib/schedule/recurring.ts
export function mergeEphemeralSchedule(
  baseShifts: Shift[],
  workers: Worker[],
  visibleDates: string[],
  timeOffBlocks: TimeOffBlock[],
  defaultZoneId: string,
): Shift[] {
  const base = stripEphemeralShifts(baseShifts);
  const visible = new Set(visibleDates);
  const recurring = buildRecurringShifts(base, workers, visible, timeOffBlocks, defaultZoneId);
  const markers = buildTimeOffMarkers(base, workers, timeOffBlocks, visible, defaultZoneId);
  return [...base, ...recurring, ...markers];
}
```

---

## 5) Data flow (DB → API → UI)

### Read path
- DB: `pulse_schedule_shifts`, `pulse_schedule_assignments`, `pulse_worker_profiles`, schedule-facility `zones`
- API:
  - UI loads facilities via `GET /api/v1/pulse/schedule-facilities`
  - UI loads shifts via `GET /api/v1/pulse/schedule/shifts?from&to`
  - UI loads workers (availability + recurring templates) via Pulse worker endpoints (see `backend/app/modules/pulse/router.py` worker payload construction)
- UI:
  - maps API to local store via `pulse-bridge.ts`
  - overlays ephemerals (recurring + local time off markers) via `mergeEphemeralSchedule`

### Write path (shift edits)
- UI creates/edits a shift in local state → submits via:
  - `POST /api/v1/pulse/schedule/shifts` (create)
  - `PATCH /api/v1/pulse/schedule/shifts/{id}` (update)
  - `DELETE /api/v1/pulse/schedule/shifts/{id}` (delete)
- Backend runs `validate_shift_assignment`:
  - returns `{ errors: [...] , warnings: [...] }` (errors block)
  - DB enforces overlap constraint regardless
- UI reloads schedule snapshot after saves (ScheduleApp does a refresh after successful writes).

---

## 6) Gaps / observations (based strictly on repo)

- **Facility modeling is overloaded**: schedule facilities are stored in `zones` and shifts point to `zones.id`. This is intentional but can be confusing; local schedule types still name it `zoneId`.
- **Two “availability formats” exist**:
  - backend warnings expect `availability.windows[]` with `weekday/start_min/end_min` in UTC minutes
  - Phase 2 introduces a new canonical weekday-keyed list format `{ monday: [{ start, end }], ... }`
  - frontend drag highlights expect a different weekday-keyed object `{ monday: { available, start, end }, ... }`
  - All are stored as JSONB in `pulse_worker_profiles.availability` with no strict schema enforcement yet.
- **Time off is not persisted**: frontend has `TimeOffBlock` in zustand store; no corresponding DB table or API workflow in scope.
- **Many constraints are soft in the UI**: staffing, certifications, long shifts are non-blocking hints; only overlap and role/ticketed are hard blocks.
- **Assignments vs shifts are separate systems**:
  - `pulse_schedule_assignments` is “area + notes” per day/shift type
  - not currently integrated into the main shift grid as a first-class entity.

