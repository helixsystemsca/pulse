/** Client-side helpers for part maintenance status, priority, and sorting (no API change). */

export type PartMaintenanceStatus = "ok" | "due_soon" | "overdue";

export type PartPriority = "low" | "medium" | "high";

export function normalizePartStatus(raw: string): PartMaintenanceStatus {
  if (raw === "overdue" || raw === "due_soon") return raw;
  return "ok";
}

export function statusSeverity(s: PartMaintenanceStatus): number {
  if (s === "overdue") return 2;
  if (s === "due_soon") return 1;
  return 0;
}

export function partPriorityFromStatus(s: PartMaintenanceStatus): PartPriority {
  if (s === "overdue") return "high";
  if (s === "due_soon") return "medium";
  return "low";
}

export function priorityLabel(p: PartPriority): string {
  if (p === "high") return "High";
  if (p === "medium") return "Medium";
  return "Low";
}

/** Sort: highest severity first, then name. */
export function comparePartsByPriorityThenName(a: { name: string; maintenance_status: string }, b: { name: string; maintenance_status: string }): number {
  const da = statusSeverity(normalizePartStatus(a.maintenance_status));
  const db = statusSeverity(normalizePartStatus(b.maintenance_status));
  if (db !== da) return db - da;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

/** YYYY-MM-DD in local calendar. */
export function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Add whole days to a calendar date string (YYYY-MM-DD), local semantics. */
export function addDaysToDateString(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return localDateString(dt);
}
