import { apiFetch } from "@/lib/api";
import type {
  KioskOnSiteWorker,
  KioskSection,
  KioskWidgetDefinition,
  ProjectKioskView,
  TeamHighlight,
} from "@/lib/project-kiosk/types";
import type { PulseWorkerApi } from "@/lib/schedule/pulse-bridge";
import {
  getProject,
  listProjectActivity,
  type ProjectActivityRow,
  type ProjectDetail,
  type TaskRow,
} from "@/lib/projectsService";
import { loadKioskWidgetConfig } from "@/lib/project-kiosk/kioskWidgetConfig";

function workerName(map: Map<string, string>, id: string | null | undefined): string {
  if (!id) return "Unassigned";
  return map.get(id)?.trim() || "Team member";
}

function firstNameFromFull(full: string): string {
  const t = full.trim();
  if (!t) return "?";
  return (t.split(/\s+/)[0] ?? t).replace(/[.,:;!?$]+$/, "");
}

function kioskFacilityLabel(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_KIOSK_FACILITY_NAME?.trim()) {
    return process.env.NEXT_PUBLIC_KIOSK_FACILITY_NAME.trim();
  }
  return "Panorama Recreation";
}

function targetCompletionMeta(
  endIso: string | null | undefined,
): { caption: string; tone: "default" | "warning" | "danger" } {
  if (!endIso) return { caption: "No target set", tone: "default" };
  const end = new Date(endIso.includes("T") ? endIso : `${endIso}T12:00:00`);
  if (Number.isNaN(end.getTime())) return { caption: "No target set", tone: "default" };
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);
  const diffMs = endDay.getTime() - startToday.getTime();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return { caption: `${Math.abs(diffDays)} days overdue`, tone: "danger" };
  if (diffDays === 0) return { caption: "Due today", tone: "warning" };
  return { caption: `${diffDays} day${diffDays === 1 ? "" : "s"} remaining`, tone: "default" };
}

function onSiteWorkersFromTasks(tasks: TaskRow[], workers: PulseWorkerApi[]): KioskOnSiteWorker[] {
  const inProg = tasks.filter((t) => t.status === "in_progress" && t.assigned_user_id);
  const ids = [...new Set(inProg.map((t) => t.assigned_user_id!))];
  const byId = new Map(workers.map((w) => [w.id, w]));
  return ids
    .map((id) => {
      const w = byId.get(id);
      const displayName = (w?.full_name?.trim() || w?.email || "Member").trim();
      return {
        id,
        firstName: firstNameFromFull(displayName),
        displayName,
        avatarUrl: w?.avatar_url ?? null,
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function parseTs(iso: string | null | undefined): number {
  if (!iso) return NaN;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : NaN;
}

function withinMs(iso: string | null | undefined, ms: number): boolean {
  const t = parseTs(iso);
  if (!Number.isFinite(t)) return false;
  return Date.now() - t <= ms;
}

function activeTasks(tasks: TaskRow[]): TaskRow[] {
  return tasks.filter((t) => t.status !== "complete");
}

function blockedTasks(tasks: TaskRow[]): TaskRow[] {
  return tasks.filter((t) => t.is_blocked);
}

function uniqueActiveWorkerIds(tasks: TaskRow[]): number {
  const ids = new Set<string>();
  for (const t of activeTasks(tasks)) {
    if (t.assigned_user_id) ids.add(t.assigned_user_id);
  }
  return ids.size;
}

function taskColumnsByStatus(tasks: TaskRow[], statuses: string[]): { label: string; items: string[] }[] {
  return statuses.map((status) => ({
    label: status.replace(/_/g, " "),
    items: activeTasks(tasks)
      .filter((t) => t.status === status)
      .map((t) => t.title.trim())
      .filter(Boolean)
      .slice(0, 6),
  }));
}

function buildTeamHighlights(
  tasks: TaskRow[],
  workerMap: Map<string, string>,
  activity: ProjectActivityRow[],
): TeamHighlight[] {
  const highlights: TeamHighlight[] = [];
  const hourMs = 60 * 60 * 1000;
  const dayMs = 24 * hourMs;

  const completesLastHour = tasks.filter((t) => t.status === "complete" && withinMs(t.updated_at, hourMs));
  const byUser = new Map<string, number>();
  for (const t of completesLastHour) {
    const uid = t.assigned_user_id;
    if (!uid) continue;
    byUser.set(uid, (byUser.get(uid) ?? 0) + 1);
  }
  const sorted = [...byUser.entries()].sort((a, b) => b[1] - a[1]);
  const [topId, topN] = sorted[0] ?? [];
  if (topId && topN && topN > 0) {
    highlights.push({
      user: workerName(workerMap, topId),
      badge: "Momentum",
      description: `${topN} task${topN === 1 ? "" : "s"} wrapped up in the last hour`,
    });
  }

  const criticalDone = tasks.find(
    (t) => t.status === "complete" && t.priority === "critical" && withinMs(t.updated_at, dayMs),
  );
  if (criticalDone) {
    highlights.push({
      user: workerName(workerMap, criticalDone.assigned_user_id),
      badge: "Critical path",
      description: `Handled critical priority: ${criticalDone.title.trim()}`,
    });
  }

  const completeCountByUser = new Map<string, number>();
  for (const t of tasks) {
    if (t.status !== "complete") continue;
    const uid = t.assigned_user_id;
    if (!uid) continue;
    completeCountByUser.set(uid, (completeCountByUser.get(uid) ?? 0) + 1);
  }
  const steady = [...completeCountByUser.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1])[0];
  if (steady && highlights.length < 4) {
    highlights.push({
      user: workerName(workerMap, steady[0]),
      badge: "Steady",
      description: `${steady[1]} completed tasks on this project — consistent delivery`,
    });
  }

  // Activity-based (notes / updates) — lightweight signal when task stats sparse
  if (highlights.length < 2 && activity.length) {
    const recent = activity.filter((a) => withinMs(a.created_at, dayMs)).slice(0, 12);
    const note = recent.find((a) => a.type === "note" && a.description?.trim());
    if (note) {
      highlights.push({
        user: "Team",
        badge: "Signal",
        description: note.description.trim().slice(0, 120),
      });
    }
  }

  if (highlights.length === 0) {
    highlights.push({
      user: "Team",
      badge: "Ready",
      description: "Awaiting live activity — when tasks move, highlights appear here.",
    });
  }

  return highlights.slice(0, 6);
}

function buildSections(
  project: ProjectDetail,
  tasks: TaskRow[],
  workerMap: Map<string, string>,
  widgets: KioskWidgetDefinition[],
  highlights: TeamHighlight[],
): { locked: KioskSection[]; rotating: KioskSection[] } {
  const locked: KioskSection[] = [];
  const rotating: KioskSection[] = [];

  const push = (w: KioskWidgetDefinition, section: KioskSection) => {
    if (w.isHighValue) locked.push(section);
    else rotating.push(section);
  };

  const act = activeTasks(tasks);
  const blk = blockedTasks(tasks);

  for (const w of widgets) {
    if (w.id === "progress") {
      push(w, {
        id: "progress",
        title: w.label,
        isHighValue: w.isHighValue,
        body: {
          kind: "metrics",
          items: [
            { label: "Complete", value: `${Math.round(project.progress_pct ?? 0)}%`, emphasis: "positive" },
            { label: "Remaining", value: `${Math.max(0, project.task_total - project.task_completed)}` },
            { label: "Active people", value: `${uniqueActiveWorkerIds(tasks)}` },
          ],
        },
      });
    }
    if (w.id === "blocked") {
      push(w, {
        id: "blocked",
        title: w.label,
        isHighValue: w.isHighValue,
        body: {
          kind: "metrics",
          items: [
            {
              label: "Blocked",
              value: `${blk.length}`,
              emphasis: blk.length > 0 ? "warning" : "neutral",
            },
          ],
        },
      });
    }
    if (w.id === "active_work") {
      const titles = act.slice(0, 8).map((t) => `${t.title.trim()} · ${workerName(workerMap, t.assigned_user_id)}`);
      push(w, {
        id: "active_work",
        title: w.label,
        isHighValue: w.isHighValue,
        body: { kind: "summary_lines", lines: titles.length ? titles : ["No active tasks right now."] },
      });
    }
    if (w.id === "task_board") {
      push(w, {
        id: "task_board",
        title: w.label,
        isHighValue: w.isHighValue,
        body: {
          kind: "task_columns",
          columns: taskColumnsByStatus(tasks, ["todo", "in_progress", "blocked", "complete"]),
        },
      });
    }
    if (w.id === "active_tasks") {
      push(w, {
        id: "active_tasks",
        title: w.label,
        isHighValue: w.isHighValue,
        body: {
          kind: "task_columns",
          columns: taskColumnsByStatus(tasks, ["todo", "in_progress"]),
        },
      });
    }
    if (w.id === "blockers") {
      push(w, {
        id: "blockers",
        title: w.label,
        isHighValue: w.isHighValue,
        body: {
          kind: "blocked_cards",
          items: blk.slice(0, 10).map((t) => ({
            title: t.title.trim(),
            subtitle:
              t.blocking_tasks?.length ?
                `Waiting on: ${t.blocking_tasks.map((b) => b.title).join(", ")}`
              : "Dependency or readiness constraint",
          })),
        },
      });
    }
    if (w.id === "progress_summary") {
      const lines = [
        `${Math.round(project.progress_pct ?? 0)}% overall · ${project.task_completed} / ${project.task_total} tasks done`,
        project.health_status ? `Health: ${project.health_status}` : "Health: —",
        project.current_phase ? `Phase: ${project.current_phase}` : "",
      ].filter(Boolean);
      push(w, {
        id: "progress_summary",
        title: w.label,
        isHighValue: w.isHighValue,
        body: { kind: "summary_lines", lines },
      });
    }
    if (w.id === "team_insights") {
      push(w, {
        id: "team_insights",
        title: w.label,
        isHighValue: w.isHighValue,
        body: { kind: "insights_cards", highlights },
      });
    }
  }

  if (rotating.length === 0) {
    rotating.push({
      id: "pulse_idle",
      title: "Operational pulse",
      isHighValue: false,
      body: {
        kind: "summary_lines",
        lines: ["Add rotating panels by turning off “high value” on widgets in the dashboard Project tab."],
      },
    });
  }

  return { locked, rotating };
}

/**
 * Pure view-model: maps project detail + roster + activity into kiosk-ready props.
 * Callers fetch inputs; this stays side-effect free and DB-agnostic at this layer.
 */
export function buildProjectKioskView(
  project: ProjectDetail,
  activity: ProjectActivityRow[],
  workers: PulseWorkerApi[],
  widgets: KioskWidgetDefinition[],
): ProjectKioskView {
  const tasks = project.tasks ?? [];
  const workerMap = new Map<string, string>(
    workers.map((w) => [w.id, (w.full_name?.trim() || w.email)?.trim() || w.email]),
  );
  const highlights = buildTeamHighlights(tasks, workerMap, activity);
  const { locked, rotating } = buildSections(project, tasks, workerMap, widgets, highlights);
  const lastUpdated = new Date().toISOString();
  const targetMeta = targetCompletionMeta(project.end_date);
  const onSite = onSiteWorkersFromTasks(tasks, workers);

  return {
    header: {
      facilityLabel: kioskFacilityLabel(),
      projectName: project.name,
      targetEndDate: project.end_date ?? null,
      targetEndCaption: targetMeta.caption,
      targetEndTone: targetMeta.tone,
      percentComplete: Math.round(project.progress_pct ?? 0),
      tasksRemaining: Math.max(0, project.task_total - project.task_completed),
      blockedCount: blockedTasks(tasks).length,
      onSiteWorkers: onSite,
      lastUpdated,
    },
    lockedSections: locked,
    rotatingSections: rotating,
    teamInsights: { highlights },
  };
}

/** Fetches Pulse data and returns the kiosk view model (no raw ORM / API rows). */
export async function getProjectKioskView(projectId: string): Promise<ProjectKioskView> {
  const [project, activity, workers] = await Promise.all([
    getProject(projectId),
    listProjectActivity(projectId),
    apiFetch<PulseWorkerApi[]>("/api/v1/pulse/workers"),
  ]);
  const widgets = loadKioskWidgetConfig();
  return buildProjectKioskView(project, activity ?? [], workers ?? [], widgets);
}
