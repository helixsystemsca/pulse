import { apiFetch } from "@/lib/api";
import type {
  HandoverNoteCard,
  KioskOnSiteWorker,
  KioskSection,
  KioskWidgetDefinition,
  ProjectKioskView,
  TeamHighlight,
  TeamInsightMemberRow,
  TeamInsightsPanelData,
  TeamInsightTag,
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

function taskInsightStats(tasks: TaskRow[]): TeamInsightsPanelData["stats"] {
  return {
    total: tasks.length,
    completed: tasks.filter((t) => t.status === "complete").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    blocked: blockedTasks(tasks).length,
  };
}

function displayRole(w: PulseWorkerApi | undefined): string {
  const r = (w?.role ?? "").trim().replace(/_/g, " ");
  if (!r) return "Team member";
  return r.charAt(0).toUpperCase() + r.slice(1);
}

function inferTagVariant(badge: string, description: string): TeamInsightTag["variant"] {
  const s = `${badge} ${description}`.toLowerCase();
  if (s.includes("safety") || s.includes("shield")) return "teal";
  if (s.includes("schedule") || s.includes("on-time") || s.includes("on time") || s.includes("momentum")) return "green";
  if (s.includes("critical") || s.includes("block") || s.includes("risk")) return "orange";
  if (s.includes("pool") || s.includes("multi") || s.includes("skill") || s.includes("signal")) return "blue";
  return "gray";
}

function highlightMatchesUser(h: TeamHighlight, displayName: string): boolean {
  if (h.user === "Team") return false;
  const dn = displayName.trim().toLowerCase();
  const hn = h.user.trim().toLowerCase();
  if (hn === dn) return true;
  const dFirst = dn.split(/\s+/)[0] ?? "";
  const hFirst = hn.split(/\s+/)[0] ?? "";
  return dFirst.length > 0 && hFirst.length > 0 && (dFirst === hFirst || dn.includes(hFirst) || hn.includes(dFirst));
}

function buildTeamInsightMemberRows(
  tasks: TaskRow[],
  workers: PulseWorkerApi[],
  highlights: TeamHighlight[],
): TeamInsightMemberRow[] {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    if (!t.assigned_user_id) continue;
    counts.set(t.assigned_user_id, (counts.get(t.assigned_user_id) ?? 0) + 1);
  }
  const byId = new Map(workers.map((w) => [w.id, w]));
  const sortedIds = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id).slice(0, 10);
  if (sortedIds.length === 0) return [];

  let orphanIdx = 0;
  return sortedIds.map((id) => {
    const w = byId.get(id);
    const displayName = (w?.full_name?.trim() || w?.email || "Member").trim();
    const tags: TeamInsightTag[] = [];
    for (const h of highlights) {
      if (tags.length >= 4) break;
      if (highlightMatchesUser(h, displayName)) {
        tags.push({ label: h.badge, variant: inferTagVariant(h.badge, h.description) });
      }
    }
    let guard = 0;
    while (tags.length < 2 && highlights.length > 0 && guard < highlights.length * 4) {
      guard += 1;
      const h = highlights[orphanIdx % highlights.length];
      orphanIdx += 1;
      if (!h || h.user === "Team") continue;
      if (tags.some((t) => t.label === h.badge)) continue;
      tags.push({ label: h.badge, variant: inferTagVariant(h.badge, h.description) });
    }
    return {
      workerId: id,
      displayName,
      roleLabel: displayRole(w),
      avatarUrl: w?.avatar_url ?? null,
      tags,
    };
  });
}

function buildTeamInsightsPanelData(
  tasks: TaskRow[],
  workers: PulseWorkerApi[],
  highlights: TeamHighlight[],
): TeamInsightsPanelData {
  return {
    stats: taskInsightStats(tasks),
    members: buildTeamInsightMemberRows(tasks, workers, highlights),
  };
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

const STANDING_NOTE_PAT = /supervisor|standing|safety|do not|restricted|caution|blocked area|hazard/i;

function relativeCalendarCaption(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "Recently";
  const start = (x: Date) => {
    const t = new Date(x);
    t.setHours(0, 0, 0, 0);
    return t.getTime();
  };
  const now = new Date();
  const dayDiff = Math.round((start(now) - start(d)) / 86400000);
  if (dayDiff <= 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  if (dayDiff < 7) return `${dayDiff} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function shiftCaptionFromIso(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "Shift";
  const h = d.getHours();
  if (h < 12) return "Morning shift";
  if (h < 17) return "Afternoon shift";
  return "Evening shift";
}

function authorForActivity(a: ProjectActivityRow, workerMap: Map<string, string>, tasks: TaskRow[]): string {
  const title = (a.title ?? "").trim();
  if (title && title.length <= 48 && !/^note\b/i.test(title)) return title;
  if (a.related_task_id) {
    const task = tasks.find((t) => t.id === a.related_task_id);
    if (task?.assigned_user_id) return workerName(workerMap, task.assigned_user_id);
  }
  return "Team";
}

function pickSupervisorActivity(activity: ProjectActivityRow[]): ProjectActivityRow | null {
  const sorted = [...activity].sort((x, y) => parseTs(y.created_at) - parseTs(x.created_at));
  for (const a of sorted) {
    const text = `${a.title ?? ""} ${a.description}`;
    if (a.type === "issue") return a;
    if (a.impact_level === "high") return a;
    if (STANDING_NOTE_PAT.test(text)) return a;
  }
  return null;
}

function handoverEmptyCard(ribbonLabel: string, title: string, metaLine: string, body: string): HandoverNoteCard {
  return { kind: "empty", ribbonLabel, title, metaLine, body };
}

function buildHandoverFilledTeal(
  a: ProjectActivityRow,
  workerMap: Map<string, string>,
  tasks: TaskRow[],
): HandoverNoteCard {
  const shift = shiftCaptionFromIso(a.created_at);
  const rel = relativeCalendarCaption(a.created_at);
  const body = (a.description ?? "").trim().slice(0, 420);
  const titlePart = (a.title ?? "").trim();
  const blob = `${titlePart} ${body}`;
  const looksComplete = /\bcomplete|finished|done|wrapped|signed off\b/i.test(blob);
  const ribbon = `${shift.toUpperCase()} — HANDOVER`;
  const pillLabel =
    looksComplete && titlePart ? `${titlePart.slice(0, 52)}${titlePart.length > 52 ? "…" : ""} — Complete` : "Work progress — Logged";

  return {
    kind: "filled",
    accent: "teal",
    ribbonLabel: ribbon,
    authorName: authorForActivity(a, workerMap, tasks),
    metaLine: `${rel} · ${shift}`,
    body: body || "No additional detail was provided for this handover.",
    statusPill: { tone: "success", label: pillLabel },
  };
}

function buildHandoverFilledDangerFromActivity(
  a: ProjectActivityRow,
  workerMap: Map<string, string>,
  tasks: TaskRow[],
): HandoverNoteCard {
  const body = (a.description ?? "").trim().slice(0, 420);
  const author = authorForActivity(a, workerMap, tasks);
  const meta =
    a.type === "issue" ? "Supervisor · Issue logged" : "Supervisor · All shifts";
  const descLine = body.split(/\n+/)[0]?.trim() ?? body;
  const pillText =
    descLine.length > 56 ? `${descLine.slice(0, 54)}…` : descLine || "Review on site before proceeding";

  return {
    kind: "filled",
    accent: "danger",
    ribbonLabel: "SUPERVISOR — STANDING NOTE",
    authorName: author,
    metaLine: meta,
    body: body || "No additional supervisor context was recorded.",
    statusPill: { tone: "warning", label: pillText },
  };
}

function buildHandoverFilledDangerFromBlocked(t: TaskRow, workerMap: Map<string, string>): HandoverNoteCard {
  const who = workerName(workerMap, t.assigned_user_id);
  const body =
    `Blocked task: ${t.title.trim()}. ` +
    (t.blocking_tasks?.length ?
      `Waiting on: ${t.blocking_tasks
        .map((b) => b.title)
        .join(", ")}.`
    : "Review dependencies and site readiness before sending crews in.");
  const short = t.title.trim().slice(0, 48) + (t.title.trim().length > 48 ? "…" : "");

  return {
    kind: "filled",
    accent: "danger",
    ribbonLabel: "SUPERVISOR — STANDING NOTE",
    authorName: who,
    metaLine: "Supervisor · Blocked work",
    body: body.slice(0, 420),
    statusPill: { tone: "warning", label: `${short} — Review` },
  };
}

function buildHandoverNotesBody(
  tasks: TaskRow[],
  activity: ProjectActivityRow[],
  workerMap: Map<string, string>,
): { kind: "handover_notes"; cards: [HandoverNoteCard, HandoverNoteCard, HandoverNoteCard, HandoverNoteCard] } {
  const blk = blockedTasks(tasks);
  const notes = activity
    .filter((a) => a.type === "note")
    .sort((x, y) => parseTs(y.created_at) - parseTs(x.created_at));
  const sup = pickSupervisorActivity(activity);

  const shiftNote =
    sup ? notes.find((n) => n.id !== sup.id) ?? null
    : notes[0] ?? null;

  const topLeft: HandoverNoteCard =
    shiftNote ?
      buildHandoverFilledTeal(shiftNote, workerMap, tasks)
    : handoverEmptyCard(
        "SHIFT HANDOVER",
        "No notes yet",
        "Today · Pending submission",
        "Shift-to-shift notes will appear here once someone logs a project note from the activity panel.",
      );

  let topRight: HandoverNoteCard;
  if (sup) {
    topRight = buildHandoverFilledDangerFromActivity(sup, workerMap, tasks);
  } else if (blk[0]) {
    topRight = buildHandoverFilledDangerFromBlocked(blk[0], workerMap);
  } else {
    topRight = handoverEmptyCard(
      "SUPERVISOR — STANDING NOTE",
      "No standing notes",
      "All shifts · Clear",
      "Supervisor alerts, safety holds, and high-impact issues will surface here when logged.",
    );
  }

  const bottomLeft = handoverEmptyCard(
    "MORNING SHIFT",
    "No notes yet",
    "Today · Pending submission",
    "Morning shift notes will appear here once submitted.",
  );
  const bottomRight = handoverEmptyCard(
    "EVENING SHIFT",
    "No notes yet",
    "Today · Pending submission",
    "Evening shift notes will appear here once submitted.",
  );

  return { kind: "handover_notes", cards: [topLeft, topRight, bottomLeft, bottomRight] };
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
  workers: PulseWorkerApi[],
  widgets: KioskWidgetDefinition[],
  highlights: TeamHighlight[],
  activity: ProjectActivityRow[],
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
      const panel = buildTeamInsightsPanelData(tasks, workers, highlights);
      push(w, {
        id: "team_insights",
        title: w.label,
        isHighValue: w.isHighValue,
        body: { kind: "team_insights_panel", stats: panel.stats, members: panel.members },
      });
    }
    if (w.id === "handover") {
      push(w, {
        id: "handover",
        title: w.label,
        isHighValue: w.isHighValue,
        body: buildHandoverNotesBody(tasks, activity, workerMap),
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
  const teamInsightsPanel = buildTeamInsightsPanelData(tasks, workers, highlights);
  const { locked, rotating } = buildSections(project, tasks, workerMap, workers, widgets, highlights, activity);
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
    teamInsightsPanel,
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
