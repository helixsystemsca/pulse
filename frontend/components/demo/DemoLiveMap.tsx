"use client";

/**
 * DemoLiveMap
 * ══════════════════════════════════════════════════════════════════════════
 * Self-contained demo dashboard component.
 *
 * Shows the Pool zone with:
 *  - Daniel (worker beacon) moving along the scripted path
 *  - Drill (tool beacon) following Daniel
 *  - Hot Tub Boiler (equipment, PM overdue) stationary
 *  - 2 Node ESP32s and 1 Gateway visualised
 *  - Confidence meter rising as Daniel approaches the boiler
 *  - Inference card sliding in when confidence hits 90%
 *  - Confirm / Dismiss actions wired to demo backend
 *  - "Work order auto-logged" success state
 *
 * Drop into: frontend/components/demo/DemoLiveMap.tsx
 * Use in the dashboard or a dedicated /demo route.
 */

import {
  Activity,
  Bluetooth,
  CheckCircle,
  Radio,
  RefreshCw,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

type BeaconType  = "worker" | "tool" | "equipment";
type BeaconStatus = "online" | "pm_overdue";

type DemoBeacon = {
  id: string;
  label: string;
  type: BeaconType;
  x_norm: number;
  y_norm: number;
  status: BeaconStatus;
};

type DemoGateway = {
  id: string;
  label: string;
  x_norm: number;
  y_norm: number;
  online: boolean;
};

type DemoInference = {
  id: string;
  worker_name: string;
  asset_name: string;
  work_order_id: string;
  pm_name: string;
  pm_overdue_days: number;
  confidence: number;
  status: "pending" | "confirmed" | "dismissed";
  fired_at: number | null;
};

type DemoState = {
  active: boolean;
  elapsed_sec: number;
  scenario_duration: number;
  scenario_complete: boolean;
  inference_status: "idle" | "pending" | "confirmed" | "dismissed";
  confidence: number;
  proximity_m: number;
  beacons: DemoBeacon[];
  gateways: DemoGateway[];
  zone: { id: string; name: string; type: string };
  inference: DemoInference | null;
};

// ── API calls ─────────────────────────────────────────────────────────────────

const api = {
  state:   () => apiFetch<DemoState>("/api/v1/demo/state"),
  start:   () => apiFetch<{ ok: boolean }>("/api/v1/demo/start", { method: "POST" }),
  reset:   () => apiFetch<{ ok: boolean }>("/api/v1/demo/reset", { method: "POST" }),
  confirm: () => apiFetch<{ ok: boolean; message: string }>("/api/v1/demo/confirm", { method: "POST" }),
  dismiss: () => apiFetch<{ ok: boolean }>("/api/v1/demo/dismiss", { method: "POST" }),
};

// ── Beacon colours ────────────────────────────────────────────────────────────

const BEACON_COLORS: Record<BeaconType, { dot: string; ring: string; label: string }> = {
  worker:    { dot: "bg-emerald-400", ring: "ring-emerald-400/40", label: "text-emerald-700 dark:text-emerald-300" },
  tool:      { dot: "bg-blue-400",    ring: "ring-blue-400/40",    label: "text-blue-700 dark:text-blue-300" },
  equipment: { dot: "bg-amber-400",   ring: "ring-amber-400/40",   label: "text-amber-700 dark:text-amber-300" },
};

const PM_OVERDUE_COLORS = { dot: "bg-red-500", ring: "ring-red-500/40", label: "text-red-700 dark:text-red-400" };

// ── Confidence bar ────────────────────────────────────────────────────────────

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 90 ? "bg-emerald-500" :
    pct >= 70 ? "bg-amber-400"   :
    pct >= 40 ? "bg-blue-400"    : "bg-slate-300 dark:bg-slate-600";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px] font-medium">
        <span className="text-ds-muted">Inference confidence</span>
        <span className={pct >= 90 ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-ds-foreground"}>
          {pct}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-ds-border">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-ds-muted">
        {pct >= 90 ? "▲ Notifying worker" :
         pct >= 70 ? "▲ Flagging for manager review" :
         pct >= 40 ? "Monitoring proximity…" :
                     "No inference signal"}
      </p>
    </div>
  );
}

// ── Inference card ────────────────────────────────────────────────────────────

function InferenceCard({
  inference,
  onConfirm,
  onDismiss,
  confirming,
}: {
  inference: DemoInference;
  onConfirm: () => void;
  onDismiss: () => void;
  confirming: boolean;
}) {
  if (inference.status === "confirmed") {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-950/30">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              Work order auto-logged
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
              #{inference.work_order_id.slice(-6).toUpperCase()} · PM in progress — zero manual entry
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (inference.status === "dismissed") {
    return (
      <div className="rounded-md border border-ds-border bg-ds-primary p-3 text-xs text-ds-muted">
        Inference dismissed — logged silently for analytics.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-amber-200/80 bg-amber-50/60 p-4 ring-1 ring-amber-200/50 dark:border-amber-500/30 dark:bg-amber-950/30 dark:ring-amber-500/20 animate-in slide-in-from-top-2 duration-300">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="text-sm font-bold text-amber-900 dark:text-amber-100">
            Maintenance inference
          </span>
        </div>
        <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[11px] font-bold text-amber-900 dark:bg-amber-800/50 dark:text-amber-100">
          {Math.round(inference.confidence * 100)}% confidence
        </span>
      </div>

      {/* Body */}
      <p className="text-sm text-amber-900 dark:text-amber-100 mb-1">
        <span className="font-semibold">{inference.worker_name}</span> appears to be
        working on <span className="font-semibold">{inference.asset_name}</span>
      </p>
      <p className="text-xs text-amber-800/80 dark:text-amber-200/70 mb-3">
        {inference.pm_name} · {inference.pm_overdue_days} days overdue
      </p>

      {/* Evidence pills */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {["Near asset 65s", "Drill beacon detected", "PM overdue", "Scheduled shift", "Pool tech role"].map(e => (
          <span key={e} className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-800/40 dark:text-amber-200">
            ✓ {e}
          </span>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          disabled={confirming}
          className="flex-1 rounded-md bg-ds-accent py-2 text-xs font-bold text-ds-accent-foreground hover:bg-ds-accent/90 disabled:opacity-60 transition-colors"
        >
          {confirming ? "Logging…" : "✓ Yes, confirm & log"}
        </button>
        <button
          onClick={onDismiss}
          className="rounded-md border border-ds-border bg-ds-primary px-3 py-2 text-xs font-semibold text-ds-muted hover:text-ds-foreground transition-colors"
        >
          Not now
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DemoLiveMap() {
  const [demoState, setDemoState]   = useState<DemoState | null>(null);
  const [loading,   setLoading]     = useState(false);
  const [confirming, setConfirming] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll demo state every second when active
  const pollState = useCallback(async () => {
    try {
      const s = await api.state();
      setDemoState(s);
    } catch {
      // Silently ignore — backend might be cold starting
    }
  }, []);

  useEffect(() => {
    void pollState();
    pollRef.current = setInterval(() => void pollState(), 1000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [pollState]);

  const handleStart = async () => {
    setLoading(true);
    try { await api.start(); await pollState(); }
    finally { setLoading(false); }
  };

  const handleReset = async () => {
    await api.reset();
    await pollState();
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try { await api.confirm(); await pollState(); }
    finally { setConfirming(false); }
  };

  const handleDismiss = async () => {
    await api.dismiss();
    await pollState();
  };

  const beacons    = demoState?.beacons    ?? [];
  const gateways   = demoState?.gateways   ?? [];
  const inference  = demoState?.inference  ?? null;
  const isRunning  = demoState?.active     ?? false;
  const elapsed    = demoState?.elapsed_sec ?? 0;
  const confidence = demoState?.confidence  ?? 0;

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-ds-foreground flex items-center gap-2">
            <Activity className="h-4 w-4 text-ds-accent" />
            Live Telemetry Demo · Pool Zone
          </h2>
          <p className="text-xs text-ds-muted mt-0.5">
            1 Gateway · 2 Nodes · 3 Beacons · Real inference engine
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE · {Math.round(elapsed)}s
            </span>
          )}
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded-md border border-ds-border bg-ds-primary px-3 py-1.5 text-xs font-semibold text-ds-muted hover:text-ds-foreground"
          >
            <RefreshCw className="h-3 w-3" />
            Reset
          </button>
          <button
            onClick={handleStart}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md bg-ds-accent px-4 py-1.5 text-xs font-bold text-ds-accent-foreground hover:bg-ds-accent/90 disabled:opacity-60"
          >
            {loading ? "Starting…" : isRunning ? "Restart" : "▶ Start Demo"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">

        {/* ── MAP ── */}
        <div
          ref={mapRef}
          className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-ds-border bg-blue-950/20 dark:bg-blue-950/40"
          style={{ background: "linear-gradient(135deg, #0d1b2a 0%, #0a1628 100%)" }}
        >
          {/* Grid lines */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: "linear-gradient(#4af0c4 1px, transparent 1px), linear-gradient(90deg, #4af0c4 1px, transparent 1px)",
              backgroundSize: "10% 10%",
            }}
          />

          {/* Zone label */}
          <div className="absolute left-3 top-3 rounded-md bg-blue-500/20 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-blue-300 backdrop-blur-sm">
            Pool Zone
          </div>

          {/* Hot Tub area marker */}
          <div
            className="absolute rounded-md border border-red-500/40 bg-red-500/10"
            style={{ left: "15%", top: "55%", width: "22%", height: "28%" }}
          >
            <span className="absolute left-1.5 top-1 text-[8px] font-bold uppercase tracking-wide text-red-400">
              Hot Tub
            </span>
          </div>

          {/* Pool main area marker */}
          <div
            className="absolute rounded-md border border-blue-400/30 bg-blue-400/5"
            style={{ left: "42%", top: "25%", width: "38%", height: "45%" }}
          >
            <span className="absolute left-1.5 top-1 text-[8px] font-bold uppercase tracking-wide text-blue-400/70">
              Main Pool
            </span>
          </div>

          {/* Gateways */}
          {gateways.map((gw) => (
            <div
              key={gw.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${gw.x_norm * 100}%`, top: `${gw.y_norm * 100}%` }}
            >
              <div className="relative">
                <div className="h-3 w-3 rounded-full bg-blue-400 ring-4 ring-blue-400/20 shadow-[0_0_8px_rgba(96,165,250,0.6)]" />
                <span className="absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap text-[8px] font-semibold text-blue-300/70">
                  {gw.label}
                </span>
              </div>
            </div>
          ))}

          {/* Beacons */}
          {beacons.map((beacon) => {
            const isOverdue = beacon.status === "pm_overdue";
            const colors = isOverdue ? PM_OVERDUE_COLORS : BEACON_COLORS[beacon.type];

            return (
              <div
                key={beacon.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-700 ease-in-out"
                style={{ left: `${beacon.x_norm * 100}%`, top: `${beacon.y_norm * 100}%` }}
              >
                <div className="relative group">
                  {/* Pulse ring for overdue */}
                  {isOverdue && (
                    <div className="absolute inset-0 -m-2 rounded-full bg-red-500/20 animate-ping" />
                  )}
                  {/* Dot */}
                  <div className={`h-3.5 w-3.5 rounded-full ring-4 ${colors.dot} ${colors.ring} shadow-md`} />
                  {/* Label */}
                  <span className={`absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap text-[9px] font-bold ${colors.label}`}>
                    {beacon.label}
                    {isOverdue && " ⚠️"}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Confidence ring around boiler when inference is building */}
          {confidence > 0.4 && demoState?.inference_status !== "confirmed" && (
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-emerald-400/50 transition-all duration-500"
              style={{
                left: "25%",
                top: "70%",
                width:  `${Math.max(40, confidence * 80)}px`,
                height: `${Math.max(40, confidence * 80)}px`,
                marginLeft: `-${Math.max(40, confidence * 80) / 2}px`,
                marginTop:  `-${Math.max(40, confidence * 80) / 2}px`,
                opacity: confidence * 0.7,
              }}
            />
          )}

          {/* Empty state */}
          {!isRunning && beacons.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Bluetooth className="mx-auto h-8 w-8 text-ds-muted/40 mb-2" />
                <p className="text-xs text-ds-muted/60">Press Start Demo to begin</p>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="absolute bottom-3 right-3 flex flex-col gap-1 rounded-md bg-black/40 p-2 backdrop-blur-sm">
            {[
              { color: "bg-emerald-400", label: "Worker" },
              { color: "bg-blue-400",    label: "Tool" },
              { color: "bg-red-500",     label: "Equip · PM due" },
              { color: "bg-blue-400 ring-2 ring-blue-400/30", label: "ESP32 node" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`h-2 w-2 rounded-full ${color}`} />
                <span className="text-[9px] text-white/60">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── SIDEBAR ── */}
        <div className="flex flex-col gap-4">

          {/* Hardware summary */}
          <div className="rounded-md border border-ds-border bg-ds-primary p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-ds-muted">
              Hardware active
            </p>
            <div className="space-y-1.5">
              {[
                { icon: Wifi,      label: "Gateway ESP32",  sub: "LTE hub uplink", color: "text-blue-500" },
                { icon: Radio,     label: "Node 1 + Node 2", sub: "ESP-NOW → Gateway", color: "text-blue-400" },
                { icon: Bluetooth, label: "Daniel",          sub: "Worker tag",     color: "text-emerald-500" },
                { icon: Bluetooth, label: "Hot Tub Boiler",  sub: "Equipment · PM overdue", color: "text-red-500" },
                { icon: Bluetooth, label: "Drill",           sub: "Tool tag",       color: "text-blue-400" },
              ].map(({ icon: Icon, label, sub, color }) => (
                <div key={label} className="flex items-center gap-2">
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${color}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-ds-foreground truncate">{label}</p>
                    <p className="text-[10px] text-ds-muted truncate">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Confidence + proximity */}
          <div className="rounded-md border border-ds-border bg-ds-primary p-3 space-y-3">
            <ConfidenceBar confidence={confidence} />
            <div className="flex justify-between text-xs border-t border-ds-border pt-2">
              <span className="text-ds-muted">Proximity</span>
              <span className={`font-semibold ${(demoState?.proximity_m ?? 99) < 3 ? "text-amber-600 dark:text-amber-400" : "text-ds-foreground"}`}>
                {demoState ? `${demoState.proximity_m.toFixed(1)}m` : "—"}
              </span>
            </div>
          </div>

          {/* Inference card */}
          {inference && (
            <InferenceCard
              inference={inference}
              onConfirm={handleConfirm}
              onDismiss={handleDismiss}
              confirming={confirming}
            />
          )}

          {/* Scenario progress */}
          {isRunning && (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-ds-muted">
                <span>Scenario</span>
                <span>{Math.round(elapsed)}s / {demoState?.scenario_duration}s</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-ds-border">
                <div
                  className="h-full rounded-full bg-ds-accent/60 transition-all duration-1000"
                  style={{ width: `${Math.min(100, (elapsed / (demoState?.scenario_duration ?? 120)) * 100)}%` }}
                />
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
