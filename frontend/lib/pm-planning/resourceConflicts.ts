import type { CPMResult } from "@/lib/projects/cpm";
import type { PmTask } from "@/lib/pm-planning/types";

export type ResourceConflict = { resource: string; taskA: string; taskB: string };

/** Same calendar resource assigned to overlapping [ES, EF] intervals. */
export function findResourceConflicts(tasks: PmTask[], cpm: CPMResult): ResourceConflict[] {
  const byRes = new Map<string, PmTask[]>();
  for (const t of tasks) {
    const k = t.resource ?? "Unassigned";
    if (!byRes.has(k)) byRes.set(k, []);
    byRes.get(k)!.push(t);
  }
  const out: ResourceConflict[] = [];
  for (const [resource, list] of byRes) {
    if (list.length < 2) continue;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        const ca = cpm.byId[a.id];
        const cb = cpm.byId[b.id];
        if (!ca || !cb || Number.isNaN(ca.slack)) continue;
        const a0 = ca.es;
        const a1 = ca.ef;
        const b0 = cb.es;
        const b1 = cb.ef;
        if (a0 < b1 && b0 < a1) {
          out.push({ resource, taskA: a.id, taskB: b.id });
        }
      }
    }
  }
  return out;
}
