"use client";

import { Loader2, Pin, PinOff, Radio } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  blockMatchesFilter,
  buildSessionBlocks,
  dedupeActivityRows,
  mergeRawActivity,
  rowMatchesPin,
  type ActivityFilter,
  type FeedDisplayBlock,
  type RichActivityRow,
} from "@/lib/activityFeedProcessing";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { fetchRecentActivity, type AutomationRecentActivityData } from "@/lib/setup-api";

const EVENT_LABELS: Record<string, string> = {
  proximity_update: "Proximity update",
  session_started: "Session started",
  session_ended: "Session ended",
  unknown_device_seen: "Unknown device detected",
  notification_acknowledged: "Notification acknowledged",
  automation_triggered: "Automation triggered",
};

const LOG_LABELS: Record<string, string> = {
  unknown_device: "Unknown device detected",
  rate_limited: "Rate limited",
  enrichment_warnings: "Configuration warning",
};

function describeFromEvent(eventType: string, payload: Record<string, unknown>): string {
  const base = EVENT_LABELS[eventType] ?? eventType.replace(/_/g, " ");
  if (eventType === "proximity_update") {
    const hasWorker = Boolean(payload.worker_id);
    const hasEq = Boolean(payload.equipment_id);
    if (hasWorker && hasEq) return "Worker near equipment";
    if (hasWorker) return "Worker presence update";
    if (hasEq) return "Equipment proximity signal";
    return base;
  }
  if (eventType === "session_started") return "Session started";
  if (eventType === "session_ended") return "Session ended";
  if (eventType === "unknown_device_seen") return "Unknown device detected";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function describeFromLog(logType: string, message: string): string {
  const m = message.trim();
  if (LOG_LABELS[logType]) {
    if (logType === "unknown_device" && m) return `Unknown device: ${m.slice(0, 80)}${m.length > 80 ? "…" : ""}`;
    return LOG_LABELS[logType];
  }
  if (m) return m.length > 90 ? `${m.slice(0, 90)}…` : m;
  return logType.replace(/_/g, " ");
}

const FILTER_TABS: { id: ActivityFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "proximity", label: "Proximity" },
  { id: "sessions", label: "Sessions" },
  { id: "warnings", label: "Warnings" },
];

const TAB_BTN =
  "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ring-1 ring-transparent";
const TAB_ON = "bg-ds-primary text-ds-foreground ring-ds-border";
const TAB_OFF = "bg-ds-secondary/60 text-ds-muted hover:bg-ds-interactive-hover ring-ds-border";

/** UI-only cap: open sessions shown as ended after this age. */
const OPEN_SESSION_UI_CAP_MS = 5 * 60 * 1000;

function sessionBlockStartMs(block: Extract<FeedDisplayBlock, { kind: "session" }>): number | null {
  let start: number | null = null;
  for (const r of block.children) {
    if (r.event_type === "session_started" && r.created_at) {
      const t = Date.parse(r.created_at);
      if (!Number.isNaN(t)) start = start === null ? t : Math.min(start, t);
    }
  }
  if (start != null) return start;
  const times = block.children
    .map((c) => (c.created_at ? Date.parse(c.created_at) : NaN))
    .filter((n) => !Number.isNaN(n));
  return times.length ? Math.min(...times) : null;
}

function SessionBlockView({
  block,
}: {
  block: Extract<FeedDisplayBlock, { kind: "session" }>;
}) {
  const startMs = sessionBlockStartMs(block);
  const openAgeMs =
    block.inProgress && startMs != null ? Math.max(0, Date.now() - startMs) : 0;
  const uiCappedOpen = block.inProgress && openAgeMs > OPEN_SESSION_UI_CAP_MS;
  const title = uiCappedOpen
    ? `Session (5 min) — ${block.workerLabel} ↔ ${block.equipLabel}`
    : block.durationSec != null
      ? `Session (${block.durationSec}s) — ${block.workerLabel} ↔ ${block.equipLabel}`
      : block.inProgress
        ? `Session (in progress) — ${block.workerLabel} ↔ ${block.equipLabel}`
        : `Session — ${block.workerLabel} ↔ ${block.equipLabel}`;
  return (
    <li className="border-b border-ds-border last:border-0">
      <div className="bg-ds-secondary/60 px-3 py-2">
        <p className="text-sm font-semibold text-ds-foreground">{title}</p>
        <p className="mt-0.5 text-[10px] text-ds-muted">
          {uiCappedOpen ? "Worker + equipment timeline (open session shown capped at 5 min)" : "Worker + equipment timeline"}
        </p>
      </div>
      <ul className="divide-y divide-ds-border bg-ds-secondary/40">
        {block.children.map((r) => (
          <li key={r.key} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2 pl-5 text-sm">
            <div className="min-w-0">
              <p className="font-medium text-ds-foreground">{r.headline}</p>
              {r.sub ? <p className="mt-0.5 font-mono text-[10px] text-ds-muted">{r.sub}</p> : null}
            </div>
            <time className="shrink-0 text-xs tabular-nums text-ds-muted" dateTime={r.created_at ?? undefined}>
              {formatRelativeTime(r.created_at)}
            </time>
          </li>
        ))}
      </ul>
    </li>
  );
}

function FlatRowView({ r }: { r: RichActivityRow }) {
  return (
    <li className="list-none border-b border-ds-border last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-2 px-3 py-2.5 text-sm">
      <div className="min-w-0">
        <p className="font-medium text-ds-foreground">{r.headline}</p>
        {r.sub ? <p className="mt-0.5 font-mono text-[10px] text-ds-muted">{r.sub}</p> : null}
      </div>
      <time className="shrink-0 text-xs tabular-nums text-ds-muted" dateTime={r.created_at ?? undefined}>
        {formatRelativeTime(r.created_at)}
      </time>
      </div>
    </li>
  );
}

export function LiveActivityFeed({
  companyId,
  isSystemAdminBase,
  pollMs = 8000,
  fetchLimit = 80,
  maxBlocks = 20,
  resolveWorkerName = (id) => `${id.slice(0, 8)}…`,
  resolveEquipmentName = (id) => `${id.slice(0, 8)}…`,
  pinOptions,
}: {
  companyId: string | null;
  isSystemAdminBase: boolean;
  pollMs?: number;
  fetchLimit?: number;
  maxBlocks?: number;
  resolveWorkerName?: (id: string) => string;
  resolveEquipmentName?: (id: string) => string;
  pinOptions?: {
    gateways: { id: string; label: string }[];
    ble: { mac: string; label: string }[];
  };
}) {
  const [raw, setRaw] = useState<AutomationRecentActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [pinKind, setPinKind] = useState<"none" | "ble" | "gateway">("none");
  const [pinValue, setPinValue] = useState("");
  const pauseLiveUpdatesRef = useRef(false);
  const pendingDataRef = useRef<AutomationRecentActivityData | null>(null);
  const catchUpTimerRef = useRef<number | null>(null);

  const cid = isSystemAdminBase ? companyId : null;

  const load = useCallback(async () => {
    if (!companyId) return;
    try {
      setErr(null);
      const data = await fetchRecentActivity(cid, fetchLimit);
      if (pauseLiveUpdatesRef.current) {
        pendingDataRef.current = data;
      } else {
        pendingDataRef.current = null;
        setRaw(data);
      }
    } catch {
      setErr("Could not load activity");
    } finally {
      setLoading(false);
    }
  }, [companyId, cid, fetchLimit]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!companyId) return;
    const id = window.setInterval(() => void load(), pollMs);
    return () => window.clearInterval(id);
  }, [companyId, load, pollMs]);

  useEffect(() => {
    return () => {
      if (catchUpTimerRef.current != null) window.clearTimeout(catchUpTimerRef.current);
    };
  }, []);

  const blocks = useMemo(() => {
    if (!raw) return [];
    const merged = mergeRawActivity(raw, describeFromEvent, describeFromLog);
    const pinnedFirst =
      pinKind !== "none" && pinValue
        ? merged.filter((r) => rowMatchesPin(r, pinKind, pinValue))
        : merged;
    const deduped = dedupeActivityRows(pinnedFirst, 2000);
    return buildSessionBlocks(deduped, resolveWorkerName, resolveEquipmentName);
  }, [raw, resolveWorkerName, resolveEquipmentName, pinKind, pinValue]);

  const filtered = useMemo(() => {
    return blocks.filter((b) => blockMatchesFilter(b, filter));
  }, [blocks, filter]);

  const visible = useMemo(() => filtered.slice(0, maxBlocks), [filtered, maxBlocks]);

  const empty = useMemo(() => !loading && visible.length === 0, [loading, visible.length]);

  if (!companyId) return null;

  return (
    <section
      className="rounded-md border border-ds-border bg-ds-primary p-5 shadow-[var(--ds-shadow-card)] md:p-6"
      onPointerEnter={() => {
        pauseLiveUpdatesRef.current = true;
        if (catchUpTimerRef.current != null) window.clearTimeout(catchUpTimerRef.current);
        catchUpTimerRef.current = null;
      }}
      onPointerLeave={() => {
        pauseLiveUpdatesRef.current = false;
        const pending = pendingDataRef.current;
        pendingDataRef.current = null;
        if (pending) setRaw(pending);
        if (catchUpTimerRef.current != null) window.clearTimeout(catchUpTimerRef.current);
        catchUpTimerRef.current = window.setTimeout(() => {
          catchUpTimerRef.current = null;
          void load();
        }, 125);
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-ds-foreground">
          <Radio className="h-5 w-5 text-ds-foreground" aria-hidden />
          <div>
            <h2 className="text-sm font-semibold">Live activity</h2>
            <p className="text-xs text-ds-muted">Session view, filters, and pin (client-side dedupe).</p>
          </div>
        </div>
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-ds-muted" aria-hidden /> : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {FILTER_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setFilter(t.id)}
            className={`${TAB_BTN} ${filter === t.id ? TAB_ON : TAB_OFF}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {pinOptions && (pinOptions.gateways.length > 0 || pinOptions.ble.length > 0) ? (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-md bg-ds-secondary/60 p-3 ring-1 ring-ds-border">
          <div className="min-w-[140px]">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ds-muted">Pin device</label>
            <select
              className="mt-1 w-full rounded-lg border border-ds-border bg-ds-primary px-2 py-1.5 text-xs text-ds-foreground"
              value={pinKind === "none" ? "" : `${pinKind}|${pinValue}`}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) {
                  setPinKind("none");
                  setPinValue("");
                  return;
                }
                const bar = v.indexOf("|");
                const k = v.slice(0, bar);
                const val = v.slice(bar + 1);
                if (k === "gateway") {
                  setPinKind("gateway");
                  setPinValue(val);
                } else if (k === "ble") {
                  setPinKind("ble");
                  setPinValue(val);
                }
              }}
            >
              <option value="">All devices</option>
              {pinOptions.gateways.map((g) => (
                <option key={g.id} value={`gateway|${g.id}`}>
                  Gateway: {g.label}
                </option>
              ))}
              {pinOptions.ble.map((b) => (
                <option key={b.mac} value={`ble|${b.mac}`}>
                  BLE: {b.label} ({b.mac})
                </option>
              ))}
            </select>
          </div>
          {pinKind !== "none" ? (
            <button
              type="button"
              onClick={() => {
                setPinKind("none");
                setPinValue("");
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-ds-border bg-ds-primary px-2 py-1.5 text-xs font-medium text-ds-foreground hover:bg-ds-interactive-hover"
            >
              <PinOff className="h-3.5 w-3.5" aria-hidden />
              Clear pin
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 pb-1.5 text-[10px] text-ds-muted">
              <Pin className="h-3 w-3" aria-hidden />
              Optional
            </span>
          )}
        </div>
      ) : null}

      {err ? <p className="mt-3 text-sm text-rose-700">{err}</p> : null}
      {empty ? (
        <p className="mt-4 text-sm text-ds-muted">No rows match this view. Adjust filters or pin.</p>
      ) : (
        <ul className="mt-4 divide-y divide-ds-border rounded-md border border-ds-border bg-ds-secondary/40">
          {visible.map((block) =>
            "kind" in block && block.kind === "session" ? (
              <SessionBlockView key={block.id} block={block} />
            ) : (
              <FlatRowView key={(block as RichActivityRow).key} r={block as RichActivityRow} />
            ),
          )}
        </ul>
      )}
    </section>
  );
}
