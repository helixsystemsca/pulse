# Mobile Phase M6 — Push Notifications + Availability Wiring
# handoff/M6integration.md

## CURSOR PROMPT
"Read handoff/M6integration.md and handoff/contracts.md.
Execute steps in order. Check file exists before creating.
All changes are inside MobileApp/ unless marked backend/.
Commit with message provided."

---

## WHAT EXISTS (do not recreate)
- lib/notifications.ts — ensurePushPermissions(), registerNotificationDeepLinks(),
  notifyLocal() are all scaffolded. isExpoGo() guard exists.
- app/_layout.tsx — root layout, loads session, configures API
- subscribePulseWs in lib/realtime/pulseWs.ts
- Schedule screen has availability submission that calls patchWorkerProfile
- lib/api/schedule.ts — listShifts, listZones exist
- Schedule Phase 2 backend: POST /api/v1/pulse/schedule/availability exists
- POST /api/v1/pulse/schedule/acknowledge exists
- GET /api/v1/pulse/schedule/periods exists

---

## STEP 1 — Push token registration

=== MODIFY: MobileApp/app/_layout.tsx ===

ACTION: register push token with backend on login and wire deep link handler

Find where session is loaded and API is configured. After session is confirmed:

```tsx
import { ensurePushPermissions, registerNotificationDeepLinks } from "@/lib/notifications";
import { apiFetch } from "@/lib/api/client";

// Inside the root layout effect that runs when session changes:
useEffect(() => {
  if (!session?.token) return;

  // Request push permissions and register token with backend
  void (async () => {
    try {
      const granted = await ensurePushPermissions();
      if (!granted) return;

      // Get the push token
      const { default: Constants } = await import("expo-constants");
      const { getExpoPushTokenAsync } = await import("expo-notifications");
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        (Constants.easConfig as { projectId?: string } | undefined)?.projectId;
      if (!projectId) return;

      const tokenData = await getExpoPushTokenAsync({ projectId });
      const pushToken = tokenData.data;

      // Register with backend
      await apiFetch("/api/v1/notifications/push-token", {
        method: "POST",
        token: session.token,
        body: { token: pushToken, platform: Platform.OS },
      });
    } catch {
      // Non-fatal — push notifications are enhancement not requirement
    }
  })();

  // Wire deep link handler
  const cleanup = registerNotificationDeepLinks();
  return cleanup;
}, [session?.token]);
```

Add `import { Platform } from "react-native"` if not already imported.

---

## STEP 2 — Backend push token storage

=== FILE: backend/app/api/notifications_routes.py ===

```python
"""
Push notification token registration and notification listing.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Annotated, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.domain import User

log = logging.getLogger("pulse.notifications")
router = APIRouter(prefix="/notifications", tags=["notifications"])


# ── In-memory push token store (replace with DB table in production) ──────────
# TODO: create pulse_push_tokens table with (id, company_id, user_id,
#       token, platform, created_at) and use that instead
_push_tokens: dict[str, list[dict]] = {}  # user_id → [{token, platform}]


class PushTokenIn(BaseModel):
    token: str
    platform: str  # "ios" | "android"


class NotificationOut(BaseModel):
    id: str
    event_type: str
    title: str
    body: str
    read: bool
    created_at: str
    metadata: dict = {}


# In-memory notification store — replace with DB table
# TODO: create pulse_notifications table
_notifications: dict[str, list[dict]] = {}  # company_id → [notification]


@router.post("/push-token", status_code=204)
async def register_push_token(
    body: PushTokenIn,
    user: Annotated[User, Depends(get_current_user)],
) -> None:
    """Register an Expo push token for the current user."""
    uid = str(user.id)
    if uid not in _push_tokens:
        _push_tokens[uid] = []
    # Deduplicate
    existing = [t for t in _push_tokens[uid] if t["token"] != body.token]
    existing.append({"token": body.token, "platform": body.platform})
    _push_tokens[uid] = existing
    log.info("push_token registered user=%s platform=%s", uid[:8], body.platform)


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    user: Annotated[User, Depends(get_current_user)],
    limit: int = 30,
) -> list[NotificationOut]:
    """Return recent notifications for the current user."""
    cid = str(user.company_id)
    uid = str(user.id)

    # Return company-wide + user-specific notifications
    company_notifs = _notifications.get(cid, [])
    user_notifs    = _notifications.get(uid, [])
    all_notifs     = sorted(
        company_notifs + user_notifs,
        key=lambda n: n["created_at"],
        reverse=True,
    )[:limit]

    return [NotificationOut(**n) for n in all_notifs]


@router.post("/{notification_id}/read", status_code=204)
async def mark_read(
    notification_id: str,
    user: Annotated[User, Depends(get_current_user)],
) -> None:
    """Mark a notification as read."""
    cid = str(user.company_id)
    uid = str(user.id)
    for bucket in [_notifications.get(cid, []), _notifications.get(uid, [])]:
        for n in bucket:
            if n["id"] == notification_id:
                n["read"] = True
                return
```

=== MODIFY: backend/app/main.py ===
ACTION: register notifications router

```python
from app.api.notifications_routes import router as notifications_router
app.include_router(notifications_router, prefix="/api/v1")
```

---

## STEP 3 — Wire WS events to push notifications on mobile

=== MODIFY: MobileApp/app/_layout.tsx ===

ACTION: subscribe to WS events and send local notifications for key events

After the push token registration effect, add:

```tsx
import { subscribePulseWs } from "@/lib/realtime/pulseWs";
import { notifyLocal } from "@/lib/notifications";

useEffect(() => {
  if (!session?.token) return;
  return subscribePulseWs(session.token, async (evt) => {
    switch (evt.event_type) {
      case "schedule.period_published": {
        await notifyLocal({
          title: "Schedule published",
          body: "Your schedule is ready. Tap to view your shifts.",
          to: "/(tabs)/schedule",
        });
        break;
      }
      case "maintenance_inference_request":
      case "demo_inference_fired": {
        const meta = evt.metadata ?? {};
        const assetName = String(meta.asset_name ?? "an asset");
        await notifyLocal({
          title: "Maintenance detected",
          body: `Are you working on ${assetName}? Tap to confirm.`,
          to: `/inference-confirm?inference_id=${meta.inference_id ?? ""}&asset_name=${encodeURIComponent(assetName)}&confidence=${meta.confidence ?? 0}&pm_overdue_days=${meta.pm_overdue_days ?? 0}`,
        });
        break;
      }
      case "work_request.assigned": {
        await notifyLocal({
          title: "New task assigned",
          body: String(evt.metadata?.title ?? "A work request has been assigned to you."),
          to: "/(tabs)/tasks",
        });
        break;
      }
      default:
        break;
    }
  });
}, [session?.token]);
```

---

## STEP 4 — Wire availability submission to real period API

=== MODIFY: MobileApp/app/(tabs)/schedule.tsx ===

ACTION: replace patchWorkerProfile availability save with period-based submission

Find the Save button handler in the availability tab (step 2 of the availStep flow).
It currently calls `patchWorkerProfile` with a version/dates payload.

Replace with:

```tsx
// At top of component, add period loading:
const [activePeriod, setActivePeriod] = useState<{ id: string; start_date: string; end_date: string } | null>(null);

// In the load() function, also fetch active period:
try {
  const periods = await apiFetch<Array<{ id: string; start_date: string; end_date: string; status: string }>>(
    "/api/v1/pulse/schedule/periods",
    { token }
  );
  const active = periods.find(p => p.status === "draft" || p.status === "open");
  if (active) setActivePeriod(active);
} catch { /* non-fatal */ }

// Replace the Save handler in availStep === 2:
// FIND: await patchWorkerProfile(session.token, session.user.id, { availability: { version: 1, dates: payload } });
// REPLACE WITH:

if (activePeriod) {
  // Submit to period-based availability endpoint (Phase 2 backend)
  const windows: Array<{ weekday: number; start_min: number; end_min: number }> = [];
  for (const [dateStr, shifts] of Object.entries(payload)) {
    const wd = new Date(dateStr + "T00:00:00").getDay(); // 0=Sun
    for (const shift of shifts) {
      const start = shift === "morning" ? 7 * 60 : shift === "afternoon" ? 15 * 60 : 23 * 60;
      const end   = shift === "morning" ? 15 * 60 : shift === "afternoon" ? 23 * 60 : 7 * 60;
      windows.push({ weekday: wd, start_min: start, end_min: end });
    }
  }
  await apiFetch("/api/v1/pulse/schedule/availability", {
    method: "POST",
    token: session.token,
    body: { period_id: activePeriod.id, windows, exceptions: [] },
  });
} else {
  // Fallback: patch worker profile directly (no active period)
  await patchWorkerProfile(session.token, session.user.id, {
    availability: { version: 1, dates: payload },
  });
}
Alert.alert("Availability", "Saved");
```

Add `import { apiFetch } from "@/lib/api/client";` if not already imported.

---

## STEP 5 — Schedule acknowledgement button

=== MODIFY: MobileApp/app/(tabs)/schedule.tsx ===

ACTION: add acknowledgement button to My Shifts tab header

In the schedule tab, when `tab === "schedule"` and `myShifts.length > 0`,
add an acknowledgement section at the top of the My Shifts list:

```tsx
// Add state:
const [acknowledged, setAcknowledged] = useState(false);
const [ackBusy, setAckBusy] = useState(false);

// Add acknowledgement UI above the myShifts list:
{!acknowledged && activePeriod && (
  <Pressable
    disabled={ackBusy}
    onPress={async () => {
      if (!session || !activePeriod) return;
      setAckBusy(true);
      try {
        await apiFetch("/api/v1/pulse/schedule/acknowledge", {
          method: "POST",
          token: session.token,
          body: { period_id: activePeriod.id },
        });
        setAcknowledged(true);
      } catch { /* non-fatal */ } finally { setAckBusy(false); }
    }}
    style={{
      backgroundColor: "rgba(54,241,205,0.10)",
      borderColor: "rgba(54,241,205,0.35)",
      borderWidth: 1, borderRadius: radii.lg,
      padding: spacing.lg, marginBottom: spacing.md,
      flexDirection: "row", alignItems: "center", gap: 10,
    }}
  >
    <Text style={{ fontSize: 18 }}>{ackBusy ? "⏳" : "📋"}</Text>
    <View style={{ flex: 1 }}>
      <Text style={{ color: colors.text, fontWeight: "900" }}>
        {ackBusy ? "Acknowledging…" : "Acknowledge schedule"}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
        Tap to confirm you've seen your shifts for this period.
      </Text>
    </View>
  </Pressable>
)}
{acknowledged && (
  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.md }}>
    <Text style={{ color: colors.success, fontWeight: "900" }}>✓ Schedule acknowledged</Text>
  </View>
)}
```

---

## EXECUTION STEPS
1. Modify MobileApp/app/_layout.tsx — push token registration + WS → local notifications
2. Create backend/app/api/notifications_routes.py
3. Modify backend/app/main.py — register notifications router
4. Modify MobileApp/app/(tabs)/schedule.tsx — period-based availability + acknowledgement
5. git add -A && git commit -m "feat(mobile/M6): push notifications, WS→local notify, period availability, acknowledgement"

---

## VALIDATION
- [ ] On login, push permission is requested (on real device, not Expo Go)
- [ ] Push token POST hits /api/v1/notifications/push-token without error
- [ ] WS inference event triggers local notification on device
- [ ] WS schedule published event triggers local notification
- [ ] Tapping notification deep-links to correct screen
- [ ] GET /api/v1/notifications returns list (empty is fine)
- [ ] Availability submission uses period_id when active period exists
- [ ] Acknowledge button appears in My Shifts when period is active
- [ ] Acknowledging calls /api/v1/pulse/schedule/acknowledge and shows confirmation

---

## UPDATE handoff/current_state.md
- Add: Mobile M6 — push token registration, WS→local notifications, period-based availability, schedule acknowledgement
- Add: All 6 mobile phases complete (M1–M6)
- Add to Known Issues: push notifications require real device build (not Expo Go); notifications_routes uses in-memory store — needs DB table (pulse_notifications) for production
- Update Last Updated
git add handoff/current_state.md
git commit -m "chore: update current_state after mobile M6 — all mobile phases complete"
