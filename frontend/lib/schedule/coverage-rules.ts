import type { Shift, ShiftTypeKey, Worker } from "@/lib/schedule/types";

export type CoverageRule =
  | {
      id: string;
      kind: "cert_per_shift_type";
      certification: string; // e.g. "RO"
      minCount: number; // e.g. 1
      shiftTypes: ShiftTypeKey[]; // e.g. ["day","afternoon","night"]
      enabled?: boolean;
      label?: string;
    }
  | {
      id: string;
      kind: "min_workers_per_shift_type";
      minCount: number;
      shiftTypes: ShiftTypeKey[];
      enabled?: boolean;
      label?: string;
    };

export type CoverageViolation = {
  ruleId: string;
  date: string;
  shiftType: ShiftTypeKey;
  severity: "warning" | "critical";
  message: string;
};

function cleanRule(raw: unknown): CoverageRule | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  const kind = typeof o.kind === "string" ? o.kind : "";
  if (!id || !kind) return null;
  const enabled = o.enabled === undefined ? true : Boolean(o.enabled);
  const label = typeof o.label === "string" ? o.label : undefined;
  const shiftTypes = Array.isArray(o.shiftTypes) ? (o.shiftTypes.filter((x) => typeof x === "string") as ShiftTypeKey[]) : [];
  const minCount = Number(o.minCount ?? 0) || 0;
  if (kind === "cert_per_shift_type") {
    const cert = typeof o.certification === "string" ? o.certification.trim() : "";
    if (!cert || minCount < 1 || shiftTypes.length < 1) return null;
    return { id, kind, certification: cert, minCount, shiftTypes, enabled, label };
  }
  if (kind === "min_workers_per_shift_type") {
    if (minCount < 1 || shiftTypes.length < 1) return null;
    return { id, kind, minCount, shiftTypes, enabled, label };
  }
  return null;
}

export function parseCoverageRules(raw: unknown): CoverageRule[] {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [];
  const out: CoverageRule[] = [];
  for (const x of arr) {
    const r = cleanRule(x);
    if (r) out.push(r);
  }
  return out;
}

function workerHasCert(worker: Worker | undefined, cert: string): boolean {
  if (!worker) return false;
  const set = new Set((worker.certifications ?? []).map((c) => String(c).trim().toLowerCase()).filter(Boolean));
  return set.has(cert.trim().toLowerCase());
}

function workersFor(date: string, shiftType: ShiftTypeKey, shifts: Shift[]): string[] {
  const ids: string[] = [];
  for (const s of shifts) {
    if (s.shiftKind === "project_task") continue;
    if (s.eventType !== "work") continue;
    if (s.date !== date) continue;
    if (s.shiftType !== shiftType) continue;
    if (!s.workerId) continue;
    if (!ids.includes(s.workerId)) ids.push(s.workerId);
  }
  return ids;
}

export function evaluateCoverageRules(
  rulesRaw: unknown,
  visibleDates: string[],
  shifts: Shift[],
  workers: Worker[],
): CoverageViolation[] {
  const rules = parseCoverageRules(rulesRaw);
  if (!rules.length) return [];
  const workerMap = new Map(workers.map((w) => [w.id, w]));
  const out: CoverageViolation[] = [];

  for (const r of rules) {
    if (r.enabled === false) continue;
    for (const date of visibleDates) {
      for (const st of r.shiftTypes) {
        const wids = workersFor(date, st, shifts);
        if (r.kind === "min_workers_per_shift_type") {
          if (wids.length >= r.minCount) continue;
          out.push({
            ruleId: r.id,
            date,
            shiftType: st,
            severity: "warning",
            message: (r.label ?? `Need at least ${r.minCount} workers`) + ` (${st})`,
          });
          continue;
        }
        if (r.kind === "cert_per_shift_type") {
          const ok = wids.filter((id) => workerHasCert(workerMap.get(id), r.certification)).length;
          if (ok >= r.minCount) continue;
          out.push({
            ruleId: r.id,
            date,
            shiftType: st,
            severity: "critical",
            message:
              (r.label ?? `Need ${r.minCount}+ ${r.certification} certified`) +
              ` (${st})`,
          });
        }
      }
    }
  }

  return out;
}

