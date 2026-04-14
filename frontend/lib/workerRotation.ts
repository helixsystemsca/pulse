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

export function shiftWindowFromRosterKey(
  shiftKey: string,
  shifts: { key: string; label: string }[],
): { start: string; end: string } {
  const row = shifts.find((s) => s.key === shiftKey);
  const hay = `${shiftKey} ${(row?.label || "").toLowerCase()}`;
  if (hay.includes("night") || hay.includes("overnight")) return { start: "22:00", end: "06:00" };
  if (hay.includes("afternoon") || hay.includes("evening")) return { start: "14:00", end: "22:00" };
  return { start: "07:00", end: "15:00" };
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
      start: window.start,
      end: window.end,
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
