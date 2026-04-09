"use client";

import { Activity, Bluetooth, ChevronDown, CircleAlert, Router, WifiOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import type { DetectionMatchType } from "@/lib/detectionTest";
import type { BleDeviceOut, GatewayOut } from "@/lib/setup-api";

const cardBase =
  "rounded-md border border-ds-border bg-ds-primary p-5 shadow-[var(--ds-shadow-card)]";

type GatewayProps = {
  variant: "gateway";
  gateway: GatewayOut;
  operationalStatus: "online" | "offline";
  zoneLabel: string | null;
  /** Prefer operational API `last_seen_at`; falls back to model field. */
  lastHeardAt: string | null;
  /** From `/gateways/status` when present — drives heartbeat / signal health copy. */
  secondsSinceLastSeen?: number | null;
  onChangeZone?: () => void;
  testListening?: boolean;
  testSuccessFlash?: boolean;
  testMatchKind?: DetectionMatchType;
  /** Logged match time + type for relative debug line in payload panel. */
  testMatchDebug?: { loggedAt: number; matchType: DetectionMatchType } | null;
  /** Populated when test matches live traffic (slim automation payload). */
  testMatchDetails?: { payload: Record<string, unknown>; created_at: string | null } | null;
  onTestDetection?: () => void;
};

type BleSignal = "strong" | "weak" | "stale";

function bleSignalTier(lastSeenIso: string | null | undefined, nowMs: number): BleSignal {
  if (!lastSeenIso) return "stale";
  const parsed = Date.parse(lastSeenIso);
  if (Number.isNaN(parsed)) return "stale";
  const ageSec = (nowMs - parsed) / 1000;
  if (ageSec < 3) return "strong";
  if (ageSec <= 10) return "weak";
  return "stale";
}

function BleSignalIndicator({ tier }: { tier: BleSignal }) {
  const styles = {
    strong: "bg-emerald-500",
    weak: "bg-amber-400",
    stale: "bg-slate-300",
  };
  return (
    <div className="flex items-center gap-1.5" title={`BLE recency: ${tier}`}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${styles[tier]}`} aria-hidden />
      <span className="text-[10px] font-semibold uppercase tracking-wide text-ds-muted">
        {tier === "strong" ? "Strong" : tier === "weak" ? "Weak" : "Stale"}
      </span>
    </div>
  );
}

type BleProps = {
  variant: "ble";
  device: BleDeviceOut;
  assignedLabel: string | null;
  /** Highlight for onboarding (unregistered assignment). */
  emphasizeUnassigned?: boolean;
  /** When true, hides Assign / Reassign (e.g. read-only contexts). */
  disableAssignment?: boolean;
  /** Shown when assignment is read-only or managed elsewhere. */
  assignmentHint?: string | null;
  onAssign?: () => void;
  testListening?: boolean;
  testSuccessFlash?: boolean;
  testMatchKind?: DetectionMatchType;
  testMatchDebug?: { loggedAt: number; matchType: DetectionMatchType } | null;
  testMatchDetails?: { payload: Record<string, unknown>; created_at: string | null } | null;
  /** Server `last_seen_at` parse times when tag activity updated (for trend). */
  signalHistoryMs?: number[];
  onTestDetection?: () => void;
};

export type DeviceCardProps = GatewayProps | BleProps;

function statusPill(ok: boolean, onlineLabel: string, offlineLabel: string) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
        ok ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/70" : "bg-slate-100 text-slate-600 ring-1 ring-slate-200/80"
      }`}
    >
      {ok ? onlineLabel : offlineLabel}
    </span>
  );
}

function tagTypeLabel(type: string): string {
  if (type === "worker_tag") return "Worker tag";
  if (type === "equipment_tag") return "Equipment tag";
  return type.replace(/_/g, " ");
}

function gatewaySignalHealth(online: boolean, sec: number | null | undefined): string {
  if (!online) return "Offline — no live heartbeat";
  if (sec == null) return "Heartbeat age unknown";
  if (sec < 30) return "Strong — heartbeat within 30s";
  if (sec < 120) return "OK — last heartbeat within 2m";
  return "Weak — heartbeat stale";
}

function activityRow(label: string, value: string) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs text-ds-muted">
      <span className="inline-flex items-center gap-1">
        <Activity className="h-3.5 w-3.5 text-ds-muted" aria-hidden />
        {label}
      </span>
      <span className="font-medium tabular-nums text-ds-foreground">{value}</span>
    </div>
  );
}

function testRing(
  listening: boolean | undefined,
  flash: boolean | undefined,
  flashMatchKind?: DetectionMatchType,
) {
  if (flash && flashMatchKind === "mac_only") {
    return "ring-2 ring-amber-400/90 ring-offset-2 ring-offset-white";
  }
  if (flash) return "ring-2 ring-emerald-400/90 ring-offset-2 ring-offset-white";
  if (listening) return "ring-2 ring-[#2563eb]/50 ring-offset-2 ring-offset-white";
  return "";
}

function fmtPayload(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Min detection-count delta between 10s windows required to change trend (reduces jitter). */
const TREND_DELTA_THRESHOLD = 2;

function bleTrendDetectionDiff(times: number[] | undefined, nowMs: number): number {
  if (!times?.length) return 0;
  const recent = times.filter((t) => t > nowMs - 10_000 && t <= nowMs).length;
  const prev = times.filter((t) => t > nowMs - 20_000 && t <= nowMs - 10_000).length;
  return recent - prev;
}

function TrendMark({ trend }: { trend: "up" | "flat" | "down" }) {
  const label = trend === "up" ? "↑ improving" : trend === "down" ? "↓ degrading" : "→ stable";
  return (
    <span className="text-[10px] font-semibold tabular-nums text-pulse-muted" title="10s vs prior 10s activity">
      {label}
    </span>
  );
}

function TestMatchPayloadPanel({
  details,
  testMatchKind,
  debug,
}: {
  details: { payload: Record<string, unknown>; created_at: string | null };
  testMatchKind?: DetectionMatchType;
  debug?: { loggedAt: number; matchType: DetectionMatchType } | null;
}) {
  const [open, setOpen] = useState(true);
  const [relTick, setRelTick] = useState(0);
  const [debugDimmed, setDebugDimmed] = useState(false);
  useEffect(() => {
    setOpen(true);
  }, [details]);
  useEffect(() => {
    if (!debug) return;
    setDebugDimmed(false);
    const dim = window.setTimeout(() => setDebugDimmed(true), 3000);
    return () => window.clearTimeout(dim);
  }, [debug?.loggedAt, debug?.matchType]);
  useEffect(() => {
    if (!debug) return;
    const id = window.setInterval(() => setRelTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [debug]);
  const p = details.payload;
  const macOnlyPanel = testMatchKind === "mac_only";
  const panelBorder = macOnlyPanel ? "border-amber-200/85 bg-amber-50/45" : "border-emerald-200/80 bg-emerald-50/50";
  const panelBtn = macOnlyPanel ? "text-amber-950" : "text-emerald-950";
  const panelDl = macOnlyPanel
    ? "border-t border-amber-200/60 text-amber-950/90"
    : "border-t border-emerald-200/60 text-emerald-950/90";
  const dtClass = macOnlyPanel ? "text-amber-900/85" : "text-emerald-900/80";
  const debugBorder = macOnlyPanel ? "border-amber-200/60 text-amber-900/80" : "border-emerald-200/60 text-emerald-900/75";
  const debugLine = useMemo(
    () =>
      debug != null
        ? `${formatRelativeTime(new Date(debug.loggedAt).toISOString())} · ${debug.matchType}`
        : null,
    [debug, relTick],
  );
  const rows: [string, unknown][] = [
    ["gateway_id", p.gateway_id],
    ["worker_tag_mac", p.worker_tag_mac],
    ["equipment_tag_mac", p.equipment_tag_mac],
    ["rssi", p.rssi],
    ["timestamp", details.created_at],
  ];
  return (
    <div className={`mt-2 rounded-lg border ${panelBorder}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between px-2.5 py-1.5 text-left text-xs font-semibold ${panelBtn}`}
      >
        Matched payload
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open ? (
        <dl className={`space-y-1 px-2.5 py-2 text-[11px] ${panelDl}`}>
          {rows.map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className={`w-28 shrink-0 font-mono ${dtClass}`}>{k}</dt>
              <dd className="min-w-0 break-all font-mono">{fmtPayload(v)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {debugLine != null ? (
        <p
          className={`border-t px-2.5 py-1.5 text-[10px] leading-snug transition-opacity duration-500 ${debugBorder} ${debugDimmed ? "opacity-35" : "opacity-100"}`}
        >
          {debugLine}
        </p>
      ) : null}
    </div>
  );
}

export function DeviceCard(props: DeviceCardProps) {
  if (props.variant === "gateway") {
    const {
      gateway,
      operationalStatus,
      zoneLabel,
      lastHeardAt,
      secondsSinceLastSeen,
      onChangeZone,
      testListening,
      testSuccessFlash,
      testMatchKind,
      testMatchDebug,
      testMatchDetails,
      onTestDetection,
    } = props;
    const online = operationalStatus === "online";
    const gatewayTestMsg =
      testMatchKind === "mac_only"
        ? "Detected (unassigned tag) — assign worker and equipment tags on this page."
        : "Detection received — traffic matched this gateway.";
    const gatewayMacOnly = testSuccessFlash && testMatchKind === "mac_only";
    const relative = formatRelativeTime(lastHeardAt);
    return (
      <div className={`${cardBase} ${testRing(testListening, testSuccessFlash, testMatchKind)}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-ds-secondary text-ds-foreground">
              <Router className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h3 className="font-semibold text-ds-foreground">{gateway.name}</h3>
              <p className="mt-0.5 font-mono text-xs text-ds-muted">{gateway.identifier}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {statusPill(online, "Online", "Offline")}
            {!online ? <WifiOff className="h-4 w-4 text-ds-muted" aria-hidden /> : null}
          </div>
        </div>
        <div className="mt-4 space-y-2 border-t border-ds-border pt-4">
          {activityRow("Last heartbeat", relative)}
          {activityRow("Signal health", gatewaySignalHealth(online, secondsSinceLastSeen ?? null))}
          {testSuccessFlash ? (
            <div
              className={
                gatewayMacOnly
                  ? "flex gap-2 rounded-md bg-amber-50/90 px-2 py-1.5 ring-1 ring-amber-200/80"
                  : "space-y-0.5"
              }
            >
              {gatewayMacOnly ? (
                <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
              ) : null}
              <div className="min-w-0 space-y-0.5">
                <p
                  className={
                    gatewayMacOnly ? "text-xs font-medium text-amber-950" : "text-xs font-medium text-emerald-800"
                  }
                >
                  {gatewayTestMsg}
                </p>
                <p
                  className={
                    gatewayMacOnly
                      ? "text-[10px] font-semibold uppercase tracking-wide text-amber-800/80"
                      : "text-[10px] font-semibold uppercase tracking-wide text-emerald-900/70"
                  }
                >
                  via Gateway
                </p>
              </div>
            </div>
          ) : null}
          {testSuccessFlash && testMatchDetails ? (
            <TestMatchPayloadPanel
              details={testMatchDetails}
              testMatchKind={testMatchKind}
              debug={testMatchDebug}
            />
          ) : null}
          {!online && relative !== "—" ? (
            <p className="text-[11px] text-amber-800/90">Offline by policy — check power or uplink if this is unexpected.</p>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ds-muted">
          <span className="text-ds-foreground/80">Zone:</span>
          <span>{zoneLabel ?? "—"}</span>
          {onChangeZone ? (
            <button
              type="button"
              onClick={onChangeZone}
              className="ds-link ml-auto text-xs font-semibold"
            >
              Change zone
            </button>
          ) : null}
        </div>
        {onTestDetection ? (
          <button
            type="button"
            onClick={onTestDetection}
            disabled={Boolean(testListening)}
            className="mt-3 rounded-lg border border-ds-border bg-ds-primary px-3 py-1.5 text-xs font-semibold text-ds-foreground shadow-[var(--ds-shadow-card)] hover:bg-ds-interactive-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {testListening ? "Waiting for detection…" : "Test detection"}
          </button>
        ) : null}
      </div>
    );
  }

  const {
    device,
    assignedLabel,
    emphasizeUnassigned,
    disableAssignment,
    assignmentHint,
    onAssign,
    testListening,
    testSuccessFlash,
    testMatchKind,
    testMatchDebug,
    testMatchDetails,
    signalHistoryMs,
    onTestDetection,
  } = props;
  const bleTestMsg =
    testMatchKind === "mac_only"
      ? "Detected (unassigned tag) — assign this tag under Gateways & sensors."
      : "Detection received — tag seen in live traffic.";
  const bleMacOnly = testSuccessFlash && testMatchKind === "mac_only";
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const assigned = Boolean(device.assigned_worker_id || device.assigned_equipment_id);
  const batteryPct = device.battery_percent;
  const bleRelative = formatRelativeTime(device.last_seen_at ?? null);
  const signalTier = bleSignalTier(device.last_seen_at ?? null, nowMs);
  const trendCommittedRef = useRef<"up" | "flat" | "down">("flat");
  const diff = useMemo(() => bleTrendDetectionDiff(signalHistoryMs, nowMs), [signalHistoryMs, nowMs]);
  const trend = useMemo(() => {
    if (diff >= TREND_DELTA_THRESHOLD) {
      trendCommittedRef.current = "up";
      return "up";
    }
    if (diff <= -TREND_DELTA_THRESHOLD) {
      trendCommittedRef.current = "down";
      return "down";
    }
    return trendCommittedRef.current;
  }, [diff]);
  const accent =
    emphasizeUnassigned && !assigned
      ? "border-amber-300/90 bg-amber-50/40 shadow-[0_0_0_1px_rgba(251,191,36,0.35)]"
      : "";

  return (
    <div className={`${cardBase} ${accent} ${testRing(testListening, testSuccessFlash, testMatchKind)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-ds-secondary text-ds-foreground">
            <Bluetooth className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-ds-foreground">{device.name}</h3>
              {emphasizeUnassigned && !assigned ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900 ring-1 ring-amber-200/80">
                  Unassigned
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 font-mono text-xs text-ds-muted">{device.mac_address}</p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-ds-muted">
              {tagTypeLabel(device.type)}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {assigned ? statusPill(true, "Assigned", "") : statusPill(false, "", "Unassigned")}
          <div className="flex flex-col items-end gap-1">
            <BleSignalIndicator tier={signalTier} />
            <TrendMark trend={trend} />
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-2 border-t border-ds-border pt-4 text-sm">
        {activityRow("Last seen (via edge)", bleRelative)}
        {batteryPct != null ? activityRow("Battery", `${batteryPct}%`) : null}
        {activityRow(
          "Movement / activity",
          signalTier === "strong" ? "Active (recent)" : signalTier === "weak" ? "Intermittent" : "Quiet / stale",
        )}
        {testSuccessFlash ? (
          <div
            className={
              bleMacOnly
                ? "flex gap-2 rounded-md bg-amber-50/90 px-2 py-1.5 ring-1 ring-amber-200/80"
                : "space-y-0.5"
            }
          >
            {bleMacOnly ? (
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
            ) : null}
            <div className="min-w-0 space-y-0.5">
              <p
                className={
                  bleMacOnly ? "text-xs font-medium text-amber-950" : "text-xs font-medium text-emerald-800"
                }
              >
                {bleTestMsg}
              </p>
              <p
                className={
                  bleMacOnly
                    ? "text-[10px] font-semibold uppercase tracking-wide text-amber-800/80"
                    : "text-[10px] font-semibold uppercase tracking-wide text-emerald-900/70"
                }
              >
                via BLE
              </p>
            </div>
          </div>
        ) : null}
        {testSuccessFlash && testMatchDetails ? (
          <TestMatchPayloadPanel
            details={testMatchDetails}
            testMatchKind={testMatchKind}
            debug={testMatchDebug}
          />
        ) : null}
        {assigned ? (
          <p className="text-ds-muted">
            <span className="font-medium text-ds-foreground">Assigned to:</span> {assignedLabel}
          </p>
        ) : (
          <p className="text-ds-muted">
            {device.type === "equipment_tag"
              ? "Unassigned equipment tag — assign to a tracked asset with the button below."
              : "Not assigned to a worker yet — assign to finish worker onboarding."}
          </p>
        )}
        {assignmentHint ? <p className="text-[11px] text-ds-muted">{assignmentHint}</p> : null}
        <div className="flex flex-wrap gap-2">
          {onAssign && !disableAssignment ? (
            <button
              type="button"
              onClick={onAssign}
              className={
                assigned
                  ? "mt-1 rounded-lg border border-ds-border bg-ds-primary px-3 py-1.5 text-xs font-semibold text-ds-foreground shadow-[var(--ds-shadow-card)] hover:bg-ds-interactive-hover"
                  : "mt-1 rounded-lg bg-ds-accent px-3 py-1.5 text-xs font-semibold text-ds-accent-foreground shadow-[var(--ds-shadow-card)] hover:bg-ds-accent/90"
              }
            >
              {assigned ? "Reassign" : "Assign"}
            </button>
          ) : null}
          {onTestDetection ? (
            <button
              type="button"
              onClick={onTestDetection}
              disabled={Boolean(testListening)}
              className="mt-1 rounded-lg border border-dashed border-ds-border bg-ds-secondary/60 px-3 py-1.5 text-xs font-semibold text-ds-foreground hover:bg-ds-interactive-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {testListening ? "Listening…" : "Test detection"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
