# Pulse · Current State
> Updated by Cursor after each integration.md execution.
> Max 5 bullets per section. No code. No long explanations.

---

## Last Updated
2026-04-26 — blueprint toolbar border artifact fixed

---

## Branch Status
- Main branch is live on Vercel + Render
- Claude branch merged into main
- All telemetry pipeline work (A/B/C/D) is live
- Config system (pulse_config table) is live

---

## What's Live (main)

### Backend
- Telemetry ingest endpoint: POST /api/v1/telemetry/ingest
- Beacon positions endpoint: GET /api/v1/telemetry/positions
- Inference confirm/dismiss: POST /api/v1/telemetry/inferences/{id}/confirm|dismiss
- PM inference engine: maintenance_logic.py fully implemented
- Config system: pulse_config table + ConfigService + GET|PATCH /api/v1/config/{module}

### Frontend
- /settings page: 8-tab config UI, design system aligned
- /live-map page: Live Hardware tab (LiveFacilityMap) + Demo Scenario tab (DemoLiveMap)
- Blueprint designer: tool labels + expanded symbols + templates + task indicators + read-only instructions

---

## Known Issues / TODOs
- Resolved: blueprint toolbar border/underline artifact on tool buttons fixed
- UnifiedFacilityMap.tsx does not exist; /live-map uses LiveFacilityMap + DemoLiveMap separately
- Settings remaining tabs (Compliance, Notifications, Gamification): placeholder content only

