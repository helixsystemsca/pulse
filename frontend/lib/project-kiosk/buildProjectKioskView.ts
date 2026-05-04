import { apiFetch } from "@/lib/api";
import type {
  HandoverNoteCard,
  KioskOnShiftWorkerCard,
  KioskProjectOwnerHint,
  KioskSection,
  KioskShiftBand,
  KioskSupervisorRosterRow,
  KioskSupervisorsOnSite,
  KioskWidgetDefinition,
  ProjectKioskView,
  SafetyReminderCard,
  TeamHighlight,
  TeamInsightMemberRow,
  TeamInsightsPanelData,
  TeamInsightTag,
} from "@/lib/project-kiosk/types";
import { fetchScheduleAssignments, type ScheduleAssignment } from "@/lib/schedule/assignments";
import { formatLocalDate } from "@/lib/schedule/calendar";
import type { PulseShiftApi, PulseWorkerApi } from "@/lib/schedule/pulse-bridge";
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

function localTodayRange(): { ymd: string; startMs: number; endMs: number; startIso: string; endIso: string } {
  const n = new Date();
  const ymd = formatLocalDate(n);
  const start = new Date(n);
  start.setHours(0, 0, 0, 0);
  const end = new Date(n);
  end.setHours(23, 59, 59, 999);
  return {
    ymd,
    startMs: start.getTime(),
    endMs: end.getTime(),
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function shiftsOverlapToday(s: PulseShiftApi, startMs: number, endMs: number): boolean {
  const a = Date.parse(s.starts_at);
  const b = Date.parse(s.ends_at);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return a < endMs && b > startMs;
}

function buildProjectOwnerHint(project: ProjectDetail, workers: PulseWorkerApi[]): KioskProjectOwnerHint {
  const oid = project.owner_user_id;
  if (oid) {
    const w = workers.find((x) => x.id === oid);
    const name = (w?.full_name?.trim() || w?.email || "Project owner").trim();
    return { displayName: name, roleLabel: "Project owner" };
  }
  const mgr = workers.find((x) => x.role === "manager" || x.roles?.includes("manager"));
  if (mgr) {
    const name = (mgr.full_name?.trim() || mgr.email || "Manager").trim();
    return { displayName: name, roleLabel: "Manager" };
  }
  const sup = workers.find((x) => x.role === "supervisor" || x.roles?.includes("supervisor"));
  if (sup) {
    const name = (sup.full_name?.trim() || sup.email || "Supervisor").trim();
    return { displayName: name, roleLabel: "Supervisor" };
  }
  const lead = workers.find((x) => x.role === "lead" || x.roles?.includes("lead"));
  if (lead) {
    const name = (lead.full_name?.trim() || lead.email || "Lead").trim();
    return { displayName: name, roleLabel: "Lead" };
  }
  return { displayName: "your site supervisor", roleLabel: "Supervisor" };
}

function buildOnShiftWorkerCards(
  projectId: string,
  tasks: TaskRow[],
  workers: PulseWorkerApi[],
  assignments: ScheduleAssignment[],
  shifts: PulseShiftApi[],
): KioskOnShiftWorkerCard[] {
  const { ymd, startMs, endMs } = localTodayRange();
  const ids = new Set<string>();

  for (const as of assignments) {
    if (as.date === ymd && as.assigned_user_id) ids.add(as.assigned_user_id);
  }
  for (const sh of shifts) {
    if (!sh.assigned_user_id || !shiftsOverlapToday(sh, startMs, endMs)) continue;
    const pid = sh.project_id ?? null;
    const taskPid = sh.project_task_id ? tasks.find((t) => t.id === sh.project_task_id)?.project_id : null;
    const onThisProject = pid === projectId || taskPid === projectId;
    if (onThisProject) ids.add(sh.assigned_user_id);
  }

  for (const t of tasks) {
    if (t.status === "complete") continue;
    if (t.assigned_user_id) ids.add(t.assigned_user_id);
  }

  const byId = new Map(workers.map((w) => [w.id, w]));
  const sorted = [...ids].sort((a, b) => {
    const na = (byId.get(a)?.full_name || byId.get(a)?.email || a).toLowerCase();
    const nb = (byId.get(b)?.full_name || byId.get(b)?.email || b).toLowerCase();
    return na.localeCompare(nb);
  });

  return sorted.map((id) => {
    const w = byId.get(id);
    const displayName = (w?.full_name?.trim() || w?.email || "Member").trim();
    const assignedTaskTitles = tasks
      .filter((t) => t.assigned_user_id === id && t.status !== "complete")
      .map((t) => t.title.trim())
      .filter(Boolean)
      .slice(0, 5);
    const assign = assignments.find((x) => x.assigned_user_id === id && x.date === ymd);
    const shiftRow = shifts.find((s) => {
      if (s.assigned_user_id !== id || !shiftsOverlapToday(s, startMs, endMs)) return false;
      if (s.project_id === projectId) return true;
      if (s.project_task_id) {
        const task = tasks.find((x) => x.id === s.project_task_id);
        return task?.project_id === projectId;
      }
      return false;
    });
    const fromAssignment =
      assign ? [assign.shift_type, assign.area].filter(Boolean).join(" · ").replace(/_/g, " ").trim() || null : null;
    const fromPublished =
      shiftRow ?
        (shiftRow.display_label?.trim() ||
          [shiftRow.shift_type, shiftRow.shift_code].filter(Boolean).join(" · ").replace(/_/g, " ").trim() ||
          "Scheduled")
      : null;
    const shiftSummary = fromAssignment ?? fromPublished;

    return {
      workerId: id,
      firstName: firstNameFromFull(displayName),
      displayName,
      avatarUrl: w?.avatar_url ?? null,
      assignedTaskTitles,
      shiftSummary: shiftSummary ?? null,
    };
  });
}

function formatTodayKioskLabel(): string {
  return new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function projectDurationCaption(startIso: string | null | undefined, endIso: string | null | undefined): string | null {
  if (!startIso?.trim() || !endIso?.trim()) return null;
  const a = new Date(startIso.includes("T") ? startIso : `${startIso.trim()}T12:00:00`);
  const b = new Date(endIso.includes("T") ? endIso : `${endIso.trim()}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  const da = new Date(a);
  da.setHours(0, 0, 0, 0);
  const db = new Date(b);
  db.setHours(0, 0, 0, 0);
  const days = Math.round((db.getTime() - da.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  if (!Number.isFinite(days) || days < 1) return null;
  return `${days} day${days === 1 ? "" : "s"} duration`;
}

function shiftBandFromType(st: string): KioskShiftBand {
  const s = String(st).toLowerCase().replace(/_/g, " ");
  if (/\bnight\b|grave|noc/.test(s)) return "night";
  if (/\bafternoon\b|swing|\beve/.test(s) || /\bpm\b/.test(s)) return "afternoon";
  return "day";
}

function supervisorTier(w: PulseWorkerApi): "manager" | "supervisor" | "lead" | null {
  const raw = w.roles?.length ? w.roles : [w.role];
  const set = new Set(raw.map((x) => String(x).toLowerCase()));
  if (set.has("manager") || set.has("company_admin")) return "manager";
  if (set.has("supervisor")) return "supervisor";
  if (set.has("lead")) return "lead";
  return null;
}

function pushUniqueName(arr: string[], displayName: string) {
  const short = firstNameFromFull(displayName.trim() || "?");
  if (!short || arr.includes(short)) return;
  arr.push(short);
}

function buildSupervisorsOnSite(
  projectId: string,
  tasks: TaskRow[],
  workers: PulseWorkerApi[],
  assignments: ScheduleAssignment[],
  shifts: PulseShiftApi[],
): KioskSupervisorsOnSite {
  const { ymd, startMs, endMs } = localTodayRange();
  const byId = new Map(workers.map((w) => [w.id, w]));

  const acc: Record<"manager" | "supervisor" | "lead", Record<KioskShiftBand, string[]>> = {
    manager: { day: [], afternoon: [], night: [] },
    supervisor: { day: [], afternoon: [], night: [] },
    lead: { day: [], afternoon: [], night: [] },
  };

  const add = (userId: string | null | undefined, band: KioskShiftBand) => {
    if (!userId) return;
    const w = byId.get(userId);
    if (!w) return;
    const tier = supervisorTier(w);
    if (!tier) return;
    const displayName = (w.full_name?.trim() || w.email || "Member").trim();
    pushUniqueName(acc[tier][band], displayName);
  };

  for (const as of assignments) {
    if (as.date !== ymd || !as.assigned_user_id) continue;
    add(as.assigned_user_id, shiftBandFromType(as.shift_type));
  }

  for (const sh of shifts) {
    if (!sh.assigned_user_id || !shiftsOverlapToday(sh, startMs, endMs)) continue;
    const pid = sh.project_id ?? null;
    const taskPid = sh.project_task_id ? tasks.find((t) => t.id === sh.project_task_id)?.project_id : null;
    const onThisProject = pid === projectId || taskPid === projectId;
    if (!onThisProject) continue;
    add(sh.assigned_user_id, shiftBandFromType(sh.shift_type));
  }

  const rows: KioskSupervisorRosterRow[] = [
    { roleLabel: "Manager", namesByBand: { ...acc.manager } },
    { roleLabel: "Supervisor", namesByBand: { ...acc.supervisor } },
    { roleLabel: "Lead", namesByBand: { ...acc.lead } },
  ];
  return { rows };
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

function envPublicTrim(key: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  const v = process.env[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function buildSafetyRemindersBody(
  project: ProjectDetail,
  tasks: TaskRow[],
  workerMap: Map<string, string>,
): { kind: "safety_reminders"; subtitle: string; cards: SafetyReminderCard[] } {
  const act = activeTasks(tasks);
  const blk = blockedTasks(tasks);
  const orderedFocus = [
    ...act.filter((t) => t.status === "in_progress"),
    ...act.filter((t) => t.status === "blocked"),
    ...act.filter((t) => t.status === "todo"),
  ].filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i);

  const hazardTask =
    blk.find((t) => /\b(pump|confined|tank|sewer|pit|vault|chlorine|gas)\b/i.test(t.title)) ??
    blk[0] ??
    tasks.find((t) => t.status === "in_progress" && t.priority === "critical");

  let criticalTitle: string;
  let criticalBody: string;
  if (hazardTask) {
    const t = hazardTask.title.trim();
    if (/\bpump\b/i.test(t)) criticalTitle = "Confined space — pump room";
    else if (/\bconfined\b/i.test(t)) criticalTitle = `Confined space — ${t.slice(0, 48)}${t.length > 48 ? "…" : ""}`;
    else criticalTitle = `High attention — ${t.slice(0, 52)}${t.length > 52 ? "…" : ""}`;
    const extra = [hazardTask.material_notes, hazardTask.description].filter(Boolean).join(" ").trim();
    criticalBody =
      extra.slice(0, 380) ||
      (blk.includes(hazardTask) ?
        "This work is blocked — do not enter the space until your supervisor clears barricades, ventilation, and permits. Use a buddy system and continuous gas monitoring when a confined-space program applies."
      : "Follow the task SOP, posted signage, and supervisor direction. Stop work if controls are missing or conditions change.");
  } else {
    criticalTitle = "Site awareness — active project";
    criticalBody =
      "Review permits, barricades, ventilation, and line-of-fire before entering work zones. Stop and ask your supervisor if controls are unclear.";
  }

  const lines = orderedFocus.slice(0, 7).map((t) => {
    const who = workerName(workerMap, t.assigned_user_id);
    const flag = t.is_blocked ? " (blocked)" : "";
    return `• ${t.title.trim()} — ${who}${flag}`;
  });
  const ppeBody =
    lines.length > 0 ?
      ["Today's assignments on this project:", ...lines, "", "Match gloves, eye protection, footwear, and hearing protection to each task and SDS. No shortcuts on cut hazards, chemicals, or overhead work."].join(
        "\n",
      )
    : "No active assignments are listed — stay ready for call-ins. Default to closed-toe shoes, safety glasses, and high-visibility gear where vehicles or machinery operate.";

  const firstAid =
    envPublicTrim("NEXT_PUBLIC_KIOSK_SAFETY_FIRST_AID") ??
    "Confirm the nearest first aid kit and AED with your supervisor at the start of each shift. Follow posted evacuation diagrams; do not move an injured person unless the scene is safe.";

  const exits =
    envPublicTrim("NEXT_PUBLIC_KIOSK_SAFETY_EMERGENCY_EXITS") ??
    "Use the nearest marked exit. Keep exit routes and fire doors clear. If visibility drops, follow illuminated exit signs toward the exterior, then proceed to the muster point.";

  const muster =
    envPublicTrim("NEXT_PUBLIC_KIOSK_SAFETY_MUSTER_POINT") ??
    "Primary muster: main parking lot assembly area unless your supervisor posts an alternate. Check in by crew after any alarm so everyone is accounted for.";

  const contacts =
    envPublicTrim("NEXT_PUBLIC_KIOSK_SAFETY_EMERGENCY_CONTACTS") ??
    "Life-threatening emergency: call 911.\nSite / facilities duty: use the posted call sheet at the supervisor desk.\nConfirm who is on call for this project before starting work.";

  const subtitle =
    envPublicTrim("NEXT_PUBLIC_KIOSK_SAFETY_SUBTITLE") ?? `Active for ${project.name.trim() || "this project"}`;

  const cards: SafetyReminderCard[] = [
    {
      severity: "critical",
      icon: "shield-alert",
      tag: "Critical",
      title: criticalTitle,
      description: criticalBody.slice(0, 520),
    },
    {
      severity: "caution",
      icon: "hard-hat",
      tag: "Caution",
      title: "PPE & today's assignments",
      description: ppeBody.slice(0, 560),
    },
    {
      severity: "info",
      icon: "stethoscope",
      tag: "Info",
      title: "First aid kit & AED",
      description: firstAid.slice(0, 520),
    },
    {
      severity: "emergency",
      icon: "phone",
      tag: "Emergency",
      title: "Emergency contacts",
      description: contacts.slice(0, 520),
    },
    {
      severity: "info",
      icon: "door-open",
      tag: "Info",
      title: "Emergency exits",
      description: exits.slice(0, 520),
    },
    {
      severity: "caution",
      icon: "map-pin",
      tag: "Caution",
      title: "Muster point",
      description: muster.slice(0, 520),
    },
  ];

  return { kind: "safety_reminders", subtitle, cards };
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
        body: {
          kind: "team_insights_panel",
          stats: panel.stats,
          members: panel.members,
          highlights,
        },
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
    if (w.id === "safety") {
      push(w, {
        id: "safety",
        title: w.label,
        isHighValue: w.isHighValue,
        body: buildSafetyRemindersBody(project, tasks, workerMap),
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

const KIOSK_ROTATION_ORDER = [
  "safety",
  "handover",
  "task_board",
  "active_tasks",
  "team_insights",
  "progress",
  "blocked",
  "active_work",
  "blockers",
  "progress_summary",
  "pulse_idle",
];

export function sortRotatingSections(sections: KioskSection[]): KioskSection[] {
  const rank = (id: string) => {
    const i = KIOSK_ROTATION_ORDER.indexOf(id);
    return i === -1 ? 999 : i;
  };
  return [...sections].sort((a, b) => rank(a.id) - rank(b.id) || a.title.localeCompare(b.title));
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
  opts?: { scheduleAssignments?: ScheduleAssignment[]; dayShifts?: PulseShiftApi[] },
): ProjectKioskView {
  const tasks = project.tasks ?? [];
  const assignments = opts?.scheduleAssignments ?? [];
  const dayShifts = opts?.dayShifts ?? [];
  const workerMap = new Map<string, string>(
    workers.map((w) => [w.id, (w.full_name?.trim() || w.email)?.trim() || w.email]),
  );
  const highlights = buildTeamHighlights(tasks, workerMap, activity);
  const teamInsightsPanel = buildTeamInsightsPanelData(tasks, workers, highlights);
  const { locked, rotating } = buildSections(project, tasks, workerMap, workers, widgets, highlights, activity);
  const lastUpdated = new Date().toISOString();
  const targetMeta = targetCompletionMeta(project.end_date);
  const supervisorsOnSite = buildSupervisorsOnSite(project.id, tasks, workers, assignments, dayShifts);
  const onShiftWorkers = buildOnShiftWorkerCards(project.id, tasks, workers, assignments, dayShifts);
  const projectOwnerHint = buildProjectOwnerHint(project, workers);

  return {
    header: {
      facilityLabel: kioskFacilityLabel(),
      projectName: project.name,
      todayLabel: formatTodayKioskLabel(),
      projectStartDate: project.start_date ?? null,
      projectDurationCaption: projectDurationCaption(project.start_date, project.end_date),
      targetEndDate: project.end_date ?? null,
      targetEndCaption: targetMeta.caption,
      targetEndTone: targetMeta.tone,
      percentComplete: Math.round(project.progress_pct ?? 0),
      tasksRemaining: Math.max(0, project.task_total - project.task_completed),
      blockedCount: blockedTasks(tasks).length,
      supervisorsOnSite,
      lastUpdated,
    },
    lockedSections: locked,
    rotatingSections: sortRotatingSections(rotating),
    onShiftWorkers,
    projectOwnerHint,
    teamInsights: { highlights },
    teamInsightsPanel,
  };
}

/** Fetches Pulse data and returns the kiosk view model (no raw ORM / API rows). */
export async function getProjectKioskView(projectId: string): Promise<ProjectKioskView> {
  const { startIso, endIso } = localTodayRange();
  const [project, activity, workers, assignments, shifts] = await Promise.all([
    getProject(projectId),
    listProjectActivity(projectId),
    apiFetch<PulseWorkerApi[]>("/api/v1/pulse/workers"),
    fetchScheduleAssignments({ from: startIso, to: endIso }).catch((): ScheduleAssignment[] => []),
    apiFetch<PulseShiftApi[]>(
      `/api/v1/pulse/schedule/shifts?from=${encodeURIComponent(startIso)}&to=${encodeURIComponent(endIso)}`,
    ).catch((): PulseShiftApi[] => []),
  ]);
  const widgets = loadKioskWidgetConfig();
  return buildProjectKioskView(project, activity ?? [], workers ?? [], widgets, {
    scheduleAssignments: assignments ?? [],
    dayShifts: shifts ?? [],
  });
}
