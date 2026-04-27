# Pulse · Current State
> Updated by Cursor after each integration.md execution.
> Max 5 bullets per section. No code. No long explanations.
> Claude reads this at the start of each session to stay oriented.

---

## Last Updated
2026-04-27 — mobile M2: inference confirmation screen, WS-driven banner, tasks rebuild

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
- Telemetry positions + inference confirm/dismiss endpoints are live (`/api/v1/telemetry/*`)
- Maintenance inference cleanup job is live (TTL cleanup endpoint)
- PM tasks: tenant-safe (`company_id`) and support both fixed assets + BLE tools
- Schedule: double-booking protected (DB constraint) + shift work queue endpoint for assignments
- Security hardening: per-gateway ingest rate limit + demo-reset routes restricted

### Frontend
- Web `/settings` + `/live-map` are DS-aligned and stable
- Blueprint designer polish shipped (tools/templates/indicators/read-only UX)
- Schedule phases 4+5 shipped (My Shifts, project overlay toggle, assignment work queue, publish button)
- Preventative rules UI is read-only (deprecated; use PM tasks)
- Mobile M2 shipped: inference confirmation screen, WS-driven inference banner, tasks rebuild

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

### Mobile
- M3–M6 still pending (Documents tab, plus remaining mobile phases)

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
