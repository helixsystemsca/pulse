/**
 * Pure helpers for LiveActivityFeed: deduplication, session grouping, filter/pin predicates.
 */
import { normalizeMacKey } from "@/lib/macNormalize";
import type { AutomationRecentActivityData } from "@/lib/setup-api";

export type ActivityFilter = "all" | "proximity" | "sessions" | "warnings";

export type RichActivityRow = {
  key: string;
  created_at: string | null;
  headline: string;
  sub: string;
  source: "event" | "log";
  event_type: string;
  payload: Record<string, unknown>;
  severity?: string | null;
  dedupeCount?: number;
};

export type SessionFeedBlock = {
  kind: "session";
  id: string;
  workerId: string;
  equipmentId: string;
  workerLabel: string;
  equipLabel: string;
  durationSec: number | null;
  inProgress: boolean;
  children: RichActivityRow[];
};

export type FeedDisplayBlock = SessionFeedBlock | RichActivityRow;

export function norm(v?: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

function payloadEntityKey(p: Record<string, unknown>): string {
  const w = p.worker_id != null ? String(p.worker_id).trim() : "";
  const e = p.equipment_id != null ? String(p.equipment_id).trim() : "";
  const g = p.gateway_id != null ? String(p.gateway_id).trim() : "";
  return `${w}|${e}|${g}`;
}

/** Normalized distance|movement for stable dedupe (never undefined). */
function motionDistanceKey(p: Record<string, unknown>): string {
  return `${norm(p.distance)}|${norm(p.movement)}`;
}

function dedupeZoneSegment(p: Record<string, unknown>): string {
  if (!("zone_id" in p) || p.zone_id === undefined || p.zone_id === null) return "";
  const s = String(p.zone_id).trim();
  return s ? norm(s) : "";
}

function dedupeKey(row: RichActivityRow): string {
  const p = row.payload ?? {};
  const z = dedupeZoneSegment(p);
  const zPart = z ? `|z:${z}` : "";
  return `${row.event_type}|${payloadEntityKey(p)}|${motionDistanceKey(p)}${zPart}`;
}

/** Newest-first rows → newest-first with rapid duplicates collapsed. */
export function dedupeActivityRows(rows: RichActivityRow[], windowMs = 2000): RichActivityRow[] {
  if (rows.length === 0) return rows;
  const out: RichActivityRow[] = [];
  let i = 0;
  while (i < rows.length) {
    const t0 = rows[i].created_at ? Date.parse(rows[i].created_at!) : 0;
    let j = i + 1;
    let count = 1;
    while (j < rows.length) {
      const tj = rows[j].created_at ? Date.parse(rows[j].created_at!) : 0;
      if (Math.abs(t0 - tj) <= windowMs && dedupeKey(rows[j]) === dedupeKey(rows[i])) {
        count += 1;
        j += 1;
      } else {
        break;
      }
    }
    const base = rows[i];
    out.push({
      ...base,
      dedupeCount: count > 1 ? count : undefined,
      headline: count > 1 ? `${base.headline} ×${count} occurrences` : base.headline,
    });
    i = j;
  }
  return out;
}

function pairKey(p: Record<string, unknown>): string | null {
  const w = p.worker_id != null ? String(p.worker_id) : "";
  const e = p.equipment_id != null ? String(p.equipment_id) : "";
  if (!w || !e) return null;
  return `${w}|${e}`;
}

function zoneIdKey(p: Record<string, unknown>): string {
  return p.zone_id != null ? String(p.zone_id) : "";
}

/** Default max gap (ms) between consecutive same-pair rows still considered one session span. */
export const DEFAULT_SESSION_INNER_GAP_MS = 8000;

/** Min time between rows before a zone_id change splits the session (avoids back-to-back jitter). */
const ZONE_SPLIT_MIN_DELTA_MS = 1500;

/**
 * Group consecutive chronological rows sharing worker+equipment into session blocks when
 * session_started and session_ended both appear, or session_started without end (in progress).
 * Large time gaps between consecutive same-pair events start a new span (avoids unrelated merges).
 */
export function buildSessionBlocks(
  rowsNewestFirst: RichActivityRow[],
  resolveWorker: (id: string) => string,
  resolveEquipment: (id: string) => string,
  maxWithinSessionGapMs: number = DEFAULT_SESSION_INNER_GAP_MS,
): FeedDisplayBlock[] {
  const chronological = [...rowsNewestFirst].reverse();
  const blocks: FeedDisplayBlock[] = [];
  let i = 0;
  while (i < chronological.length) {
    const pk = pairKey(chronological[i].payload);
    if (!pk) {
      blocks.push({ ...chronological[i] });
      i += 1;
      continue;
    }
    const group: RichActivityRow[] = [];
    let j = i;
    while (j < chronological.length && pairKey(chronological[j].payload) === pk) {
      if (group.length > 0) {
        const prevRow = group[group.length - 1];
        const prevT = prevRow.created_at ? Date.parse(prevRow.created_at) : NaN;
        const curT = chronological[j].created_at ? Date.parse(chronological[j].created_at!) : NaN;
        if (
          !Number.isNaN(prevT) &&
          !Number.isNaN(curT) &&
          curT - prevT > maxWithinSessionGapMs
        ) {
          break;
        }
        const prevZ = zoneIdKey(prevRow.payload ?? {});
        const curZ = zoneIdKey(chronological[j].payload ?? {});
        if (
          prevZ &&
          curZ &&
          prevZ !== curZ &&
          !Number.isNaN(prevT) &&
          !Number.isNaN(curT) &&
          curT - prevT > ZONE_SPLIT_MIN_DELTA_MS
        ) {
          break;
        }
      }
      group.push(chronological[j]);
      j += 1;
    }
    const types = new Set(group.map((r) => r.event_type));
    const hasStart = types.has("session_started");
    const hasEnd = types.has("session_ended");
    const bundleSession = (hasStart && hasEnd) || (hasStart && !hasEnd);

    if (bundleSession) {
      const [w, e] = pk.split("|");
      let tStart: number | null = null;
      let tEnd: number | null = null;
      for (const r of group) {
        const t = r.created_at ? Date.parse(r.created_at) : NaN;
        if (Number.isNaN(t)) continue;
        if (r.event_type === "session_started") tStart = tStart === null ? t : Math.min(tStart, t);
        if (r.event_type === "session_ended") tEnd = tEnd === null ? t : Math.max(tEnd, t);
      }
      const durationSec =
        tStart != null && tEnd != null ? Math.max(0, Math.round((tEnd - tStart) / 1000)) : null;
      const firstKey = group[0]?.key ?? `i${i}`;
      const lastKey = group[group.length - 1]?.key ?? firstKey;
      const firstTs = group[0]?.created_at ? Date.parse(group[0].created_at) : NaN;
      const firstTsPart = Number.isNaN(firstTs) ? `i${i}` : String(firstTs);
      blocks.push({
        kind: "session",
        id: `sess:${pk}:${firstKey}:${lastKey}:${firstTsPart}`,
        workerId: w,
        equipmentId: e,
        workerLabel: resolveWorker(w),
        equipLabel: resolveEquipment(e),
        durationSec,
        inProgress: hasStart && !hasEnd,
        children: [...group].reverse(),
      });
    } else {
      for (const r of group) {
        blocks.push({ ...r });
      }
    }
    i = j;
  }
  return blocks.reverse();
}

export function rowMatchesPin(
  row: RichActivityRow,
  pinKind: "none" | "ble" | "gateway",
  pinValue: string,
): boolean {
  if (pinKind === "none" || !pinValue) return true;
  const p = row.payload ?? {};
  if (pinKind === "gateway") {
    return String(p.gateway_id ?? "").trim() === pinValue.trim();
  }
  const want = normalizeMacKey(pinValue);
  const w = normalizeMacKey(String(p.worker_tag_mac ?? ""));
  const e2 = normalizeMacKey(String(p.equipment_tag_mac ?? ""));
  const m = normalizeMacKey(String(p.mac_address ?? ""));
  return Boolean(want && (w === want || e2 === want || m === want));
}

export function blockMatchesPin(block: FeedDisplayBlock, pinKind: "none" | "ble" | "gateway", pinValue: string): boolean {
  if (pinKind === "none" || !pinValue) return true;
  if ("kind" in block && block.kind === "session") {
    return block.children.some((c) => rowMatchesPin(c, pinKind, pinValue));
  }
  return rowMatchesPin(block as RichActivityRow, pinKind, pinValue);
}

export function rowMatchesFilter(row: RichActivityRow, f: ActivityFilter): boolean {
  if (f === "all") return true;
  const t = row.event_type;
  if (f === "proximity") {
    return t === "proximity_update";
  }
  if (f === "sessions") {
    return t === "session_started" || t === "session_ended";
  }
  if (f === "warnings") {
    if (row.source === "log") {
      return (
        row.severity === "warning" ||
        t === "unknown_device" ||
        t === "enrichment_warnings" ||
        t === "rate_limited"
      );
    }
    return t === "unknown_device_seen";
  }
  return true;
}

export function blockMatchesFilter(block: FeedDisplayBlock, f: ActivityFilter): boolean {
  if (f === "all") return true;
  if ("kind" in block && block.kind === "session") {
    if (f === "sessions") return true;
    return block.children.some((c) => rowMatchesFilter(c, f));
  }
  return rowMatchesFilter(block as RichActivityRow, f);
}

export function mergeRawActivity(
  data: AutomationRecentActivityData,
  describeEvent: (eventType: string, payload: Record<string, unknown>) => string,
  describeLog: (logType: string, message: string) => string,
): RichActivityRow[] {
  const out: RichActivityRow[] = [];
  for (const e of data.events) {
    out.push({
      key: `e:${e.id}`,
      created_at: e.created_at,
      headline: describeEvent(e.event_type, e.payload ?? {}),
      sub: e.event_type,
      source: "event",
      event_type: e.event_type,
      payload: e.payload ?? {},
    });
  }
  for (const l of data.logs) {
    out.push({
      key: `l:${l.id}`,
      created_at: l.created_at,
      headline: describeLog(l.type, l.message ?? ""),
      sub: l.type,
      source: "log",
      event_type: l.type,
      payload: l.payload ?? {},
      severity: l.severity,
    });
  }
  out.sort((a, b) => {
    const ta = a.created_at ? Date.parse(a.created_at) : 0;
    const tb = b.created_at ? Date.parse(b.created_at) : 0;
    return tb - ta;
  });
  return out;
}
