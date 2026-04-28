# Pulse · Current State
> Updated by Cursor after each integration.md execution.
> Max 5 bullets per section. No code. No long explanations.
> Claude reads this at the start of each session to stay oriented.

---

## Last Updated
2026-04-28 — Gap fixes shipped: supervisor period status bar + create/edit period modal; onboarding checklist extended to 7 steps (schedule setup) with auto-marking from reality + worker tour auto-dismiss on first XP; My Shifts shows assignment detail on tap; tools + profile zero/empty states on web + mobile

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
- Schedule: double-booking + work queue + periods/availability POST + period PATCH + acknowledge POST + **acknowledgement status GET** + draft build/commit + publish event + onboarding auto-mark for shift defs/period/publish
- Security: per-gateway ingest rate limit + demo-reset routes restricted + maintenance inference TTL cleanup
- Unified search: GET `/api/v1/search`; app notifications: push-token register + inbox stub on `/api/v1/notifications` (replace with DB for production)

### Frontend
- Web `/settings` + `/live-map` are DS-aligned and stable (XP profile shows “getting started” zero-state)
- Blueprint designer polish shipped (tools/templates/indicators/read-only UX)
- Schedule: shift-definitions CRUD page + legend; period status bar + create/edit modal; Phase 3 (code chips, cert drag filter, draft/publish); phases 4–5 (My Shifts **+ acknowledge banner + assignment detail on tap**, day work queue, overlay); availability pages default to **draft/open** period; supervisor grid defaults open-then-any
- Preventative rules UI is read-only (deprecated; use PM tasks)
- Mobile M1–M6 **audit-verified** (6 tabs, dashboard 4 sources + tools empty state, inference-confirm, documents/search/profile + profile zero-state, push + WS)

### Known Issues / TODOs
- Blueprint designer remaining phases still pending: lock/unlock-all, fine grid toggle, default shape behavior tweaks
- PM auto-generated work order priority still hardcoded; settings tabs (Compliance, Notifications, Gamification, Zones) mostly placeholders
- Schedule time-off persistence still local-only (no DB table yet); procedure steps validated on write but legacy malformed rows ignored on read
- Mobile push requires real device/dev build (not Expo Go); notifications inbox + push-token backing store are in-memory until DB tables land
- Telemetry ingest rate limit is best-effort in-process; consider Redis/edge enforcement for multi-instance deployments

---

## Pending

### Blueprint Designer Polish
- Phase 6: Lock fix + Unlock All button
- Phase 7: Fine grid toggle (8px)
- Phase 8: All shapes → rooms by default, remove draw-room tool

### Schedule
- Phase 6: swap requests (deferred to Expo session)

### Gamification (post-audit)
- Further product tuning beyond audited subscribers + leaderboard + badge seed migrations

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
