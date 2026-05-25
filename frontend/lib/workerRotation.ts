/** Weekday keys align with `Date.getDay()` indices 0–6 (Sunday-first). */
export const ROTATION_WEEKDAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export type WorkerRecurringShiftRow = {
  day_of_week: string;
  start: string;
  end: string;
  role?: string | null;
  required_certifications?: string[] | null;
};

export const ROTATION_WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function normalizeDow(raw: string): string {
  return String(raw).trim().toLowerCase();
}

/** Maps API recurring rows to seven booleans (Sun..Sat). */
export function rotationDaysFromRecurring(rules: WorkerRecurringShiftRow[] | null | undefined): boolean[] {
  const out = [false, false, false, false, false, false, false];
  if (!rules?.length) return out;
  for (const r of rules) {
    const k = normalizeDow(r.day_of_week);
    const i = ROTATION_WEEKDAY_KEYS.indexOf(k as (typeof ROTATION_WEEKDAY_KEYS)[number]);
    if (i >= 0) out[i] = true;
  }
  return out;
}

export const HYBRID_ROSTER_SHIFT_KEY = "hybrid";

export type HybridRotationBand = "day" | "afternoon" | "night";

export type HybridRotationDraft = {
  mainBand: HybridRotationBand;
  mainDays: boolean[];
  mainWindow: { start: string; end: string };
  secondaryDays: boolean[];
  secondaryWindow: { start: string; end: string };
};

export function shiftWindowFromRosterKey(
  shiftKey: string,
  shifts: { key: string; label: string }[],
): { start: string; end: string } {
  const k = shiftKey.trim().toLowerCase();
  if (k === HYBRID_ROSTER_SHIFT_KEY) return { start: "14:00", end: "22:00" };
  const row = shifts.find((s) => s.key === shiftKey);
  const hay = `${shiftKey} ${(row?.label || "").toLowerCase()}`;
  if (hay.includes("night") || hay.includes("overnight")) return { start: "22:00", end: "06:00" };
  if (hay.includes("afternoon") || hay.includes("evening")) return { start: "14:00", end: "22:00" };
  /** Auxiliary / variable-hours staff — nominal placeholder for rotation UI (not a fixed band). */
  if (hay.includes("auxiliary")) return { start: "09:00", end: "17:00" };
  return { start: "07:00", end: "15:00" };
}

export function shiftWindowFromHybridBand(band: HybridRotationBand): { start: string; end: string } {
  return shiftWindowFromRosterKey(band, []);
}

/** Default secondary block for hybrid profiles (Greenglade evening). */
export function defaultHybridSecondaryWindow(): { start: string; end: string } {
  return { start: "16:00", end: "00:00" };
}

/** Normalize HH:mm for `<input type="time" />` and API payloads. */
export function padHm(t: string): string {
  const raw = String(t).trim();
  const m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "07:00";
  const h = Math.min(23, Math.max(0, parseInt(m[1]!, 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2]!, 10)));
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function buildRecurringRowsFromHybrid(draft: HybridRotationDraft): WorkerRecurringShiftRow[] {
  const main = buildRecurringRowsForDays(draft.mainDays, draft.mainWindow);
  const secondary = buildRecurringRowsForDays(draft.secondaryDays, draft.secondaryWindow);
  const byDow = new Map<string, WorkerRecurringShiftRow>();
  for (const r of main) byDow.set(normalizeDow(r.day_of_week), r);
  for (const r of secondary) byDow.set(normalizeDow(r.day_of_week), r);
  return sortRowsCanonical([...byDow.values()]);
}

/** When recurring rows use two distinct time windows, treat as a hybrid rotation. */
export function hybridDraftFromRecurringRows(
  rows: WorkerRecurringShiftRow[],
): HybridRotationDraft | null {
  if (!rows.length) return null;
  const groups = new Map<string, { window: { start: string; end: string }; days: boolean[] }>();
  for (const r of rows) {
    const key = `${padHm(r.start)}|${padHm(r.end)}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        window: { start: padHm(r.start), end: padHm(r.end) },
        days: [false, false, false, false, false, false, false],
      };
      groups.set(key, g);
    }
    const i = ROTATION_WEEKDAY_KEYS.indexOf(normalizeDow(r.day_of_week) as (typeof ROTATION_WEEKDAY_KEYS)[number]);
    if (i >= 0) g.days[i] = true;
  }
  if (groups.size !== 2) return null;
  const sorted = [...groups.values()].sort(
    (a, b) => b.days.filter(Boolean).length - a.days.filter(Boolean).length,
  );
  const primary = sorted[0]!;
  const secondary = sorted[1]!;
  const mainBand = inferHybridBandFromWindow(primary.window);
  return {
    mainBand,
    mainDays: primary.days,
    mainWindow: primary.window,
    secondaryDays: secondary.days,
    secondaryWindow: secondary.window,
  };
}

function inferHybridBandFromWindow(window: { start: string; end: string }): HybridRotationBand {
  const w = shiftWindowFromRosterKey("day", []);
  const a = shiftWindowFromRosterKey("afternoon", []);
  const n = shiftWindowFromRosterKey("night", []);
  const key = `${padHm(window.start)}|${padHm(window.end)}`;
  if (key === `${a.start}|${a.end}`) return "afternoon";
  if (key === `${n.start}|${n.end}`) return "night";
  return "day";
}

export function hybridRotationDayOverlapError(draft: HybridRotationDraft): string | null {
  for (let i = 0; i < draft.mainDays.length; i++) {
    if (draft.mainDays[i] && draft.secondaryDays[i]) {
      return `Both rotation blocks include ${ROTATION_WEEKDAY_SHORT[i]}. Use each weekday on only one block.`;
    }
  }
  return null;
}

export function buildRecurringRowsForDays(
  days: boolean[],
  window: { start: string; end: string },
): WorkerRecurringShiftRow[] {
  const rows: WorkerRecurringShiftRow[] = [];
  for (let i = 0; i < days.length; i++) {
    if (!days[i]) continue;
    rows.push({
      day_of_week: ROTATION_WEEKDAY_KEYS[i],
      start: padHm(window.start),
      end: padHm(window.end),
    });
  }
  return rows;
}

function sortRowsCanonical(rows: WorkerRecurringShiftRow[]): WorkerRecurringShiftRow[] {
  return [...rows].sort((a, b) => {
    const ia = ROTATION_WEEKDAY_KEYS.indexOf(normalizeDow(a.day_of_week) as (typeof ROTATION_WEEKDAY_KEYS)[number]);
    const ib = ROTATION_WEEKDAY_KEYS.indexOf(normalizeDow(b.day_of_week) as (typeof ROTATION_WEEKDAY_KEYS)[number]);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
}

/** Stable JSON for dirty-checking rotation payloads. */
export function canonicalRecurringJson(rows: WorkerRecurringShiftRow[]): string {
  const sorted = sortRowsCanonical(rows).map((r) => ({
    day_of_week: normalizeDow(r.day_of_week),
    start: String(r.start).trim(),
    end: String(r.end).trim(),
  }));
  return JSON.stringify(sorted);
}

export function recurringRowsFromApi(raw: unknown[] | null | undefined): WorkerRecurringShiftRow[] {
  if (!raw?.length) return [];
  const out: WorkerRecurringShiftRow[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const dow = o.day_of_week ?? o.dayOfWeek;
    const start = o.start;
    const end = o.end;
    if (typeof dow !== "string" || typeof start !== "string" || typeof end !== "string") continue;
    out.push({
      day_of_week: normalizeDow(dow),
      start: start.trim(),
      end: end.trim(),
    });
  }
  return out;
}

/** Prefer saved recurring hours when uniform; otherwise roster shift preset. */
export function formatHybridRotationSummary(draft: HybridRotationDraft): string {
  const mainBits = ROTATION_WEEKDAY_SHORT.filter((_, i) => draft.mainDays[i]).join(", ") || "—";
  const secBits = ROTATION_WEEKDAY_SHORT.filter((_, i) => draft.secondaryDays[i]).join(", ") || "—";
  return `Primary (${draft.mainBand}): ${mainBits} ${draft.mainWindow.start}–${draft.mainWindow.end}; Secondary: ${secBits} ${draft.secondaryWindow.start}–${draft.secondaryWindow.end}`;
}

export function editableShiftWindowFromProfile(
  profile: { shift?: string | null; recurring_shifts?: unknown[] | null; employment_type?: string | null },
  rosterShifts: { key: string; label: string }[],
): { start: string; end: string } {
  const rows = recurringRowsFromApi(profile.recurring_shifts ?? []);
  const hybrid = hybridDraftFromRecurringRows(rows);
  if (hybrid) return { start: hybrid.mainWindow.start, end: hybrid.mainWindow.end };
  if (rows.length) {
    const r0 = rows[0]!;
    const same = rows.every((r) => r.start === r0.start && r.end === r0.end);
    if (same) return { start: padHm(r0.start), end: padHm(r0.end) };
  }
  const rawShift = String(profile.shift ?? "").trim();
  const emp = String(profile.employment_type ?? "").trim();
  const synthetic = !rawShift && emp === "part_time" ? "auxiliary" : "";
  const w = shiftWindowFromRosterKey(rawShift || synthetic, rosterShifts);
  return { start: padHm(w.start), end: padHm(w.end) };
}
