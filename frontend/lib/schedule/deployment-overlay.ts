import type { Shift } from "@/lib/schedule/types";

export function deploymentOverlayKey(workerId: string, date: string): string {
  return `${workerId}|${date}`;
}

/** Merge persisted deployment badge overlays into shift rows for display (and conflict checks). */
export function mergeDeploymentBadgeOverlays(shifts: Shift[], overlays: Record<string, string[]>): Shift[] {
  if (!overlays || Object.keys(overlays).length === 0) return shifts;
  return shifts.map((s) => {
    if (!s.workerId || s.shiftKind === "project_task" || (s.eventType !== "work" && s.eventType !== "training")) {
      return s;
    }
    const extra = overlays[deploymentOverlayKey(s.workerId, s.date)];
    if (!extra?.length) return s;
    const base = (s.operationalBadges ?? []).map((x) => x.trim().toUpperCase()).filter(Boolean);
    const merged = [...base];
    for (const c of extra) {
      const u = c.trim().toUpperCase();
      if (u && !merged.includes(u)) merged.push(u);
    }
    if (merged.length === base.length) return s;
    return { ...s, operationalBadges: merged };
  });
}
