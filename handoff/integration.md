# Live Facility Map — integration.md

## CURSOR PROMPT
"Read handoff/integration.md and execute all steps in order.
Create files first, then modify existing files.
Commit at end with message provided."

---

=== FILE: frontend/components/pulse/LiveFacilityMap.tsx ===

"use client";

import { Bluetooth, RefreshCw, Zap, X, CheckCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { fetchZones, type ZoneOut } from "@/lib/setup-api";
import { usePulseWs, type PulseWsEvent } from "@/hooks/usePulseWs";
import { readSession } from "@/lib/pulse-session";

type BeaconType = "worker" | "equipment" | "tool";

type LiveBeacon = {
  beacon_id: string; label: string; beacon_type: BeaconType;
  x_norm: number; y_norm: number; zone_id: string | null;
  position_confidence: number; pm_overdue: boolean; computed_at: string;
};

type LiveInference = {
  inference_id: string; worker_name: string; asset_name: string;
  confidence: number; pm_name: string | null; pm_overdue_days: number;
  work_order_id: string | null; status: "pending" | "confirmed" | "dismissed";
};

function withCid(path: string, cid: string | null) {
  if (!cid) return path;
  return `${path}${path.includes("?") ? "&" : "?"}company_id=${encodeURIComponent(cid)}`;
}

async function fetchPositions(cid: string | null): Promise<LiveBeacon[]> {
  try {
    const r = await apiFetch<{ beacons: LiveBeacon[] }>(
      withCid("/api/v1/telemetry/positions", cid)
    );
    return r.beacons ?? [];
  } catch { return []; }
}

const BSTYLE: Record<BeaconType, { bg: string; ring: string; lbl: string }> = {
  worker:    { bg: "bg-emerald-500", ring: "ring-emerald-500/30", lbl: "text-emerald-400" },
  equipment: { bg: "bg-amber-400",   ring: "ring-amber-400/30",   lbl: "text-amber-400"   },
  tool:      { bg: "bg-blue-400",    ring: "ring-blue-400/30",    lbl: "text-blue-400"    },
};

function InferenceCard({ inf, cid, onConfirm, onDismiss }: {
  inf: LiveInference; cid: string | null;
  onConfirm: () => void; onDismiss: () => void;
}) {
  const [busy, setBusy] = useState(false);

  if (inf.status === "confirmed") return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-950/30 p-3 flex items-center gap-2">
      <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
      <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-100">
        Work order auto-logged · zero manual entry
      </p>
    </div>
  );

  if (inf.status === "dismissed") return null;

  return (
    <div className="rounded-md border border-amber-200/80 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-950/30 p-3 space-y-2 animate-in slide-in-from-top-1 duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span className="text-xs font-bold text-amber-900 dark:text-amber-100">
            Maintenance inference
          </span>
        </div>
        <span className="text-[10px] font-bold rounded-full bg-amber-200/80 dark:bg-amber-800/50 px-2 py-0.5 text-amber-900 dark:text-amber-100">
          {Math.round(inf.confidence * 100)}%
        </span>
      </div>
      <p className="text-xs text-amber-900 dark:text-amber-100">
        <span className="font-semibold">{inf.worker_name}</span> appears to be working on{" "}
        <span className="font-semibold">{inf.asset_name}</span>
        {inf.pm_overdue_days > 0 && (
          <span className="text-amber-600"> · PM {inf.pm_overdue_days}d overdue</span>
        )}
      </p>
      <div className="flex gap-2">
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await apiFetch(
              withCid(`/api/v1/telemetry/inferences/${inf.inference_id}/confirm`, cid),
              { method: "POST" }
            );
            onConfirm();
          }}
          className="flex-1 rounded-md bg-ds-accent py-1.5 text-xs font-bold text-ds-accent-foreground hover:bg-ds-accent/90 disabled:opacity-60"
        >
          {busy ? "Logging…" : "✓ Confirm & log"}
        </button>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await apiFetch(
              withCid(`/api/v1/telemetry/inferences/${inf.inference_id}/dismiss`, cid),
              { method: "POST" }
            );
            onDismiss();
          }}
          className="rounded-md border border-ds-border bg-ds-primary px-3 py-1.5 text-xs text-ds-muted hover:text-ds-foreground disabled:opacity-60"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

export type LiveFacilityMapProps = {
  className?: string;
  compact?: boolean;
  pollMs?: number;
};

export function LiveFacilityMap({
  className = "", compact = false, pollMs = 5000,
}: LiveFacilityMapProps) {
  const cid     = readSession()?.company_id ?? null;
  const mounted = useRef(true);

  const [zones,     setZones]     = useState<ZoneOut[]>([]);
  const [beacons,   setBeacons]   = useState<LiveBeacon[]>([]);
  const [inference, setInference] = useState<LiveInference | null>(null);
  const [loading,   setLoading]   = useState(true);

  const load = useCallback(async () => {
    const [z, b] = await Promise.all([fetchZones(cid), fetchPositions(cid)]);
    if (!mounted.current) return;
    setZones(z); setBeacons(b); setLoading(false);
  }, [cid]);

  useEffect(() => {
    mounted.current = true;
    void load();
    const id = setInterval(() => {
      void fetchPositions(cid).then(b => { if (mounted.current) setBeacons(b); });
    }, pollMs);
    return () => { mounted.current = false; clearInterval(id); };
  }, [load, cid, pollMs]);

  usePulseWs(useCallback((evt: PulseWsEvent) => {
    if (evt.event_type === "position_update" || evt.event_type === "demo_position_update") {
      const d = evt.metadata as { beacons?: LiveBeacon[] } | null;
      if (d?.beacons) setBeacons(d.beacons);
    }
    if (
      evt.event_type === "maintenance_inference_request" ||
      evt.event_type === "demo_inference_fired"
    ) {
      const d = evt.metadata as LiveInference | null;
      if (d) setInference({ ...d, status: "pending" });
    }
    if (evt.event_type === "demo_inference_confirmed")
      setInference(p => p ? { ...p, status: "confirmed" } : null);
    if (evt.event_type === "demo_inference_dismissed")
      setInference(null);
  }, []), true);

  const cols = Math.max(1, Math.ceil(Math.sqrt(zones.length)));
  const rows = Math.max(1, Math.ceil(zones.length / cols));

  return (
    <div className={`w-full space-y-3 ${className}`}>
      <div className={`rounded-md border border-ds-border bg-ds-primary shadow-sm ${compact ? "p-2.5" : "p-3 sm:p-4"}`}>

        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ds-muted">
            Facility · {zones.length > 0
              ? `${zones.length} zone${zones.length !== 1 ? "s" : ""}`
              : "Zone map"}
          </p>
          <div className="flex items-center gap-2">
            {beacons.length > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {beacons.length} active
              </span>
            )}
            <button onClick={() => void load()} className="text-ds-muted hover:text-ds-foreground">
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div
          className="relative w-full overflow-hidden rounded border border-ds-border bg-slate-950/40"
          style={{ aspectRatio: "16/9" }}
        >
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-ds-accent border-t-transparent" />
            </div>
          )}

          {!loading && zones.length === 0 && beacons.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <Bluetooth className="h-6 w-6 text-ds-muted/40" />
              <p className="text-xs text-ds-muted/60 text-center px-4">
                No zones yet. Set up zones in Zones &amp; Devices.
              </p>
            </div>
          )}

          {/* Grid lines */}
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage:
              "linear-gradient(rgba(148,163,184,0.5) 1px,transparent 1px)," +
              "linear-gradient(90deg,rgba(148,163,184,0.5) 1px,transparent 1px)",
            backgroundSize: "10% 10%",
          }} />

          {/* Zone cells */}
          {zones.map((zone, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            return (
              <div
                key={zone.id}
                className="absolute border border-slate-400/20 bg-slate-400/5 hover:bg-slate-400/10 transition-colors"
                style={{
                  left:   `${(col / cols) * 100}%`,
                  top:    `${(row / rows) * 100}%`,
                  width:  `${100 / cols}%`,
                  height: `${100 / rows}%`,
                }}
              >
                <span className="absolute left-1.5 top-1 text-[8px] font-bold uppercase tracking-wide text-slate-400/70 truncate max-w-full pr-1">
                  {zone.name}
                </span>
              </div>
            );
          })}

          {/* Beacon dots */}
          {beacons.map((b) => {
            const s = b.pm_overdue
              ? { bg: "bg-red-500", ring: "ring-red-500/30", lbl: "text-red-400" }
              : (BSTYLE[b.beacon_type] ?? BSTYLE.equipment);
            return (
              <div
                key={b.beacon_id}
                title={`${b.label}${b.pm_overdue ? " · PM overdue" : ""}`}
                className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-700 ease-in-out z-10"
                style={{ left: `${b.x_norm * 100}%`, top: `${b.y_norm * 100}%` }}
              >
                {b.pm_overdue && (
                  <div className="absolute inset-0 -m-1.5 rounded-full bg-red-500/20 animate-ping" />
                )}
                <div className={`h-2.5 w-2.5 rounded-full ring-4 shadow ${s.bg} ${s.ring}`} />
                <span className={`absolute left-1/2 top-3.5 -translate-x-1/2 whitespace-nowrap text-[8px] font-bold pointer-events-none ${s.lbl}`}>
                  {b.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-2 flex flex-wrap gap-3">
          {(["worker", "equipment", "tool"] as BeaconType[]).map(t => (
            <div key={t} className="flex items-center gap-1.5">
              <div className={`h-2 w-2 rounded-full ${BSTYLE[t].bg}`} />
              <span className="text-[9px] text-ds-muted capitalize">{t}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-[9px] text-ds-muted">PM overdue</span>
          </div>
        </div>
      </div>

      {/* Inference card */}
      {inference && (
        <InferenceCard
          inf={inference}
          cid={cid}
          onConfirm={() => setInference(p => p ? { ...p, status: "confirmed" } : null)}
          onDismiss={() => setInference(null)}
        />
      )}
    </div>
  );
}


=== FILE: backend/app/api/telemetry_positions_routes.py ===

from __future__ import annotations
from typing import Annotated, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.domain import User
from app.models.device_hub import AutomationBleDevice, BeaconPosition

router = APIRouter(prefix="/telemetry", tags=["telemetry-live"])


class LiveBeaconOut(BaseModel):
    beacon_id: str
    label: str
    beacon_type: str
    x_norm: float
    y_norm: float
    zone_id: Optional[str]
    position_confidence: Optional[float]
    pm_overdue: bool = False
    computed_at: datetime
    model_config = {"from_attributes": True}


class PositionsOut(BaseModel):
    beacons: list[LiveBeaconOut]


@router.get("/positions", response_model=PositionsOut)
async def get_live_positions(
    db:   Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> PositionsOut:
    cid  = str(user.company_id)
    rows = await db.execute(
        select(BeaconPosition, AutomationBleDevice)
        .join(AutomationBleDevice, AutomationBleDevice.id == BeaconPosition.beacon_id)
        .where(BeaconPosition.company_id == cid)
    )
    return PositionsOut(beacons=[
        LiveBeaconOut(
            beacon_id=pos.beacon_id,
            label=device.label or device.mac_address,
            beacon_type=device.type,
            x_norm=pos.x_norm or 0.5,
            y_norm=pos.y_norm or 0.5,
            zone_id=pos.zone_id,
            position_confidence=pos.position_confidence,
            pm_overdue=False,  # TODO: join pm_tasks to flag overdue
            computed_at=pos.computed_at,
        )
        for pos, device in rows.all()
    ])


@router.post("/inferences/{inference_id}/confirm", status_code=200)
async def confirm_inference(
    inference_id: str,
    db:   Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> dict:
    await db.execute(text(
        "UPDATE maintenance_inferences "
        "SET status='confirmed', confirmed_at=:now, confirmed_by=:uid "
        "WHERE id=:id AND company_id=:cid"
    ), {
        "id": inference_id, "cid": str(user.company_id),
        "now": datetime.now(timezone.utc), "uid": str(user.id),
    })
    await db.commit()
    return {"ok": True}


@router.post("/inferences/{inference_id}/dismiss", status_code=200)
async def dismiss_inference(
    inference_id: str,
    db:   Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> dict:
    await db.execute(text(
        "UPDATE maintenance_inferences SET status='dismissed' "
        "WHERE id=:id AND company_id=:cid"
    ), {"id": inference_id, "cid": str(user.company_id)})
    await db.commit()
    return {"ok": True}


=== MODIFY: backend/app/main.py ===
ACTION: add after the last app.include_router line

from app.api.telemetry_positions_routes import router as telemetry_positions_router
app.include_router(telemetry_positions_router, prefix="/api/v1")


=== MODIFY: frontend/components/pulse/ToolEquipmentTrackingSection.tsx ===
ACTION: swap FacilityMap for LiveFacilityMap

FIND:    import { FacilityMap } from "./FacilityMap";
REPLACE: import { LiveFacilityMap } from "./LiveFacilityMap";

FIND:    <FacilityMap compact className="w-full" />
REPLACE: <LiveFacilityMap compact className="w-full" pollMs={5000} />


---

## EXECUTION STEPS
1. Create frontend/components/pulse/LiveFacilityMap.tsx
2. Create backend/app/api/telemetry_positions_routes.py
3. Modify backend/app/main.py — add router import + include
4. Modify frontend/components/pulse/ToolEquipmentTrackingSection.tsx — swap component
5. git add -A && git commit -m "feat: live facility map with zone rendering and beacon positions"

---

## VALIDATION
- [ ] GET /api/v1/telemetry/positions returns {"beacons": []}
- [ ] LiveFacilityMap renders — shows empty state when no beacons
- [ ] Zones from API appear as labelled grid cells
- [ ] Beacon dots animate on position_update WS event
- [ ] Inference card appears on maintenance_inference_request WS event
- [ ] Confirm/dismiss call correct endpoints
- [ ] Vercel build passes (no extra exports in any page file)
