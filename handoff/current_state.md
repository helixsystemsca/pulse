# Pulse · Current State
> Updated by Cursor after each integration.md execution.
> Max 5 bullets per section. No code. No long explanations.
> Claude reads this at the start of each session to stay oriented.

---

## Last Updated
2026-04-27 — mobile M4–M6: unified search, profile/gamification, push token + WS→local notify, period availability + schedule acknowledgement

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
- PM tasks: tenant-safe (`company_id`) + BLE tools + facility equipment paths
- Schedule: double-booking constraint + work queue endpoint + period availability + acknowledgement APIs
- Security: per-gateway ingest rate limit + demo-reset routes restricted + maintenance inference TTL cleanup
- Unified search: GET `/api/v1/search`; app notifications: push-token register + inbox stub on `/api/v1/notifications` (replace with DB for production)

### Frontend
- Web `/settings` + `/live-map` are DS-aligned and stable
- Blueprint designer polish shipped (tools/templates/indicators/read-only UX)
- Schedule phases 4+5 shipped (My Shifts, project overlay toggle, assignment work queue, publish button)
- Preventative rules UI is read-only (deprecated; use PM tasks)
- Mobile M1–M6 shipped: tab nav + home + documents + search + profile/XP + push token + WS→local notifications + period availability + schedule acknowledgement

### Known Issues / TODOs
- Blueprint designer remaining phases still pending: lock/unlock-all, fine grid toggle, default shape behavior tweaks
- PM auto-generated work order priority still hardcoded; settings tabs (Compliance, Notifications, Gamification, Zones) mostly placeholders
- Schedule time-off persistence still local-only (no DB table yet); procedure steps validated on write but legacy malformed rows ignored on read
- Mobile push requires real device/dev build (not Expo Go); notifications inbox + push-token backing store are in-memory until DB tables land
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
- M1–M6 integration complete (see Frontend bullet)

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
