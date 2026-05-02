import type { TaskRow } from "@/lib/projectsService";

/** Task workstream for Gantt / CPM UI (API may send `category`; else derived from `phase_group`). */
export type TaskCategory = "planning" | "execution" | "cleanup" | "reflection" | "other";

export const TASK_CATEGORY_COLORS: Record<TaskCategory, string> = {
  planning: "bg-ds-blue-500",
  execution: "bg-ds-teal-500",
  cleanup: "bg-ds-yellow-500",
  reflection: "bg-ds-pink-500",
  other: "bg-ds-gray-400",
};

const CAT_SET = new Set<TaskCategory>(["planning", "execution", "cleanup", "reflection", "other"]);

export function normalizeTaskCategory(task: TaskRow): TaskCategory {
  const raw = task.category ?? (task as { task_category?: string | null }).task_category;
  if (raw && CAT_SET.has(raw as TaskCategory)) return raw as TaskCategory;
  const p = (task.phase_group || "").toLowerCase();
  if (p.includes("plan")) return "planning";
  if (p.includes("execut")) return "execution";
  if (p.includes("clean")) return "cleanup";
  if (p.includes("reflect")) return "reflection";
  return "other";
}

/** Duration in days for CPM (float); minimum a small positive to avoid degenerate graphs. */
export function taskDurationDaysForCPM(task: TaskRow): number {
  if (task.estimated_completion_minutes != null && task.estimated_completion_minutes > 0) {
    return Math.max(task.estimated_completion_minutes / (60 * 24), 1 / 24);
  }
  if (typeof task.duration_estimate === "number" && Number.isFinite(task.duration_estimate) && task.duration_estimate > 0) {
    return task.duration_estimate;
  }
  const raw = task.estimated_duration?.trim();
  if (raw) {
    const m = raw.match(/(\d+)/);
    if (m) {
      const v = Number.parseInt(m[1], 10);
      if (Number.isFinite(v) && v > 0) return v;
    }
  }
  return 1;
}

export type CPMRow = {
  taskId: string;
  es: number;
  ef: number;
  ls: number;
  lf: number;
  slack: number;
  isCritical: boolean;
};

export type CPMResult = {
  byId: Record<string, CPMRow>;
  /** Critical tasks in early-start order. */
  criticalPathTaskIds: string[];
  /** Max early finish (project duration in day units). */
  projectDuration: number;
  /** True if dependency graph had a cycle; CPM numbers may be partial. */
  hasCycle: boolean;
};

const SLACK_EPS = 1e-4;

/**
 * Classic CPM (ES/EF forward, LS/LF backward) on task rows using `depends_on_task_ids`.
 * Same task list as Gantt; durations match `taskDurationDaysForCPM`.
 */
export function computeCPM(tasks: TaskRow[]): CPMResult {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const ids = tasks.map((t) => t.id);
  const idSet = new Set(ids);

  const preds = new Map<string, string[]>();
  const succs = new Map<string, string[]>();
  for (const id of ids) {
    preds.set(id, []);
    succs.set(id, []);
  }
  for (const t of tasks) {
    const ps = (t.depends_on_task_ids ?? []).filter((p) => idSet.has(p) && p !== t.id);
    preds.set(t.id, ps);
    for (const p of ps) {
      succs.get(p)!.push(t.id);
    }
  }

  const indeg = new Map<string, number>();
  for (const id of ids) indeg.set(id, preds.get(id)!.length);
  const queue: string[] = [];
  for (const id of ids) if (indeg.get(id) === 0) queue.push(id);

  const topo: string[] = [];
  while (queue.length) {
    const u = queue.shift()!;
    topo.push(u);
    for (const v of succs.get(u) ?? []) {
      indeg.set(v, (indeg.get(v) ?? 0) - 1);
      if (indeg.get(v) === 0) queue.push(v);
    }
  }

  const hasCycle = topo.length !== ids.length;

  const es = new Map<string, number>();
  const ef = new Map<string, number>();
  for (const id of topo) {
    const pList = preds.get(id) ?? [];
    const esVal = pList.length === 0 ? 0 : Math.max(...pList.map((p) => ef.get(p) ?? 0));
    const d = taskDurationDaysForCPM(byId.get(id)!);
    es.set(id, esVal);
    ef.set(id, esVal + d);
  }

  let projectDuration = 0;
  for (const id of ids) projectDuration = Math.max(projectDuration, ef.get(id) ?? 0);

  const ls = new Map<string, number>();
  const lf = new Map<string, number>();
  if (!hasCycle) {
    for (const id of [...topo].reverse()) {
      const sList = succs.get(id) ?? [];
      const lfVal = sList.length === 0 ? projectDuration : Math.min(...sList.map((s) => ls.get(s) ?? projectDuration));
      const d = taskDurationDaysForCPM(byId.get(id)!);
      lf.set(id, lfVal);
      ls.set(id, lfVal - d);
    }
  }

  const out: Record<string, CPMRow> = {};
  const criticalPathTaskIds: string[] = [];
  for (const id of ids) {
    if (hasCycle || !es.has(id)) {
      out[id] = { taskId: id, es: 0, ef: 0, ls: 0, lf: 0, slack: Number.NaN, isCritical: false };
      continue;
    }
    const eS = es.get(id) ?? 0;
    const eF = ef.get(id) ?? 0;
    const lS = ls.get(id) ?? 0;
    const lF = lf.get(id) ?? 0;
    const slack = lS - eS;
    const isCritical = Math.abs(slack) < SLACK_EPS;
    out[id] = { taskId: id, es: eS, ef: eF, ls: lS, lf: lF, slack, isCritical };
    if (isCritical) criticalPathTaskIds.push(id);
  }

  criticalPathTaskIds.sort((a, b) => (out[a]!.es - out[b]!.es) || a.localeCompare(b));

  return { byId: out, criticalPathTaskIds, projectDuration, hasCycle };
}
