import { approvedTimeOffKind } from "@/lib/schedule/recurring";
import type { ScheduleSettings, Shift, TimeOffBlock, Worker } from "@/lib/schedule/types";
import { evaluateWorkerDrop } from "@/lib/schedule/worker-drag-highlights";

function shiftLengthHours(startTime: string, endTime: string): number {
  const [shh, smm] = startTime.split(":").map(Number);
  const [ehh, emm] = endTime.split(":").map(Number);
  if (![shh, smm, ehh, emm].every((n) => Number.isFinite(n))) return 0;
  let mins = ehh * 60 + emm - (shh * 60 + smm);
  if (mins < 0) mins += 24 * 60;
  return mins / 60;
}

function shiftCountSameDay(shifts: Shift[], workerId: string, date: string, excludeId?: string): number {
  let n = 0;
  for (const s of shifts) {
    if (excludeId && s.id === excludeId) continue;
    if (s.workerId === workerId && s.date === date && s.eventType === "work" && s.shiftKind !== "project_task") n += 1;
  }
  return n;
}

/**
 * Picks a reasonable replacement after a shift is removed (best-effort; local-only).
 */
export function suggestReplacementWorker(
  removed: Shift,
  workers: Worker[],
  shifts: Shift[],
  settings: ScheduleSettings,
  timeOffBlocks: TimeOffBlock[],
): Worker | null {
  if (!removed.workerId || removed.shiftKind === "project_task" || removed.eventType !== "work") {
    return null;
  }
  const certs = removed.required_certifications?.filter(Boolean) ?? [];
  const candidates = workers.filter((w) => w.active && w.id !== removed.workerId);
  const scored: { w: Worker; score: number }[] = [];

  for (const w of candidates) {
    if (approvedTimeOffKind(w.id, removed.date, timeOffBlocks)) continue;
    const drop = evaluateWorkerDrop(w, removed.date, shifts, settings, timeOffBlocks);
    if (!drop.ok) continue;
    const wc = new Set(w.certifications ?? []);
    if (certs.length && !certs.every((c) => wc.has(c))) continue;
    const sameDay = shiftCountSameDay(shifts, w.id, removed.date, removed.id);
    const weekLoad = shifts.filter(
      (s) => s.workerId === w.id && s.eventType === "work" && s.shiftKind !== "project_task",
    ).length;
    const score = sameDay * 10 + weekLoad;
    scored.push({ w, score });
  }

  scored.sort((a, b) => a.score - b.score);
  return scored[0]?.w ?? null;
}

export function suggestReplacementLabel(
  removed: Shift,
  workers: Worker[],
  shifts: Shift[],
  settings: ScheduleSettings,
  timeOffBlocks: TimeOffBlock[],
): string | null {
  const w = suggestReplacementWorker(removed, workers, shifts, settings, timeOffBlocks);
  if (!w) return null;
  const h = shiftLengthHours(removed.startTime, removed.endTime);
  return `Consider ${w.name} (${h.toFixed(0)}h slot, certified)`;
}
