# Pulse · Wiring Queue — Claude Branch
<!--
CURSOR TRIGGER PROMPT (paste this to start):
"Read _cursor_prompts/wiring_prompts.md. Execute all PENDING tasks in order
starting from Task 00. After each task: mark DONE, commit as 'task-XX: title',
proceed immediately. On BLOCKING error: mark BLOCKED with note, skip to next.
Do not stop between tasks. When all done: git push origin Claude."
-->

## Rules
- No repo re-analysis. Patterns are established — reuse them.
- One commit per task. Message format: `task-XX: title`
- BLOCKED = note the error, skip, continue.
- TODO = leave a comment if unsure rather than guessing.
- All work on `Claude` branch only.

## Status: `[ ]` PENDING `[x]` DONE `[!]` BLOCKED `[-]` SKIPPED

---

## PHASE 0 · Setup

### Task 00 — Extract zip and place files [x]
**Always runs first — even if files appear to already exist.**

Find the zip file in the repo root (named `pulse_claude_branch.zip` or similar).
Extract it and place every file into its correct location:

| File | Destination |
|------|-------------|
| `telemetry_ingest_routes.py` | `backend/app/api/` |
| `devices_routes_unknown_additions.py` | `backend/app/api/` |
| `config_routes.py` | `backend/app/api/` |
| `demo_routes.py` | `backend/app/api/` |
| `pulse_config_model.py` | `backend/app/models/pulse_config.py` |
| `config_service.py` | `backend/app/services/` |
| `maintenance_logic.py` | `backend/app/services/automation/logic/` |
| `seed_demo_office.py` | `backend/scripts/` |
| `migrate_config_to_pulse_config.py` | `backend/scripts/` |
| `0068_beacon_positions_zone_polygon.py` | `backend/alembic/versions/` |
| `0069_gateway_floor_position.py` | `backend/alembic/versions/` |
| `0070_pulse_config.py` | `backend/alembic/versions/` |
| `UnknownDevicesPanel.tsx` | `frontend/components/setup/` |
| `config_service_frontend.ts` | `frontend/lib/config/` |
| `SettingsApp.tsx` | `frontend/components/settings/` |
| `SettingsGear.tsx` | `frontend/components/settings/` |
| `settings_page.tsx` | `frontend/app/settings/page.tsx` |
| `DemoLiveMap.tsx` | `frontend/components/demo/` |
| `demo_page.tsx` | `frontend/app/demo/page.tsx` |
| `pulse_node.ino` | `hardware/node/pulse_node/` |
| `pulse_gateway.ino` | `hardware/gateway/pulse_gateway/` |
| `position_engine_mesh.py` | `rpi5/` |
| `position_engine_single.py` | `rpi5/` |

Create destination folders if they don't exist.
Do not overwrite files that are identical — skip silently.
Do not delete the zip after extraction.

```bash
# Verify extraction
find backend/app/api/telemetry_ingest_routes.py \
     backend/app/models/pulse_config.py \
     backend/app/services/config_service.py \
     frontend/components/settings/SettingsApp.tsx \
     -type f 2>/dev/null | wc -l
# Should print 4
```

Commit: `task-00: extract and place all Claude session files`

---

## PHASE 1 · Migrations

### Task 01 — Apply migrations [!]
```bash
cd backend && alembic upgrade head && alembic current
# Expected head: 0070_pulse_config
```
BLOCKED: `alembic` command not found in current shell environment.
Commit: `task-01: apply migrations 0068 0069 0070`

---

### Task 02 — BeaconPosition model [x]
**File:** `backend/app/models/device_hub.py`
Add after `AutomationUnknownDevice`:
```python
class BeaconPosition(Base):
    __tablename__ = "beacon_positions"
    beacon_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("automation_ble_devices.id", ondelete="CASCADE"), primary_key=True)
    company_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    x_norm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    y_norm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    zone_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), ForeignKey("zones.id", ondelete="SET NULL"), nullable=True, index=True)
    position_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
```
Add to `AutomationGateway` after `ingest_secret_hash`:
```python
    x_norm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    y_norm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
```
Commit: `task-02: add BeaconPosition model and gateway position fields`

---

### Task 03 — Zone polygon field [ ]
**File:** `backend/app/models/domain.py`
In `Zone` class, after `meta`:
```python
    polygon: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
```
Check JSONB is imported before adding.
Commit: `task-03: add polygon to Zone`

---

### Task 04 — Company location fields [ ]
**File:** `backend/app/models/domain.py`
In `Company` class, after `timezone`:
```python
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
```
Commit: `task-04: add latitude longitude to Company`

---

## PHASE 2 · Backend Wiring

### Task 05 — Register routers [ ]
**File:** `backend/app/main.py`
Add imports + includes for all three new routers, following existing pattern:
```python
from app.api.telemetry_ingest_routes import router as telemetry_ingest_router
from app.api.config_routes import router as config_router
from app.api.demo_routes import router as demo_router

app.include_router(telemetry_ingest_router, prefix="/api/v1")
app.include_router(config_router, prefix="/api/v1")
app.include_router(demo_router, prefix="/api/v1")
```
Commit: `task-05: register telemetry config demo routers`

---

### Task 06 — Unknown device routes [ ]
**File:** `backend/app/api/devices_routes.py`
**Reference:** `backend/app/api/devices_routes_unknown_additions.py`

Add `UnknownDeviceOut` schema near other Out schemas.
Add `list_unknown_devices` and `dismiss_unknown_device` routes at end of file.
Follow existing dependency and import patterns exactly.
Commit: `task-06: add unknown device routes`

---

### Task 07 — Gateway position fields in schema [ ]
**File:** `backend/app/api/devices_routes.py`
Find `GatewayOut` schema. Add:
```python
x_norm: Optional[float] = None
y_norm: Optional[float] = None
```
Find gateway PATCH body schema. Add same two fields.
Find gateway PATCH handler. Add:
```python
if body.x_norm is not None: gateway.x_norm = body.x_norm
if body.y_norm is not None: gateway.y_norm = body.y_norm
```
Commit: `task-07: add x_norm y_norm to gateway schema and handler`

---

### Task 08 — Replace maintenance_logic stub [ ]
**File:** `backend/app/services/automation/logic/maintenance_logic.py`
Replace entire file with new implementation.
Verify `handle(db, event)` signature unchanged.
Do NOT touch `event_processor.py`.
Commit: `task-08: implement maintenance inference engine`

---

## PHASE 3 · Frontend Wiring

### Task 09 — Config lib files [ ]
**Source:** `frontend/lib/config/config_service_frontend.ts`
Split into two files:
- `frontend/lib/config/service.ts` — types + `configApi` object
- `frontend/lib/config/useConfig.ts` — `useConfig` + `useAllConfig` hooks

Add cross-imports between the two files as needed.
Commit: `task-09: add frontend config service and hooks`

---

### Task 10 — Setup-api additions [ ]
**File:** `frontend/lib/setup-api.ts`
**Reference:** `frontend/lib/D_wiring_instructions.ts`

Append `UnknownDeviceOut` type + `fetchUnknownDevices` + `dismissUnknownDevice`.
Use same `apiFetch` + `withCompany` pattern already in the file.
Commit: `task-10: add unknown device functions to setup-api`

---

### Task 11 — Wire UnknownDevicesPanel [ ]
**File:** `frontend/components/setup/SetupApp.tsx`
Five changes in one pass:
1. Import `UnknownDevicesPanel` from `@/components/setup/UnknownDevicesPanel`
2. Add `const registerTagFormRef = useRef<HTMLDivElement>(null)`
3. Add `onDiscoveredDeviceRegister` callback (pre-fills `bleMac`, scrolls to form)
4. Insert `<UnknownDevicesPanel>` in devices tab after `<h2>Tags</h2>`
5. Add `ref={registerTagFormRef}` to Register tag form div
Commit: `task-11: wire UnknownDevicesPanel into SetupApp`

---

### Task 12 — Settings + Demo page routes [ ]
Create if not exist:
- `frontend/app/settings/page.tsx` → imports + renders `SettingsApp`
- `frontend/app/demo/page.tsx` → imports + renders demo content
Commit: `task-12: add settings and demo page routes`

---

### Task 13 — Settings nav item [ ]
**File:** `frontend/lib/pulse-app.ts`
Add to `pulseTenantSidebarNav`:
```ts
{ href: "/settings", label: "Settings", icon: "settings" as const }
```
Place near bottom. Match existing icon type — TODO if icon type unclear.
Commit: `task-13: add settings to sidebar nav`

---

### Task 14 — SettingsGear on module pages [ ]
**Files:** `ScheduleApp.tsx`, `WorkRequestsApp.tsx`
In each: import `SettingsGear`, add to page header:
```tsx
<SettingsGear module="schedule" />
<SettingsGear module="workRequests" />
```
Commit: `task-14: add SettingsGear to schedule and work requests`

---

## PHASE 4 · Config & Defaults

### Task 15 — Fix hardcoded defaults [ ]
**Files:**
- `backend/app/core/org_module_settings_merge.py`
- `frontend/lib/moduleSettings/defaults.ts`

Changes:
- `facilityCount: 3` → `1`
- `enableNightAssignments: True/true` → `False/false`
Commit: `task-15: fix facilityCount and enableNightAssignments defaults`

---

### Task 16 — Run config migration [ ]
```bash
cd backend
python -m scripts.migrate_config_to_pulse_config
```
Non-destructive. On Python error mark BLOCKED. On empty DB mark DONE.
Commit: `task-16: run config migration script`

---

## PHASE 5 · Final

### Task 17 — Import check [ ]
```bash
cd backend
python -c "
from app.api.telemetry_ingest_routes import router
from app.api.config_routes import router
from app.api.demo_routes import router
from app.models.pulse_config import PulseConfig
from app.models.device_hub import BeaconPosition
from app.services.config_service import ConfigService
from app.services.automation.logic.maintenance_logic import handle
print('All imports OK')
"
```
On error: mark BLOCKED with output.
Commit: `task-17: import check passed`

---

### Task 18 — Push [ ]
```bash
git push origin Claude
```
Commit: `task-18: push complete`

---

## Summary
| Phase | Tasks | Scope |
|-------|-------|-------|
| 0 · Setup | 00 | Extract zip + place files |
| 1 · Migrations | 01–04 | DB + models |
| 2 · Backend | 05–08 | API wiring |
| 3 · Frontend | 09–14 | Components + routes |
| 4 · Config | 15–16 | Defaults + migration |
| 5 · Final | 17–18 | Verify + push |

**19 tasks · Claude branch · 2026-04-25**

