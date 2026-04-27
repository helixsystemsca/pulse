# Mobile Phase M4 — Search Screen + Backend Endpoint
# handoff/M4integration.md

## CURSOR PROMPT
"Read handoff/M4integration.md and handoff/contracts.md.
Execute steps in order. Check file exists before creating.
All changes span MobileApp/ and backend/. Commit with message provided."

---

## WHAT EXISTS (do not recreate)
- apiFetch(path, {token}) in MobileApp/lib/api/client.ts
- apiFetch in frontend uses same pattern
- PulseWorkRequest, AutomationBleDevice, FacilityEquipment, PulseProcedure exist in backend models
- beacon_positions table exists — has x_norm, y_norm, zone_id
- GET /api/v1/ble-devices returns BLE devices
- GET /api/v1/pulse/procedures (TODO: verify endpoint name)
- Inventory model exists in pulse_models.py (TODO: verify table name)

---

## STEP 1 — Backend unified search endpoint

=== FILE: backend/app/api/search_routes.py ===

```python
"""
GET /api/v1/search?q=<query>
Unified search across tools, equipment, procedures, and inventory.
Returns typed result buckets. Max 5 results per bucket.
"""
from __future__ import annotations

import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.domain import User, FacilityEquipment
from app.models.device_hub import AutomationBleDevice, BeaconPosition
from app.models.pulse_models import PulseWorkRequest

log = logging.getLogger("pulse.search")
router = APIRouter(prefix="/search", tags=["search"])


class SearchResultItem(BaseModel):
    id: str
    kind: str          # "tool" | "equipment" | "procedure" | "work_request"
    title: str
    subtitle: str | None = None
    meta: dict[str, Any] = {}


class SearchResults(BaseModel):
    query: str
    tools: list[SearchResultItem] = []
    equipment: list[SearchResultItem] = []
    procedures: list[SearchResultItem] = []
    work_requests: list[SearchResultItem] = []
    total: int = 0


@router.get("", response_model=SearchResults)
async def unified_search(
    db:    Annotated[AsyncSession, Depends(get_db)],
    user:  Annotated[User, Depends(get_current_user)],
    q:     str = Query("", min_length=0, max_length=100),
) -> SearchResults:
    cid = str(user.company_id)
    term = q.strip().lower()

    if not term:
        return SearchResults(query=q)

    like = f"%{term}%"
    results = SearchResults(query=q)

    # ── BLE tools ────────────────────────────────────────────────────────────
    try:
        tool_q = await db.execute(
            select(AutomationBleDevice, BeaconPosition)
            .outerjoin(BeaconPosition, BeaconPosition.beacon_id == AutomationBleDevice.id)
            .where(
                AutomationBleDevice.company_id == cid,
                AutomationBleDevice.label.ilike(like),
            )
            .limit(5)
        )
        for device, pos in tool_q.all():
            results.tools.append(SearchResultItem(
                id=str(device.id),
                kind="tool",
                title=device.label or device.mac_address,
                subtitle=f"Last seen: {pos.computed_at.strftime('%b %d %H:%M') if pos else 'Unknown'}",
                meta={
                    "mac_address": device.mac_address,
                    "type": device.type,
                    "zone_id": str(pos.zone_id) if pos and pos.zone_id else None,
                    "x_norm": pos.x_norm if pos else None,
                    "y_norm": pos.y_norm if pos else None,
                },
            ))
    except Exception as e:
        log.warning("search tools failed: %s", e)

    # ── Facility equipment ────────────────────────────────────────────────────
    try:
        equip_q = await db.execute(
            select(FacilityEquipment).where(
                FacilityEquipment.company_id == cid,
                or_(
                    FacilityEquipment.name.ilike(like),
                    FacilityEquipment.type.ilike(like),
                ),
            ).limit(5)
        )
        for eq in equip_q.scalars():
            results.equipment.append(SearchResultItem(
                id=str(eq.id),
                kind="equipment",
                title=eq.name,
                subtitle=eq.type or None,
                meta={"zone_id": str(eq.zone_id) if eq.zone_id else None},
            ))
    except Exception as e:
        log.warning("search equipment failed: %s", e)

    # ── Work requests ─────────────────────────────────────────────────────────
    try:
        wr_q = await db.execute(
            select(PulseWorkRequest).where(
                PulseWorkRequest.company_id == cid,
                PulseWorkRequest.title.ilike(like),
            ).limit(5)
        )
        for wr in wr_q.scalars():
            results.work_requests.append(SearchResultItem(
                id=str(wr.id),
                kind="work_request",
                title=wr.title,
                subtitle=str(wr.status),
                meta={"priority": str(wr.priority), "status": str(wr.status)},
            ))
    except Exception as e:
        log.warning("search work_requests failed: %s", e)

    # ── Procedures ────────────────────────────────────────────────────────────
    try:
        from app.models.pulse_models import PulseProcedure
        proc_q = await db.execute(
            select(PulseProcedure).where(
                PulseProcedure.company_id == cid,
                PulseProcedure.title.ilike(like),
            ).limit(5)
        )
        for proc in proc_q.scalars():
            results.procedures.append(SearchResultItem(
                id=str(proc.id),
                kind="procedure",
                title=proc.title,
                subtitle=None,
                meta={},
            ))
    except Exception as e:
        log.warning("search procedures failed: %s", e)

    results.total = (
        len(results.tools) + len(results.equipment) +
        len(results.procedures) + len(results.work_requests)
    )

    log.info("search q=%r company=%s total=%d", term, cid[:8], results.total)
    return results
```

=== MODIFY: backend/app/main.py ===
ACTION: register search router after existing routers

```python
from app.api.search_routes import router as search_router
app.include_router(search_router, prefix="/api/v1")
```

---

## STEP 2 — Search API lib (mobile)

=== FILE: MobileApp/lib/api/search.ts ===

```ts
import { apiFetch } from "./client";

export type SearchResultItem = {
  id: string;
  kind: "tool" | "equipment" | "procedure" | "work_request";
  title: string;
  subtitle?: string | null;
  meta: Record<string, unknown>;
};

export type SearchResults = {
  query: string;
  tools: SearchResultItem[];
  equipment: SearchResultItem[];
  procedures: SearchResultItem[];
  work_requests: SearchResultItem[];
  total: number;
};

export async function search(token: string, q: string): Promise<SearchResults> {
  return apiFetch<SearchResults>(`/api/v1/search?q=${encodeURIComponent(q)}`, { token });
}
```

---

## STEP 3 — Search screen

=== FILE: MobileApp/app/(tabs)/search.tsx ===

```tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Pressable, ScrollView,
  Text, TextInput, View,
} from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/store/session";
import { search, type SearchResultItem, type SearchResults } from "@/lib/api/search";
import { Screen } from "@/components/Screen";

const KIND_ICONS: Record<string, string> = {
  tool: "🔧",
  equipment: "⚙️",
  procedure: "📋",
  work_request: "📝",
};

const KIND_LABELS: Record<string, string> = {
  tool: "Tool",
  equipment: "Equipment",
  procedure: "Procedure",
  work_request: "Work Request",
};

const QUICK_FINDS = [
  { label: "My Tools", q: "tool" },
  { label: "Equipment", q: "equipment" },
  { label: "Procedures", q: "procedure" },
];

export default function SearchScreen() {
  const { colors, radii, spacing, text } = useTheme();
  const { session } = useSession();
  const router = useRouter();
  const token = session?.token ?? "";

  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (query: string) => {
    if (!token || !query.trim()) { setResults(null); return; }
    setLoading(true);
    setErr(null);
    try {
      setResults(await search(token, query.trim()));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults(null); return; }
    debounceRef.current = setTimeout(() => void doSearch(q), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q, doSearch]);

  const allResults = useMemo<SearchResultItem[]>(() => {
    if (!results) return [];
    return [
      ...results.tools,
      ...results.equipment,
      ...results.procedures,
      ...results.work_requests,
    ];
  }, [results]);

  const handleTap = (item: SearchResultItem) => {
    switch (item.kind) {
      case "tool":
        router.push("/(tabs)/search" as never); // TODO: tool detail when available
        break;
      case "procedure":
        router.push({ pathname: "/procedure-assignment", params: { id: item.id } } as never);
        break;
      case "work_request":
        router.push("/(tabs)/tasks" as never);
        break;
      default:
        break;
    }
  };

  return (
    <Screen>
      <View style={{ padding: spacing.lg, paddingBottom: 0 }}>
        <Text style={{ color: colors.text, ...text.h1, marginBottom: spacing.md }}>Search</Text>

        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Tools, equipment, procedures…"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          style={{
            padding: spacing.md, borderRadius: radii.lg,
            borderWidth: 1, borderColor: colors.border,
            backgroundColor: colors.surface, color: colors.text, fontSize: 16,
          }}
        />

        {/* Quick find chips */}
        {!q.trim() && (
          <View style={{ flexDirection: "row", gap: 8, marginTop: spacing.md }}>
            {QUICK_FINDS.map(qf => (
              <Pressable
                key={qf.q}
                onPress={() => setQ(qf.q)}
                style={{
                  paddingVertical: 8, paddingHorizontal: 14,
                  borderRadius: 999, borderWidth: 1,
                  borderColor: colors.border, backgroundColor: colors.surface,
                }}
              >
                <Text style={{ color: colors.muted, fontWeight: "900", fontSize: 12 }}>
                  {qf.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}>
        {loading && (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <ActivityIndicator color={colors.success} />
          </View>
        )}

        {err && !loading && (
          <Text style={{ color: colors.danger, marginTop: spacing.md }}>{err}</Text>
        )}

        {!q.trim() && !loading && (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "900", letterSpacing: 0.8, marginBottom: 8 }}>
              SEARCH FOR ANYTHING
            </Text>
            <Text style={{ color: colors.muted }}>
              Find tools by name or location, equipment by zone, procedures by title, or work requests by keyword.
            </Text>
          </View>
        )}

        {results && !loading && (
          <>
            {results.total === 0 && (
              <Text style={{ color: colors.muted, marginTop: spacing.md, textAlign: "center" }}>
                No results for "{q}"
              </Text>
            )}

            {allResults.map(item => (
              <Pressable
                key={`${item.kind}-${item.id}`}
                onPress={() => handleTap(item)}
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderWidth: 1, borderRadius: radii.lg,
                  padding: spacing.lg, marginBottom: spacing.sm,
                  flexDirection: "row", alignItems: "center", gap: 12,
                }}
              >
                <Text style={{ fontSize: 22 }}>{KIND_ICONS[item.kind] ?? "📄"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "900" }} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {item.subtitle && (
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>
                      {item.subtitle}
                    </Text>
                  )}
                </View>
                <View style={{
                  paddingHorizontal: 8, paddingVertical: 3,
                  borderRadius: 999, backgroundColor: colors.surface,
                  borderWidth: 1, borderColor: colors.border,
                }}>
                  <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "900" }}>
                    {KIND_LABELS[item.kind]}
                  </Text>
                </View>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
```

---

## EXECUTION STEPS
1. Create backend/app/api/search_routes.py
2. Modify backend/app/main.py — register search router
3. Create MobileApp/lib/api/search.ts
4. Create MobileApp/app/(tabs)/search.tsx
5. git add -A && git commit -m "feat(mobile/M4): unified search endpoint + search screen"

---

## VALIDATION
- [ ] GET /api/v1/search?q=drill returns typed results for tools/equipment/procedures/WRs
- [ ] Search screen shows results within 400ms debounce
- [ ] Quick find chips pre-fill the search query
- [ ] Empty query shows helpful placeholder text
- [ ] No results state shows correct message
- [ ] Tapping a procedure result navigates to procedure-assignment
- [ ] Tapping a work request navigates to tasks tab
- [ ] Backend gracefully handles missing models with try/catch per bucket

---

## UPDATE handoff/current_state.md
- Add: Mobile M4 — unified search endpoint + search screen with debounce
- Update Pending: M5, M6 remaining
git add handoff/current_state.md
git commit -m "chore: update current_state after mobile M4"
