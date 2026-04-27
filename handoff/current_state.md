# Pulse · Current State
> Updated by Cursor after each integration.md execution.
> Max 5 bullets per section. No code. No long explanations.
> Claude reads this at the start of each session to stay oriented.

---

## Last Updated
2026-04-27 — schedule phases 4+5: My Shifts view, project overlay toggle, assignment work queue, publish button

---

## Branch Status
- Main branch is live on Vercel + Render
- Claude branch merged into main
- All telemetry pipeline work (A/B/C/D) is live
- Config system (pulse_config table) is live
- Cursor hardening passes merged to main (PM + schedule + blueprint + UI)

---

## What's Live (main)

### Backend
- Telemetry positions: GET `/api/v1/telemetry/positions` + inference confirm/dismiss endpoints
- Maintenance inference TTL cleanup: POST `/api/v1/internal/maintenance-inferences/cleanup` (90d delete for dismissed/auto_logged/expired)
- PM tasks now support fixed assets **and** BLE tools (pm_tasks.equipment_id OR pm_tasks.tool_id)
- PM tasks now include `company_id` (no join required for tenant scoping + due queries)
- Schedule work queue endpoint: GET `/api/v1/pulse/schedule/shifts/{shift_id}/work-queue` (open WRs + overdue PMs)
- Telemetry ingest is rate-limited per gateway (readings/sec) to mitigate leaked secrets
- Pulse schedule shifts are protected from double-booking (DB exclusion constraint)
- Demo routes that reset global singleton state are restricted to the demo tenant (or system admin)
- Preventative rules deprecated + migrated into PM tasks (pulse_preventative_rules → pm_tasks)

### Frontend
- `/settings`: design system aligned + auth guard + Suspense boundary
- `/live-map`: DS header/tabs + LiveHardware (LiveFacilityMap) + DemoScenario (DemoLiveMap)
- Blueprint designer polish shipped: tool labels, expanded symbols, templates, task indicators, read-only instructions
- Preventative rules UI is now read-only with deprecation notice (use PM tasks instead)
- Schedule phases 4+5 shipped: My Shifts tab, Projects overlay toggle, Day view assignments for all shifts + work queue, publish button
- Architecture contracts live at `handoff/contracts.md`

### Known Issues / TODOs
- Blueprint designer remaining phases still pending: lock/unlock-all, fine grid toggle, default shape behavior tweaks
- PM auto-generated work order priority still hardcoded (needs config)
- Settings remaining tabs (Compliance, Notifications, Gamification, Zones): placeholder content only
- Procedure steps schema is now validated on write; legacy malformed steps are ignored on read
- Schedule time-off persistence still local-only (no DB table yet)
- Telemetry ingest rate limit is best-effort in-process; consider Redis/edge enforcement for multi-instance deployments

---

## Pending (integration.md written, not executed)

### Blueprint Designer Polish
- Phase 6: Lock fix + Unlock All button
- Phase 7: Fine grid toggle (8px)
- Phase 8: All shapes → rooms by default, remove draw-room tool

### Schedule
- Phase 6: swap requests (deferred to Expo session)

---

## Hardware Status
- ESP32 gateway firmware: written, not yet flashed for real demo
- ESP32 node firmware: written, not yet flashed
- RPI5 position engine (mesh): written, not deployed
- RPI5 position engine (single/office): written, not deployed
- Real hardware demo: planned for when back from camp (2× ESP32 + 3 beacons)

---

## Config System Migration Status
- pulse_config table: live
- ConfigService: live, all modules can read from it
- Existing modules still reading from old tables (PulseOrgModuleSettings, AutomationFeatureConfig)
- Module migration to ConfigService: NOT YET STARTED
- Priority order: automation → schedule → workRequests

---

## Hardcoded Logic Fixes Status
- facilityCount default: fixed (3 → 1) ✓
- enableNightAssignments default: fixed (true → false) ✓
- timezone hardcoded to North Saanich: NOT YET FIXED
- Cert codes (RO/P1/P2/FA) hardcoded: NOT YET FIXED
- OperationalRole enum too limited: NOT YET FIXED
- FacilityMap hardcoded room names: replaced with LiveFacilityMap ✓
- PM auto-generated WO priority hardcoded: NOT YET FIXED
