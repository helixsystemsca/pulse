import type { TimeFormat } from "./types";

function parseHhMm(s: string): { h: number; m: number } {
  const [h, m] = s.split(":").map(Number);
  return { h, m };
}

export function formatTimeString(time: string, format: TimeFormat): string {
  const { h, m } = parseHhMm(time);
  if (format === "24h") {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  const mod = h % 12 || 12;
  const ampm = h < 12 ? "AM" : "PM";
  return `${mod}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function formatTimeRange(start: string, end: string, format: TimeFormat): string {
  return `${formatTimeString(start, format)}–${formatTimeString(end, format)}`;
}
