/**
 * Short labels for common shift windows (month/week calendar density).
 * Extend the table as your org adds standard patterns.
 */
import type { TimeFormat } from "./types";
import { formatTimeString } from "./time-format";

const _pad = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return t;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/** Known (start, end) → code. Times are HH:mm 24h. */
const KNOWN_WINDOWS: readonly [string, string, string][] = [
  ["06:00", "16:00", "D1"], // day 6–4
  ["06:00", "14:00", "D2"],
  ["08:00", "16:00", "D3"],
  ["07:00", "15:00", "D4"],
  ["14:00", "22:00", "A1"], // afternoon
  ["22:00", "06:00", "N1"], // overnight (end next calendar day not modeled; match literal end)
];

export function shiftCodeForWindow(startTime: string, endTime: string): string {
  const s = _pad(startTime);
  const e = _pad(endTime);
  for (const [a, b, code] of KNOWN_WINDOWS) {
    if (a === s && b === e) return code;
  }
  return compactTimeSpan(s, e, "12h");
}

function compactTimeSpan(start: string, end: string, fmt: TimeFormat): string {
  const a = formatTimeString(start, fmt).replace(/\s/g, "").toLowerCase();
  const b = formatTimeString(end, fmt).replace(/\s/g, "").toLowerCase();
  return `${a}–${b}`;
}

export function shiftCodesLegendLines(): string[] {
  return [
    "D1 — 6:00 AM – 4:00 PM",
    "D2 — 6:00 AM – 2:00 PM",
    "D3 — 8:00 AM – 4:00 PM",
    "D4 — 7:00 AM – 3:00 PM",
    "A1 — 2:00 PM – 10:00 PM",
    "N1 — 10:00 PM – 6:00 AM",
    "Other windows show as short times (e.g. 9a–5p).",
  ];
}
