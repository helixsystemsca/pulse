# Pulse · Current State
> Updated by Cursor after each integration.md execution.
> Max 5 bullets per section. No code. No long explanations.
> Claude reads this at the start of each session to stay oriented.

---

## Last Updated
2026-04-26 — initial state captured from session history

---

## Branch Status
- Main branch is live on Vercel + Render
- Claude branch merged into main
- All telemetry pipeline work (A/B/C/D) is live
- Config system (pulse_config table) is live
- Blueprint designer polish integration.md pending Cursor execution

---

## What's Live (main)

### Backend
- Telemetry ingest endpoint: POST /api/v1/telemetry/ingest
- Beacon positions endpoint: GET /api/v1/telemetry/positions
- Inference confirm/dismiss: POST /api/v1/telemetry/inferences/{id}/confirm|dismiss
- PM inference engine: maintenance_logic.py fully implemented
- Config system: pulse_config table + ConfigService + GET|PATCH /api/v1/config/{module}
- Demo routes: POST /api/v1/demo/start|reset|confirm|dismiss + GET /api/v1/demo/state
- Unknown device discovery: GET|DELETE /api/v1/ble-devices/unknown
- Migrations live: 0068 (beacon_positions), 0069 (gateway x_norm/y_norm), 0070 (pulse_config)

### Frontend
- /settings page: 8-tab config UI, design system aligned
- /live-map page: Live Hardware tab (LiveFacilityMap) + Demo Scenario tab (DemoLiveMap)
- /demo redirects to /live-map
- UnknownDevicesPanel wired into SetupApp devices tab
- Settings + Live Map nav items added to sidebar
- Architecture contracts file: handoff/contracts.md

### Known Issues / TODOs
- UnifiedFacilityMap.tsx: created by Cursor but has unresolved import path issues — live-map uses LiveFacilityMap + DemoLiveMap separately instead
- Demo scenario: DomainEvent id= bug fixed — scenario now runs full 120s
- Blueprint designer polish (phases 1-8): integration.md written, NOT YET executed by Cursor
- Settings remaining tabs (Compliance, Notifications, Gamification, Zones): placeholder content only

---

## Pending (integration.md written, not executed)

### Blueprint Designer Polish
- Phase 1: Tool rail labels
- Phase 2: Expanded symbol library (35+ symbols, 7 categories)
- Phase 3: Task count indicator on canvas elements
- Phase 4: Starter templates (pool, rink, maintenance, garden)
- Phase 5: Read-only instruction panel
- Phase 6: Lock fix + Unlock All button
- Phase 7: Fine grid toggle (8px)
- Phase 8: All shapes → rooms by default, remove draw-room tool

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
