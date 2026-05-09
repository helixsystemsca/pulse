"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  CalendarRange,
  ClipboardCheck,
  FolderKanban,
  LayoutGrid,
  List,
  Plus,
  Settings2,
  Trash2,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/pulse/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/schedule/SegmentedControl";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { apiFetch } from "@/lib/api";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { ProjectAutomationPanel } from "@/components/projects/ProjectAutomationPanel";
import { ProjectCloseoutTab } from "@/features/projects/ProjectCloseoutTab";
import { PmPlanningShell } from "@/components/pm-planning/PmPlanningShell";
import {
  addProjectNote,
  listCategories,
  createCriticalStep,
  createTask,
  deleteCriticalStep,
  deleteTask,
  getProject,
  listCriticalSteps,
  listProjectActivity,
  listProjectMaterials,
  listProjectEquipment,
  listTaskMaterials,
  listTaskEquipment,
  addTaskMaterial,
  addTaskEquipment,
  deleteTaskMaterial,
  deleteTaskEquipment,
  patchCriticalStep,
  patchProject,
  patchTask,
  syncTaskDependencies,
  type ProjectDetail,
  type ProjectActivityRow,
  type CategoryRow,
  type CriticalStepRow,
  type TaskRow,
  type TaskMaterialRow,
  type TaskEquipmentRow,
  type ProjectMaterialSummaryRow,
  type ProjectEquipmentSummaryRow,
  type FacilityEquipmentListRow,
  fetchEquipmentSuggestions,
} from "@/lib/projectsService";
import { taskRowsToPmTasks } from "@/lib/pm-planning/adapter";
import type { PmProjectMeta } from "@/lib/pm-planning/types";
import { parseLocalDate } from "@/lib/schedule/calendar";
import type { PulseWorkerApi } from "@/lib/schedule/pulse-bridge";
import { useResolvedAvatarSrc } from "@/lib/useResolvedAvatarSrc";
import { fetchInventoryList, type InventoryRow } from "@/lib/inventoryService";
import { cn } from "@/lib/cn";
import { sessionHasAnyRole } from "@/lib/pulse-roles";
import { buttonVariants } from "@/styles/button-variants";

const PRIMARY_BTN = cn(buttonVariants({ surface: "light", intent: "accent" }), "px-5 py-2.5");
const SECONDARY_BTN = cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-4 py-2");
const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-ds-border bg-ds-secondary px-3 py-2.5 text-sm text-ds-foreground shadow-sm focus:border-[color-mix(in_srgb,var(--ds-success)_45%,var(--ds-border))] focus:outline-none focus:ring-1 focus:ring-[color-mix(in_srgb,var(--ds-success)_28%,transparent)]";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-ds-muted";

function healthBadgeClass(h: string | null | undefined): string {
  const v = (h || "").toLowerCase();
  if (v.includes("risk")) return "bg-red-50 text-red-800 ring-red-200/90 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-500/35";
  if (v.includes("attention")) return "bg-amber-50 text-amber-900 ring-amber-200/90 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-500/35";
  return "bg-slate-100 text-ds-muted ring-slate-200/80 dark:bg-ds-secondary dark:text-slate-300 dark:ring-ds-border";
}

function displayName(w: PulseWorkerApi): string {
  return (w.full_name || w.email || "User").trim();
}

function initials(name: string | null | undefined, email: string): string {
  if (name?.trim()) {
    const p = name.trim().split(/\s+/).filter(Boolean);
    if (p.length >= 2) return (p[0][0] + p[p.length - 1][0]).toUpperCase();
    return p[0].slice(0, 2).toUpperCase();
  }
  return email.split("@")[0]?.slice(0, 2).toUpperCase() || "?";
}

function ProjectWorkerMiniAvatar({ w }: { w: PulseWorkerApi }) {
  const src = useResolvedAvatarSrc(w.avatar_url ?? null);
  const ini = initials(w.full_name, w.email);
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ds-elevated text-[10px] font-bold text-ds-foreground ring-1 ring-ds-border">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        ini
      )}
    </span>
  );
}

function priorityBadgeClass(p: string): string {
  if (p === "critical")
    return "text-red-800 ring-red-200/90 dark:text-red-200 dark:ring-red-500/40";
  if (p === "high")
    return "text-amber-900 ring-amber-200/90 dark:text-amber-200 dark:ring-amber-400/35";
  if (p === "low")
    return "text-slate-600 ring-slate-200/90 dark:text-slate-300 dark:ring-slate-500/35";
  return "text-[#2B4C7E] ring-sky-200/90 dark:text-sky-200 dark:ring-sky-500/40";
}

function workerSkillNamesNorm(w: PulseWorkerApi): Set<string> {
  const s = new Set<string>();
  for (const sk of w.skills ?? []) {
    if (sk?.name) s.add(sk.name.trim().toLowerCase());
  }
  return s;
}

function workerMatchesRequired(w: PulseWorkerApi, required: string[]): boolean {
  if (required.length === 0) return true;
  const have = workerSkillNamesNorm(w);
  return required.every((r) => have.has(r.trim().toLowerCase()));
}

const KANBAN_COLS = [
  { key: "todo" as const, label: "Todo" },
  { key: "in_progress" as const, label: "In Progress" },
  { key: "blocked" as const, label: "Blocked" },
  { key: "complete" as const, label: "Complete" },
];

export function ProjectDetailApp({ projectId }: { projectId: string }) {
  const { session } = usePulseAuth();
  const canUsePMFeatures = Boolean(session?.can_use_pm_features);
  const [data, setData] = useState<ProjectDetail | null>(null);
  const [workers, setWorkers] = useState<PulseWorkerApi[]>([]);
  const [skillCategories, setSkillCategories] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [blockHint, setBlockHint] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"overview" | "planning" | "work" | "activity" | "summary" | "closeout">(
    "overview",
  );
  const [viewTab, setViewTab] = useState<"tasks" | "board" | "automation">("tasks");
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [projectCompleting, setProjectCompleting] = useState(false);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [projectMaterials, setProjectMaterials] = useState<ProjectMaterialSummaryRow[] | null>(null);
  const [projectMaterialsErr, setProjectMaterialsErr] = useState<string | null>(null);
  const [projectEquipment, setProjectEquipment] = useState<ProjectEquipmentSummaryRow[] | null>(null);
  const [projectEquipmentErr, setProjectEquipmentErr] = useState<string | null>(null);

  const [overviewGoal, setOverviewGoal] = useState("");
  const [overviewNotes, setOverviewNotes] = useState("");
  const [overviewSuccess, setOverviewSuccess] = useState("");
  const [summaryText, setSummaryText] = useState("");
  const [summaryMetrics, setSummaryMetrics] = useState("");
  const [summaryLessons, setSummaryLessons] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);
  const [activityRows, setActivityRows] = useState<ProjectActivityRow[] | null>(null);
  const [activityErr, setActivityErr] = useState<string | null>(null);
  const [newNote, setNewNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  const [criticalSteps, setCriticalSteps] = useState<CriticalStepRow[] | null>(null);
  const [criticalErr, setCriticalErr] = useState<string | null>(null);
  const [criticalLoading, setCriticalLoading] = useState(false);
  const [newCriticalTitle, setNewCriticalTitle] = useState("");
  const [newCriticalDependsOn, setNewCriticalDependsOn] = useState<string>("");
  const [criticalSavingId, setCriticalSavingId] = useState<string | null>(null);

  const loadCriticalSteps = useCallback(async () => {
    setCriticalLoading(true);
    setCriticalErr(null);
    try {
      const rows = await listCriticalSteps(projectId);
      setCriticalSteps(rows);
    } catch {
      setCriticalErr("Could not load critical steps.");
      setCriticalSteps([]);
    } finally {
      setCriticalLoading(false);
    }
  }, [projectId]);

  const [matchTaskId, setMatchTaskId] = useState<string>("");
  const [workerFilter, setWorkerFilter] = useState<"all" | "matching">("all");
  const [taskSort, setTaskSort] = useState<"priority" | "location" | "task">("priority");
  const [locationFilter, setLocationFilter] = useState<string>("");

  const reload = useCallback(async () => {
    try {
      const p = await getProject(projectId);
      setData(p);
      setErr(null);
      try {
        const mats = await listProjectMaterials(projectId);
        setProjectMaterials(mats);
        setProjectMaterialsErr(null);
      } catch {
        setProjectMaterials([]);
        setProjectMaterialsErr("Could not load materials.");
      }
      try {
        const eq = await listProjectEquipment(projectId);
        setProjectEquipment(eq);
        setProjectEquipmentErr(null);
      } catch {
        setProjectEquipment([]);
        setProjectEquipmentErr("Could not load equipment.");
      }
    } catch {
      setErr("Could not load project.");
    }
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!data) return;
    setOverviewGoal((data.goal ?? "").toString());
    setOverviewNotes((data.notes ?? "").toString());
    setOverviewSuccess((data.success_definition ?? "").toString());
    setSummaryText((data.summary ?? "").toString());
    setSummaryMetrics((data.metrics ?? "").toString());
    setSummaryLessons((data.lessons_learned ?? "").toString());
  }, [data]);

  useEffect(() => {
    (async () => {
      try {
        const w = await apiFetch<PulseWorkerApi[]>("/api/v1/pulse/workers");
        setWorkers(w);
      } catch {
        setWorkers([]);
      }
      try {
        const cats = await listCategories();
        setCategories(cats);
      } catch {
        setCategories([]);
      }
      try {
        const st = await apiFetch<{ settings?: { skill_categories?: string[] } }>("/api/v1/workers/settings");
        const cats = st.settings?.skill_categories;
        setSkillCategories(Array.isArray(cats) ? cats.map((x) => String(x)) : []);
      } catch {
        setSkillCategories([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!blockHint) return;
    const t = window.setTimeout(() => setBlockHint(null), 4000);
    return () => window.clearTimeout(t);
  }, [blockHint]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const workerMap = useMemo(
    () => new Map(workers.map((w) => [w.id, w.full_name || w.email])),
    [workers],
  );

  const tasks = data?.tasks ?? [];

  const planningProjectStart = useMemo(() => {
    const s = data?.start_date?.trim();
    if (!s) return new Date();
    try {
      return parseLocalDate(s);
    } catch {
      const d = new Date(`${s}T12:00:00`);
      return Number.isFinite(d.getTime()) ? d : new Date();
    }
  }, [data?.start_date]);

  const planningMeta = useMemo((): PmProjectMeta | null => {
    if (!data) return null;
    return {
      id: data.id,
      name: data.name,
      code: `${data.start_date} → ${data.end_date}`,
      projectStart: planningProjectStart,
    };
  }, [data, planningProjectStart]);

  const pmTasks = useMemo(() => {
    if (!data) return [];
    return taskRowsToPmTasks(tasks, planningProjectStart, (uid) => {
      if (!uid) return undefined;
      const n = workerMap.get(uid)?.trim();
      return n || undefined;
    });
  }, [data, tasks, planningProjectStart, workerMap]);

  const locationOptions = useMemo(() => {
    const set = new Set<string>();
    for (const t of tasks) {
      const v = (t.location_tag_id ?? "").trim();
      if (v) set.add(v);
    }
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [tasks]);

  const priorityRank = useCallback((p: string) => {
    // smaller = higher priority
    if (p === "critical") return 0;
    if (p === "high") return 1;
    if (p === "medium") return 2;
    if (p === "low") return 3;
    return 4;
  }, []);

  const sortTasks = useCallback(
    (a: TaskRow, b: TaskRow) => {
      const aLoc = (a.location_tag_id ?? "").trim();
      const bLoc = (b.location_tag_id ?? "").trim();
      const aTitle = a.title.trim();
      const bTitle = b.title.trim();
      const pr = priorityRank(a.priority) - priorityRank(b.priority);

      if (taskSort === "priority") {
        if (pr !== 0) return pr;
        if (aTitle !== bTitle) return aTitle.localeCompare(bTitle, undefined, { sensitivity: "base" });
        return aLoc.localeCompare(bLoc, undefined, { sensitivity: "base" });
      }

      if (taskSort === "location") {
        if (aLoc !== bLoc) return aLoc.localeCompare(bLoc, undefined, { sensitivity: "base" });
        if (pr !== 0) return pr;
        return aTitle.localeCompare(bTitle, undefined, { sensitivity: "base" });
      }

      // taskSort === "task"
      if (aTitle !== bTitle) return aTitle.localeCompare(bTitle, undefined, { sensitivity: "base" });
      if (pr !== 0) return pr;
      return aLoc.localeCompare(bLoc, undefined, { sensitivity: "base" });
    },
    [priorityRank, taskSort],
  );

  const skillNameOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of skillCategories) {
      const s = c.trim();
      if (s) set.add(s);
    }
    for (const w of workers) {
      for (const sk of w.skills ?? []) {
        const s = sk.name?.trim();
        if (s) set.add(s);
      }
    }
    for (const t of tasks) {
      for (const s of t.required_skill_names ?? []) {
        const x = s.trim();
        if (x) set.add(x);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [skillCategories, workers, tasks]);

  const activeTasks = useMemo(() => tasks.filter((t) => t.status !== "complete"), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((t) => t.status === "complete"), [tasks]);

  const filteredActiveTasks = useMemo(() => {
    const loc = locationFilter.trim().toLowerCase();
    const base = loc ? activeTasks.filter((t) => (t.location_tag_id ?? "").trim().toLowerCase() === loc) : activeTasks;
    return [...base].sort(sortTasks);
  }, [activeTasks, locationFilter, sortTasks]);

  const filteredCompletedTasks = useMemo(() => {
    const loc = locationFilter.trim().toLowerCase();
    const base = loc
      ? completedTasks.filter((t) => (t.location_tag_id ?? "").trim().toLowerCase() === loc)
      : completedTasks;
    return [...base].sort(sortTasks);
  }, [completedTasks, locationFilter, sortTasks]);

  const tasksWithSkillReqs = useMemo(
    () => activeTasks.filter((t) => (t.required_skill_names?.length ?? 0) > 0),
    [activeTasks],
  );

  const selectedMatchTask = useMemo(
    () => tasks.find((t) => t.id === matchTaskId) ?? null,
    [tasks, matchTaskId],
  );
  const matchRequired = selectedMatchTask?.required_skill_names ?? [];

  const filteredWorkers = useMemo(() => {
    if (workerFilter !== "matching") return workers;
    if (!selectedMatchTask || matchRequired.length === 0) return workers;
    return workers.filter((w) => workerMatchesRequired(w, matchRequired));
  }, [workers, workerFilter, selectedMatchTask, matchRequired]);

  async function markComplete(t: TaskRow) {
    if (t.status === "complete") return;
    if (t.is_blocked) {
      setBlockHint(`Complete is blocked until dependencies finish (${t.blocking_tasks?.length ?? 0}).`);
      return;
    }
    const prev = data;
    if (!data) return;
    setData({
      ...data,
      tasks: data.tasks.map((x) => (x.id === t.id ? { ...x, status: "complete", is_ready: false } : x)),
    });
    try {
      await patchTask(t.id, { status: "complete" });
    } catch (e: unknown) {
      setData(prev);
      const errObj = e as { status?: number; body?: { detail?: string } };
      if (errObj?.status === 400 && typeof errObj.body?.detail === "string") {
        setBlockHint(errObj.body.detail);
      } else {
        setToast("Could not complete task.");
      }
    }
  }

  const canMarkProjectComplete = Boolean(
    session?.sub &&
      data?.created_by_user_id &&
      data.created_by_user_id === session.sub &&
      data.status !== "completed",
  );

  /** Matches the "Owner:" line in the header (`owner_user_id`). */
  const isProjectOwner = Boolean(
    session?.sub && data?.owner_user_id && data.owner_user_id === session.sub,
  );

  const isTenantFullAdmin =
    Boolean(session && sessionHasAnyRole(session, "company_admin")) || Boolean(session?.facility_tenant_admin);

  const canManagePulseProject = Boolean(
    session?.sub &&
      data &&
      ((data.created_by_user_id && data.created_by_user_id === session.sub) ||
        (data.owner_user_id && data.owner_user_id === session.sub) ||
        isTenantFullAdmin),
  );

  const showCloseoutTab = Boolean(
    canUsePMFeatures &&
      data &&
      (data.status === "completed" || data.status === "archived" || Boolean(data.archived_at)),
  );

  useEffect(() => {
    if (detailTab === "closeout" && !showCloseoutTab) {
      setDetailTab("overview");
    }
  }, [detailTab, showCloseoutTab]);

  async function markProjectComplete() {
    if (!data || !session?.sub || data.created_by_user_id !== session.sub || projectCompleting) return;
    setProjectCompleting(true);
    try {
      const out = await patchProject(data.id, { status: "completed" });
      setData({
        ...data,
        ...out,
        tasks: data.tasks,
      });
      setToast("Project marked complete.");
    } catch (e) {
      const { message } = parseClientApiError(e);
      setToast(message || "Could not update project.");
    } finally {
      setProjectCompleting(false);
    }
  }

  async function removeTask(t: TaskRow) {
    if (!isProjectOwner || !data) return;
    if (!window.confirm(`Delete “${t.title}”? This cannot be undone.`)) return;
    const prev = data;
    setData({
      ...data,
      tasks: data.tasks.filter((x) => x.id !== t.id),
    });
    try {
      await deleteTask(t.id);
      setToast("Task deleted.");
    } catch {
      setData(prev);
      setToast("Could not delete task.");
    }
  }

  async function onDropOnColumn(status: TaskRow["status"], taskId: string) {
    const subject = tasks.find((x) => x.id === taskId);
    if (status === "complete" && subject?.is_blocked) {
      const n = subject.blocking_tasks?.length ?? 0;
      setBlockHint(`This task is blocked by ${n} incomplete task(s).`);
      return;
    }
    try {
      await patchTask(taskId, { status });
      await reload();
    } catch (e: unknown) {
      const errObj = e as { status?: number; body?: { detail?: string } };
      if (errObj?.status === 400 && typeof errObj.body?.detail === "string") {
        setBlockHint(errObj.body.detail);
      }
    }
  }

  const topTabClass = (active: boolean) =>
    `rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
      active
        ? "bg-ds-success text-ds-on-accent shadow-sm"
        : "text-ds-muted hover:bg-ds-interactive-hover hover:text-ds-foreground"
    }`;

  const activityTypeLabel = (t: string): string => {
    const v = (t || "").toLowerCase();
    if (v === "task") return "Task";
    if (v === "note") return "Note";
    return "Update";
  };

  const loadActivity = useCallback(async () => {
    try {
      const rows = await listProjectActivity(projectId);
      setActivityRows(rows);
      setActivityErr(null);
    } catch {
      setActivityRows([]);
      setActivityErr("Could not load activity.");
    }
  }, [projectId]);

  useEffect(() => {
    if (detailTab !== "activity") return;
    void loadActivity();
  }, [detailTab, loadActivity]);

  useEffect(() => {
    if (detailTab !== "planning") return;
    if (criticalSteps !== null) return;
    void loadCriticalSteps();
  }, [detailTab, criticalSteps, loadCriticalSteps]);

  const criticalOrdered = useMemo(() => {
    const rows = criticalSteps ?? [];
    if (rows.length === 0) return [];
    const byId = new Map(rows.map((s) => [s.id, s]));
    const incoming = new Map<string, number>();
    const nextByDepends = new Map<string, string[]>();
    for (const s of rows) {
      incoming.set(s.id, 0);
      const dep = (s.depends_on_id || "").toString().trim();
      if (dep && byId.has(dep)) {
        incoming.set(s.id, (incoming.get(s.id) || 0) + 1);
        nextByDepends.set(dep, [...(nextByDepends.get(dep) || []), s.id]);
      }
    }
    const q = rows
      .filter((s) => (incoming.get(s.id) || 0) === 0)
      .slice()
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    const out: CriticalStepRow[] = [];
    const seen = new Set<string>();
    while (q.length) {
      const cur = q.shift()!;
      if (seen.has(cur.id)) continue;
      seen.add(cur.id);
      out.push(cur);
      const nxt = (nextByDepends.get(cur.id) || [])
        .map((id) => byId.get(id))
        .filter(Boolean) as CriticalStepRow[];
      nxt.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
      for (const n of nxt) {
        incoming.set(n.id, Math.max(0, (incoming.get(n.id) || 0) - 1));
        if ((incoming.get(n.id) || 0) === 0) q.push(n);
      }
      q.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    }
    if (out.length !== rows.length) {
      // Cycle / invalid depends: fall back to linear order_index.
      return rows.slice().sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    }
    return out;
  }, [criticalSteps]);

  async function saveOverview() {
    if (!data || savingMeta) return;
    setSavingMeta(true);
    try {
      const out = await patchProject(projectId, {
        goal: overviewGoal,
        notes: overviewNotes,
        success_definition: overviewSuccess,
      });
      setData((prev) => (prev ? { ...prev, ...out, tasks: prev.tasks } : prev));
      setToast("Saved.");
    } catch (e) {
      const { message } = parseClientApiError(e);
      setToast(message || "Could not save.");
    } finally {
      setSavingMeta(false);
    }
  }

  async function saveSummary() {
    if (!data || savingMeta) return;
    setSavingMeta(true);
    try {
      const out = await patchProject(projectId, {
        summary: summaryText,
        metrics: summaryMetrics,
        lessons_learned: summaryLessons,
      });
      setData((prev) => (prev ? { ...prev, ...out, tasks: prev.tasks } : prev));
      setToast("Saved.");
    } catch (e) {
      const { message } = parseClientApiError(e);
      setToast(message || "Could not save.");
    } finally {
      setSavingMeta(false);
    }
  }

  async function submitNote() {
    const desc = newNote.trim();
    if (!data || !desc || noteSaving) return;
    setNoteSaving(true);
    try {
      const created = await addProjectNote(projectId, { description: desc });
      setNewNote("");
      setActivityRows((prev) => (prev ? [created, ...prev] : [created]));
      setToast("Note added.");
    } catch (e) {
      const { message } = parseClientApiError(e);
      setToast(message || "Could not add note.");
    } finally {
      setNoteSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={data?.name ?? "Project"}
        description={
          data
            ? (() => {
                const owner = data.owner_user_id
                  ? workers.find((w) => w.id === data.owner_user_id)
                  : undefined;
                const ownerBit = owner ? ` · Owner: ${displayName(owner)}` : "";
                const scope = data.description ? ` · ${data.description}` : "";
                return `${data.start_date} → ${data.end_date}${ownerBit}${scope}`;
              })()
            : undefined
        }
        icon={FolderKanban}
        actions={
          <>
            <Link href="/projects" className={`${SECONDARY_BTN} inline-flex items-center gap-2 no-underline`}>
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Projects
            </Link>
            {data?.health_status ? (
              <span
                className={`inline-flex items-center rounded-full px-3 py-2 text-[11px] font-bold uppercase tracking-wide ring-1 ${healthBadgeClass(
                  data.health_status,
                )}`}
                title="Derived from overdue tasks and issue activity."
              >
                {data.health_status}
              </span>
            ) : null}
            {canMarkProjectComplete ? (
              <button
                type="button"
                className={SECONDARY_BTN}
                disabled={projectCompleting}
                onClick={() => void markProjectComplete()}
              >
                {projectCompleting ? "Updating…" : "Mark complete"}
              </button>
            ) : null}
            <button
              type="button"
              className={PRIMARY_BTN}
              onClick={() => {
                setEditingTask(null);
                setTaskModalOpen(true);
              }}
            >
              <span className="inline-flex items-center gap-2">
                <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                Create task
              </span>
            </button>
          </>
        }
      />

      {err ? <p className="text-sm font-medium text-red-700 dark:text-red-400">{err}</p> : null}
      {toast ? (
        <div
          className="fixed bottom-6 left-1/2 z-50 max-w-md -translate-x-1/2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 shadow-lg dark:border-emerald-500/35 dark:bg-emerald-950/95 dark:text-emerald-100"
          role="status"
        >
          {toast}
        </div>
      ) : null}

      {!data ? (
        <p className="text-sm text-pulse-muted">Loading…</p>
      ) : (
        <>
          {blockHint ? (
            <p className="rounded-md border border-amber-200/90 bg-amber-50/90 px-4 py-2 text-sm font-medium text-amber-950 dark:border-amber-400/30 dark:bg-amber-950/50 dark:text-amber-100">
              {blockHint}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2 rounded-lg border border-ds-border bg-ds-secondary p-1 shadow-[var(--ds-shadow-card)]">
            <button type="button" className={topTabClass(detailTab === "overview")} onClick={() => setDetailTab("overview")}>
              Overview
            </button>
            {canUsePMFeatures ? (
              <button
                type="button"
                className={`inline-flex items-center gap-2 ${topTabClass(detailTab === "planning")}`}
                onClick={() => setDetailTab("planning")}
              >
                <CalendarRange className="h-4 w-4" aria-hidden />
                Planning
              </button>
            ) : null}
            <button type="button" className={topTabClass(detailTab === "work")} onClick={() => setDetailTab("work")}>
              Work
            </button>
            <button type="button" className={topTabClass(detailTab === "activity")} onClick={() => setDetailTab("activity")}>
              Activity
            </button>
            <button type="button" className={topTabClass(detailTab === "summary")} onClick={() => setDetailTab("summary")}>
              Summary
            </button>
            {showCloseoutTab ? (
              <button
                type="button"
                className={`inline-flex items-center gap-2 ${topTabClass(detailTab === "closeout")}`}
                onClick={() => setDetailTab("closeout")}
              >
                <ClipboardCheck className="h-4 w-4" aria-hidden />
                Closeout
              </button>
            ) : null}
          </div>

          {detailTab === "overview" ? (
            <div className="grid gap-6 lg:grid-cols-12">
              <div className="space-y-6 lg:col-span-8">
                <Card padding="md" className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-bold text-ds-foreground">Project notes</p>
                    <button type="button" className={SECONDARY_BTN} disabled={savingMeta} onClick={() => void saveOverview()}>
                      {savingMeta ? "Saving…" : "Save"}
                    </button>
                  </div>
                  <div>
                    <label className={LABEL} htmlFor="proj-goal">
                      Goal
                    </label>
                    <textarea
                      id="proj-goal"
                      className={FIELD}
                      rows={3}
                      value={overviewGoal}
                      onChange={(e) => setOverviewGoal(e.target.value)}
                      placeholder="What are we trying to achieve?"
                    />
                  </div>
                  <div>
                    <label className={LABEL} htmlFor="proj-success">
                      What does done look like?
                    </label>
                    <textarea
                      id="proj-success"
                      className={FIELD}
                      rows={3}
                      value={overviewSuccess}
                      onChange={(e) => setOverviewSuccess(e.target.value)}
                      placeholder="Define a clear finish line."
                    />
                  </div>
                  <div>
                    <label className={LABEL} htmlFor="proj-notes">
                      Notes
                    </label>
                    <textarea
                      id="proj-notes"
                      className={FIELD}
                      rows={6}
                      value={overviewNotes}
                      onChange={(e) => setOverviewNotes(e.target.value)}
                      placeholder="Anything worth keeping in one place."
                    />
                  </div>
                </Card>
              </div>
              <div className="lg:col-span-4">
                <Card padding="md" className="space-y-3">
                  <p className="text-sm font-bold text-ds-foreground">At a glance</p>
                  <p className="text-xs text-ds-muted">These fields are optional and won’t change how tasks work.</p>
                  <div className="space-y-2 text-sm text-ds-foreground">
                    <p>
                      <span className="font-semibold">Status:</span> {data.status.replace(/_/g, " ")}
                    </p>
                    <p>
                      <span className="font-semibold">Timeline:</span> {data.start_date} → {data.end_date}
                    </p>
                    <div>
                      <label className={LABEL} htmlFor="proj-category">
                        Category
                      </label>
                      <select
                        id="proj-category"
                        className={FIELD}
                        value={data.category_id ?? ""}
                        disabled={categoryBusy}
                        onChange={async (e) => {
                          const v = e.target.value || null;
                          setCategoryBusy(true);
                          try {
                            const out = await patchProject(projectId, { category_id: v });
                            setData((prev) => (prev ? { ...prev, ...out, tasks: prev.tasks } : prev));
                            setToast("Category updated.");
                          } catch (err2) {
                            const { message } = parseClientApiError(err2);
                            setToast(message || "Could not update category.");
                          } finally {
                            setCategoryBusy(false);
                          }
                        }}
                      >
                        <option value="">— None —</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </Card>
                <Card padding="md" className="mt-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-ds-foreground">Materials</p>
                    <button type="button" className={SECONDARY_BTN} onClick={() => void reload()}>
                      Refresh
                    </button>
                  </div>
                  {projectMaterialsErr ? (
                    <p className="text-sm font-medium text-red-700 dark:text-red-400">{projectMaterialsErr}</p>
                  ) : null}
                  {projectMaterials === null ? (
                    <p className="text-sm text-ds-muted">Loading…</p>
                  ) : projectMaterials.length === 0 ? (
                    <p className="text-sm text-ds-muted">
                      No materials yet. Add materials on a task to build the project master list.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {projectMaterials.map((m, idx) => {
                        const warn = Boolean(m.is_out_of_stock || m.is_low_stock);
                        const badge = m.is_out_of_stock ? "Out" : m.is_low_stock ? "Low" : "";
                        return (
                          <li
                            key={`${m.inventory_item_id ?? "free"}-${m.name}-${idx}`}
                            className="flex items-center justify-between gap-3 rounded-md border border-ds-border bg-white px-3 py-2 text-sm dark:bg-ds-primary"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-ds-foreground">{m.name}</p>
                              <p className="mt-0.5 text-[11px] text-ds-muted">
                                Req: {m.quantity_required_total} {m.unit ?? ""}
                                {typeof m.inventory_quantity === "number"
                                  ? ` · In stock: ${m.inventory_quantity}`
                                  : ""}
                              </p>
                            </div>
                            {warn ? (
                              <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-950 ring-1 ring-amber-200/80 dark:bg-amber-950/50 dark:text-amber-100 dark:ring-amber-500/40">
                                {badge}
                              </span>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>
                <Card padding="md" className="mt-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-ds-foreground">Equipment</p>
                    <button type="button" className={SECONDARY_BTN} onClick={() => void reload()}>
                      Refresh
                    </button>
                  </div>
                  {projectEquipmentErr ? (
                    <p className="text-sm font-medium text-red-700 dark:text-red-400">{projectEquipmentErr}</p>
                  ) : null}
                  {projectEquipment === null ? (
                    <p className="text-sm text-ds-muted">Loading…</p>
                  ) : projectEquipment.length === 0 ? (
                    <p className="text-sm text-ds-muted">
                      No equipment yet. Link equipment on a task to build the project master list.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {projectEquipment.map((e, idx) => (
                        <li
                          key={`${e.facility_equipment_id ?? "free"}-${e.name}-${idx}`}
                          className="rounded-md border border-ds-border bg-white px-3 py-2 text-sm dark:bg-ds-primary"
                        >
                          <p className="truncate font-semibold text-ds-foreground">{e.name}</p>
                          <p className="mt-0.5 text-[11px] text-ds-muted">Linked on {e.line_count} task line(s)</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            </div>
          ) : null}

          {detailTab === "planning" && canUsePMFeatures && planningMeta ? (
            <PmPlanningShell
              variant="embedded"
              embedded={{
                meta: planningMeta,
                pmTasks,
                onTaskClick: (id) => {
                  const t = tasks.find((x) => x.id === id);
                  if (t) {
                    setEditingTask(t);
                    setTaskModalOpen(true);
                  }
                },
                belowCriticalTab: (
                  <div className="space-y-6 border-t border-[var(--ds-border)] pt-8">
                    <p className="text-sm font-bold text-ds-foreground">Milestone steps</p>
                    <p className="text-xs text-[var(--pm-color-muted)]">
                      Optional high-level steps (separate from task-based CPM).
                    </p>
                    <div className="space-y-6">
                      <Card padding="md" className="space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-ds-foreground">Critical Path</p>
                            <p className="mt-1 text-xs text-ds-muted">Define key steps and visualize the flow.</p>
                          </div>
                          <button
                            type="button"
                            className={SECONDARY_BTN}
                            disabled={criticalLoading}
                            onClick={() => void loadCriticalSteps()}
                          >
                            Refresh
                          </button>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-[1fr,220px,auto]">
                          <div>
                            <label className={LABEL} htmlFor="cp-step-title">
                              Step name
                            </label>
                            <input
                              id="cp-step-title"
                              className={FIELD}
                              value={newCriticalTitle}
                              onChange={(e) => setNewCriticalTitle(e.target.value)}
                              placeholder="Step name"
                            />
                          </div>
                          <div>
                            <label className={LABEL} htmlFor="cp-step-dep">
                              Depends on (optional)
                            </label>
                            <select
                              id="cp-step-dep"
                              className={FIELD}
                              value={newCriticalDependsOn}
                              onChange={(e) => setNewCriticalDependsOn(e.target.value)}
                            >
                              <option value="">— None —</option>
                              {(criticalSteps ?? []).map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.title}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-end">
                            <button
                              type="button"
                              className={PRIMARY_BTN}
                              disabled={!newCriticalTitle.trim() || criticalLoading}
                              onClick={async () => {
                                const title = newCriticalTitle.trim();
                                if (!title) return;
                                setCriticalLoading(true);
                                setCriticalErr(null);
                                try {
                                  const orderIndex = (criticalSteps ?? []).length;
                                  const created = await createCriticalStep(projectId, {
                                    title,
                                    order_index: orderIndex,
                                    depends_on_id: newCriticalDependsOn || null,
                                  });
                                  setCriticalSteps((prev) =>
                                    ([...(prev ?? []), created]).sort((a, b) => a.order_index - b.order_index),
                                  );
                                  setNewCriticalTitle("");
                                  setNewCriticalDependsOn("");
                                } catch (e) {
                                  const { message } = parseClientApiError(e);
                                  setCriticalErr(message || "Could not add step.");
                                } finally {
                                  setCriticalLoading(false);
                                }
                              }}
                            >
                              Add Step
                            </button>
                          </div>
                        </div>

                        {criticalErr ? <p className="text-sm font-medium text-red-700 dark:text-red-400">{criticalErr}</p> : null}
                        {criticalLoading && criticalSteps === null ? <p className="text-sm text-ds-muted">Loading…</p> : null}

                        {(criticalSteps ?? []).length === 0 ? (
                          <p className="text-sm text-ds-muted">No steps yet. Add your first step above.</p>
                        ) : (
                          <ul className="space-y-2">
                            {(criticalSteps ?? [])
                              .slice()
                              .sort((a, b) => a.order_index - b.order_index)
                              .map((s, idx, arr) => (
                                <li
                                  key={s.id}
                                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-ds-border bg-white px-3 py-2 dark:bg-ds-primary"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-ds-foreground">
                                      <span className="mr-2 text-xs font-bold text-ds-muted">#{idx + 1}</span>
                                      {s.title}
                                    </p>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                      <span className="text-xs text-ds-muted">Depends on:</span>
                                      <select
                                        className="rounded-md border border-ds-border bg-ds-secondary px-2 py-1 text-xs font-semibold text-ds-foreground"
                                        value={s.depends_on_id || ""}
                                        onChange={async (e) => {
                                          const v = e.target.value || null;
                                          setCriticalSavingId(s.id);
                                          setCriticalErr(null);
                                          try {
                                            const out = await patchCriticalStep(projectId, s.id, { depends_on_id: v });
                                            setCriticalSteps((prev) => (prev ?? []).map((x) => (x.id === s.id ? out : x)));
                                          } catch (err2) {
                                            const { message } = parseClientApiError(err2);
                                            setCriticalErr(message || "Could not update dependency.");
                                          } finally {
                                            setCriticalSavingId(null);
                                          }
                                        }}
                                        disabled={criticalSavingId === s.id}
                                      >
                                        <option value="">— None —</option>
                                        {(criticalSteps ?? [])
                                          .filter((x) => x.id !== s.id)
                                          .map((x) => (
                                            <option key={x.id} value={x.id}>
                                              {x.title}
                                            </option>
                                          ))}
                                      </select>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      className="rounded-md border border-ds-border bg-ds-secondary px-2 py-1 text-xs font-semibold text-ds-foreground hover:bg-ds-interactive-hover disabled:opacity-40"
                                      disabled={idx === 0 || criticalSavingId === s.id}
                                      onClick={async () => {
                                        const prev = arr[idx - 1]!;
                                        setCriticalSavingId(s.id);
                                        setCriticalErr(null);
                                        try {
                                          const a = await patchCriticalStep(projectId, s.id, { order_index: prev.order_index });
                                          const b = await patchCriticalStep(projectId, prev.id, { order_index: s.order_index });
                                          setCriticalSteps((old) =>
                                            (old ?? [])
                                              .map((x) => (x.id === a.id ? a : x.id === b.id ? b : x))
                                              .sort((x, y) => x.order_index - y.order_index),
                                          );
                                        } catch (err3) {
                                          const { message } = parseClientApiError(err3);
                                          setCriticalErr(message || "Could not reorder steps.");
                                        } finally {
                                          setCriticalSavingId(null);
                                        }
                                      }}
                                    >
                                      Up
                                    </button>
                                    <button
                                      type="button"
                                      className="rounded-md border border-ds-border bg-ds-secondary px-2 py-1 text-xs font-semibold text-ds-foreground hover:bg-ds-interactive-hover disabled:opacity-40"
                                      disabled={idx === arr.length - 1 || criticalSavingId === s.id}
                                      onClick={async () => {
                                        const next = arr[idx + 1]!;
                                        setCriticalSavingId(s.id);
                                        setCriticalErr(null);
                                        try {
                                          const a = await patchCriticalStep(projectId, s.id, { order_index: next.order_index });
                                          const b = await patchCriticalStep(projectId, next.id, { order_index: s.order_index });
                                          setCriticalSteps((old) =>
                                            (old ?? [])
                                              .map((x) => (x.id === a.id ? a : x.id === b.id ? b : x))
                                              .sort((x, y) => x.order_index - y.order_index),
                                          );
                                        } catch (err4) {
                                          const { message } = parseClientApiError(err4);
                                          setCriticalErr(message || "Could not reorder steps.");
                                        } finally {
                                          setCriticalSavingId(null);
                                        }
                                      }}
                                    >
                                      Down
                                    </button>
                                    <button
                                      type="button"
                                      className="rounded-md border border-ds-border bg-ds-secondary px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40 dark:text-red-200 dark:hover:bg-red-950/40"
                                      disabled={criticalSavingId === s.id}
                                      onClick={async () => {
                                        setCriticalSavingId(s.id);
                                        setCriticalErr(null);
                                        try {
                                          await deleteCriticalStep(projectId, s.id);
                                          setCriticalSteps((old) => (old ?? []).filter((x) => x.id !== s.id));
                                        } catch (err5) {
                                          const { message } = parseClientApiError(err5);
                                          setCriticalErr(message || "Could not delete step.");
                                        } finally {
                                          setCriticalSavingId(null);
                                        }
                                      }}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </li>
                              ))}
                          </ul>
                        )}
                      </Card>

                      <Card padding="md" className="space-y-3">
                        <p className="text-sm font-bold text-ds-foreground">Flow</p>
                        <div className="overflow-x-auto">
                          <div className="flex min-w-max items-center gap-3 py-1">
                            {criticalOrdered.length === 0 ? (
                              <p className="text-sm text-ds-muted">Add steps to see the flow.</p>
                            ) : (
                              criticalOrdered.map((s, i) => (
                                <div key={s.id} className="flex items-center gap-3">
                                  <div className="rounded-md border border-ds-border bg-white px-3 py-2 text-sm font-semibold text-ds-foreground dark:bg-ds-secondary">
                                    {s.title}
                                  </div>
                                  {i < criticalOrdered.length - 1 ? <span className="text-ds-muted">→</span> : null}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </Card>
                    </div>
                  </div>
                ),
              }}
            />
          ) : null}

          {detailTab === "activity" ? (
            <div className="space-y-6">
              <Card padding="md" className="space-y-3">
                <p className="text-sm font-bold text-ds-foreground">Add a note</p>
                <textarea
                  className={FIELD}
                  rows={3}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add an update for this project…"
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-ds-muted">This shows up in Activity immediately.</p>
                  <button
                    type="button"
                    className={PRIMARY_BTN}
                    disabled={noteSaving || !newNote.trim()}
                    onClick={() => void submitNote()}
                  >
                    {noteSaving ? "Saving…" : "Add note"}
                  </button>
                </div>
              </Card>

              <Card padding="md" className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-ds-foreground">Activity</p>
                  <button type="button" className={SECONDARY_BTN} onClick={() => void loadActivity()}>
                    Refresh
                  </button>
                </div>
                {activityErr ? <p className="text-sm font-medium text-red-700 dark:text-red-400">{activityErr}</p> : null}
                {activityRows === null ? (
                  <p className="text-sm text-ds-muted">Loading activity…</p>
                ) : activityRows.length === 0 ? (
                  <p className="text-sm text-ds-muted">No activity yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {activityRows.map((a) => {
                      const ts = new Date(a.created_at);
                      const when = Number.isFinite(ts.getTime()) ? ts.toLocaleString() : a.created_at;
                      const label = activityTypeLabel(a.type);
                      return (
                        <li key={a.id} className="rounded-lg border border-ds-border bg-white p-4 dark:bg-ds-primary">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="inline-flex rounded-full bg-ds-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ds-foreground ring-1 ring-ds-border">
                              {label}
                            </span>
                            <span className="text-[11px] font-semibold text-ds-muted">{when}</span>
                          </div>
                          {a.title ? <p className="mt-2 text-sm font-semibold text-ds-foreground">{a.title}</p> : null}
                          <p className="mt-2 whitespace-pre-line text-sm text-ds-foreground">{a.description}</p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </div>
          ) : null}

          {detailTab === "summary" ? (
            <div className="space-y-6">
              <Card padding="md" className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-bold text-ds-foreground">Summary</p>
                  <button type="button" className={SECONDARY_BTN} disabled={savingMeta} onClick={() => void saveSummary()}>
                    {savingMeta ? "Saving…" : "Save"}
                  </button>
                </div>
                <div>
                  <label className={LABEL} htmlFor="proj-summary">
                    Summary
                  </label>
                  <textarea
                    id="proj-summary"
                    className={FIELD}
                    rows={4}
                    value={summaryText}
                    onChange={(e) => setSummaryText(e.target.value)}
                    placeholder="What happened? What’s the current state?"
                  />
                </div>
                <div>
                  <label className={LABEL} htmlFor="proj-metrics">
                    Metrics / Results
                  </label>
                  <textarea
                    id="proj-metrics"
                    className={FIELD}
                    rows={4}
                    value={summaryMetrics}
                    onChange={(e) => setSummaryMetrics(e.target.value)}
                    placeholder="Key numbers or outcomes."
                  />
                </div>
                <div>
                  <label className={LABEL} htmlFor="proj-lessons">
                    Lessons Learned
                  </label>
                  <textarea
                    id="proj-lessons"
                    className={FIELD}
                    rows={4}
                    value={summaryLessons}
                    onChange={(e) => setSummaryLessons(e.target.value)}
                    placeholder="What would we do differently next time?"
                  />
                </div>
              </Card>
            </div>
          ) : null}

          {detailTab === "closeout" && showCloseoutTab ? (
            <ProjectCloseoutTab projectId={projectId} canManageSummary={canManagePulseProject} />
          ) : null}

          {detailTab === "work" ? (
            <>
              <div className="flex max-w-2xl flex-wrap gap-2 rounded-lg border border-ds-border bg-ds-secondary p-1 shadow-[var(--ds-shadow-card)]">
                <button
                  type="button"
                  className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                    viewTab === "tasks"
                      ? "bg-ds-success text-ds-on-accent shadow-sm"
                      : "text-ds-muted hover:bg-ds-interactive-hover hover:text-ds-foreground"
                  }`}
                  onClick={() => setViewTab("tasks")}
                >
                  <List className="h-4 w-4" aria-hidden />
                  Tasks
                </button>
                <button
                  type="button"
                  className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                    viewTab === "board"
                      ? "bg-ds-success text-ds-on-accent shadow-sm"
                      : "text-ds-muted hover:bg-ds-interactive-hover hover:text-ds-foreground"
                  }`}
                  onClick={() => setViewTab("board")}
                >
                  <LayoutGrid className="h-4 w-4" aria-hidden />
                  Board
                </button>
                <button
                  type="button"
                  className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                    viewTab === "automation"
                      ? "bg-ds-success text-ds-on-accent shadow-sm"
                      : "text-ds-muted hover:bg-ds-interactive-hover hover:text-ds-foreground"
                  }`}
                  onClick={() => setViewTab("automation")}
                >
                  <Settings2 className="h-4 w-4" aria-hidden />
                  Automation
                </button>
              </div>

              {viewTab === "automation" ? <ProjectAutomationPanel projectId={projectId} /> : null}

              {viewTab === "tasks" ? (
            <div className="grid gap-6 lg:grid-cols-12">
              <div className="space-y-6 lg:col-span-7 xl:col-span-8">
                <Card padding="md" className="space-y-3">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="min-w-[14rem]">
                      <label className={LABEL} htmlFor="task-location-filter">
                        Location
                      </label>
                      <select
                        id="task-location-filter"
                        className={FIELD}
                        value={locationFilter}
                        onChange={(e) => setLocationFilter(e.target.value)}
                      >
                        <option value="">All locations</option>
                        {locationOptions.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="min-w-[14rem]">
                      <label className={LABEL} htmlFor="task-sort">
                        Sort
                      </label>
                      <select
                        id="task-sort"
                        className={FIELD}
                        value={taskSort}
                        onChange={(e) => setTaskSort(e.target.value as "priority" | "location" | "task")}
                      >
                        <option value="priority">Highest priority</option>
                        <option value="location">Location</option>
                        <option value="task">Task</option>
                      </select>
                    </div>
                  </div>
                  <p className="text-xs text-ds-muted">
                    When sorting by location or task, priority is used as the next sort key.
                  </p>
                </Card>
                <TaskSection
                  title="Active tasks"
                  empty="No active tasks. Create one to get started."
                  tasks={filteredActiveTasks}
                  onEdit={(t) => {
                    setEditingTask(t);
                    setTaskModalOpen(true);
                  }}
                  onComplete={(t) => void markComplete(t)}
                  workerMap={workerMap}
                  canDelete={isProjectOwner}
                  onDelete={(t) => void removeTask(t)}
                />
                <TaskSection
                  title="Completed tasks"
                  empty="No completed tasks yet."
                  tasks={filteredCompletedTasks}
                  onEdit={(t) => {
                    setEditingTask(t);
                    setTaskModalOpen(true);
                  }}
                  onComplete={(t) => void markComplete(t)}
                  workerMap={workerMap}
                  completedStyle
                  canDelete={isProjectOwner}
                  onDelete={(t) => void removeTask(t)}
                />
              </div>
              <div className="lg:col-span-5 xl:col-span-4">
                <Card padding="md" className="sticky top-4 space-y-4">
                  <div className="flex items-center gap-2 text-ds-foreground">
                    <Users className="h-5 w-5 text-ds-success" aria-hidden />
                    <h2 className="text-sm font-bold tracking-tight">Workforce skill match</h2>
                  </div>
                  <p className="text-xs text-ds-muted">
                    Skills come from Workers &amp; Roles profiles. Pick a task to compare required skills to the roster.
                  </p>
                  <div>
                    <label className={LABEL} htmlFor="match-task">
                      Match for task
                    </label>
                    <select
                      id="match-task"
                      className={FIELD}
                      value={matchTaskId}
                      onChange={(e) => setMatchTaskId(e.target.value)}
                    >
                      <option value="">— Select an active task —</option>
                      {tasksWithSkillReqs.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="max-w-xs">
                    <SegmentedControl
                      value={workerFilter}
                      onChange={setWorkerFilter}
                      options={[
                        { value: "all", label: "All workers" },
                        { value: "matching", label: "Matching only" },
                      ]}
                    />
                  </div>
                  {workerFilter === "matching" && (!matchTaskId || matchRequired.length === 0) ? (
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                      Choose a task that lists required skills, or switch to All workers.
                    </p>
                  ) : null}
                  <ul className="max-h-[min(50vh,22rem)] space-y-2 overflow-y-auto pr-1">
                    {filteredWorkers.map((w) => {
                      const ok =
                        matchRequired.length > 0 && matchTaskId
                          ? workerMatchesRequired(w, matchRequired)
                          : null;
                      return (
                        <li
                          key={w.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-ds-border bg-ds-secondary px-3 py-2.5 transition-colors hover:bg-ds-interactive-hover"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <ProjectWorkerMiniAvatar w={w} />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-ds-foreground">
                                {displayName(w)}
                              </p>
                              {w.skills?.length ? (
                                <p className="truncate text-[11px] text-ds-muted">
                                  {w.skills.map((s) => s.name).join(", ")}
                                </p>
                              ) : (
                                <p className="text-[11px] text-ds-muted">No skills on profile</p>
                              )}
                            </div>
                          </div>
                          {ok === true ? (
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-ds-success" aria-label="Has required skills" />
                          ) : ok === false ? (
                            <span className="shrink-0 text-[11px] font-medium text-ds-muted">—</span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              </div>
            </div>
          ) : null}

          {viewTab === "board" ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {KANBAN_COLS.map((col) => (
                <div
                  key={col.key}
                  className="flex min-h-[12rem] flex-col rounded-md border border-slate-200/90 bg-white/90 p-3 shadow-sm dark:border-ds-border dark:bg-ds-primary/90"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/task-id");
                    if (id) void onDropOnColumn(col.key, id);
                  }}
                >
                  <p className="border-b border-slate-100 pb-2 text-center text-[11px] font-bold uppercase tracking-wide text-pulse-muted dark:border-ds-border">
                    {col.label}
                  </p>
                  <div className="mt-2 flex flex-1 flex-col gap-2">
                    {tasks
                      .filter((t) => t.status === col.key)
                      .map((t) => (
                        <div
                          key={t.id}
                          draggable
                          title={
                            t.is_blocked
                              ? `Blocked by ${t.blocking_tasks?.length ?? 0} incomplete task(s)`
                              : undefined
                          }
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/task-id", t.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          className={`cursor-grab rounded-md border border-slate-200/90 bg-slate-50/90 px-3 py-2.5 text-left shadow-sm active:cursor-grabbing dark:border-ds-border dark:bg-ds-secondary/95 ${
                            t.is_blocked ? "opacity-75" : ""
                          }`}
                        >
                          <p className="text-sm font-semibold text-pulse-navy dark:text-slate-100">{t.title}</p>
                          <span
                            className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ring-1 ${priorityBadgeClass(
                              t.priority,
                            )}`}
                          >
                            {t.priority}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
            </>
          ) : null}
        </>
      )}

      <ProjectTaskModal
        open={taskModalOpen}
        onClose={() => {
          setTaskModalOpen(false);
          setEditingTask(null);
        }}
        projectId={projectId}
        peerTasks={tasks}
        workers={workers}
        skillOptions={skillNameOptions}
        task={editingTask}
        canUsePMFeatures={canUsePMFeatures}
        onSaved={async () => {
          await reload();
          setToast(editingTask ? "Task updated." : "Task created.");
        }}
      />
    </div>
  );
}

const TASK_DELETE_ICON_BTN =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-slate-200/90 text-pulse-muted shadow-sm transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:border-ds-border dark:text-ds-muted dark:hover:border-red-500/40 dark:hover:bg-red-950/50 dark:hover:text-red-300";

function TaskSection({
  title,
  empty,
  tasks,
  onEdit,
  onComplete,
  workerMap,
  completedStyle,
  canDelete,
  onDelete,
}: {
  title: string;
  empty: string;
  tasks: TaskRow[];
  onEdit: (t: TaskRow) => void;
  onComplete: (t: TaskRow) => void;
  workerMap: Map<string, string>;
  completedStyle?: boolean;
  canDelete?: boolean;
  onDelete?: (t: TaskRow) => void;
}) {
  return (
    <section>
      <h2 className="text-sm font-bold uppercase tracking-wide text-pulse-muted">{title}</h2>
      {tasks.length === 0 ? (
        <Card
          padding="md"
          className="mt-3 border-dashed border-slate-200/90 dark:border-ds-border"
        >
          <p className="text-sm text-pulse-muted">{empty}</p>
        </Card>
      ) : (
        <div className="mt-3 space-y-3">
          {tasks.map((t) => (
            <Card
              key={t.id}
              padding="md"
              interactive
              role="group"
              tabIndex={0}
              aria-label={`Task: ${t.title}. Press Enter to edit.`}
              className={completedStyle ? "opacity-90" : ""}
              onClick={() => onEdit(t)}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onEdit(t);
                }
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2 text-left text-base font-semibold text-pulse-navy dark:text-slate-100">
                    {t.location_tag_id?.trim() ? (
                      <span className="shrink-0 rounded-full bg-ds-success/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ds-success ring-1 ring-inset ring-ds-success/25 dark:bg-ds-success/12 dark:ring-ds-success/35">
                        {t.location_tag_id.trim()}
                      </span>
                    ) : null}
                    <span className="min-w-0 truncate">{t.title}</span>
                  </div>
                  {t.description ? (
                    <p className="mt-1 line-clamp-2 text-xs text-pulse-muted">{t.description}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${priorityBadgeClass(
                        t.priority,
                      )}`}
                    >
                      {t.priority}
                    </span>
                    {t.start_date ? (
                      <span className="text-[11px] tabular-nums text-pulse-muted">Start {t.start_date}</span>
                    ) : null}
                    {typeof t.estimated_completion_minutes === "number" && t.estimated_completion_minutes > 0 ? (
                      <span className="text-[11px] tabular-nums text-pulse-muted">
                        Est {Math.round(t.estimated_completion_minutes / 60)}h
                      </span>
                    ) : null}
                    {completedStyle && t.end_date ? (
                      <span className="text-[11px] tabular-nums text-pulse-muted">End {t.end_date}</span>
                    ) : null}
                    {t.is_blocked ? (
                      <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-950 ring-1 ring-amber-200/80 dark:bg-amber-950/50 dark:text-amber-100 dark:ring-amber-500/40">
                        Blocked
                      </span>
                    ) : null}
                  </div>
                  {(t.required_skill_names?.length ?? 0) > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(t.required_skill_names ?? []).map((s) => (
                        <span
                          key={s}
                          className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-pulse-navy dark:bg-ds-secondary dark:text-slate-200"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {t.assigned_user_id ? (
                    <p className="mt-2 text-xs text-pulse-muted">
                      Assignee: {workerMap.get(t.assigned_user_id) ?? t.assigned_user_id}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  {canDelete && onDelete ? (
                    <button
                      type="button"
                      className={TASK_DELETE_ICON_BTN}
                      aria-label={`Delete task: ${t.title}`}
                      title="Delete task"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(t);
                      }}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  ) : null}
                  {!completedStyle && t.status !== "complete" ? (
                    <button
                      type="button"
                      className={SECONDARY_BTN}
                      onClick={(e) => {
                        e.stopPropagation();
                        onComplete(t);
                      }}
                    >
                      Mark complete
                    </button>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function ProjectTaskModal({
  open,
  onClose,
  projectId,
  peerTasks,
  workers,
  skillOptions,
  task,
  canUsePMFeatures,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  peerTasks: TaskRow[];
  workers: PulseWorkerApi[];
  skillOptions: string[];
  task: TaskRow | null;
  canUsePMFeatures: boolean;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState("");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("todo");
  const [startDate, setStartDate] = useState("");
  const [estMinutes, setEstMinutes] = useState<string>("");
  const [locTag, setLocTag] = useState("");
  const [sopRef, setSopRef] = useState("");
  const [depSelected, setDepSelected] = useState<string[]>([]);
  const [skillsSel, setSkillsSel] = useState<string[]>([]);
  const [estimatedDuration, setEstimatedDuration] = useState("");
  const [skillType, setSkillType] = useState("");
  const [materialNotes, setMaterialNotes] = useState("");
  const [phaseGroup, setPhaseGroup] = useState("");
  const [plannedStartAt, setPlannedStartAt] = useState("");
  const [plannedEndAt, setPlannedEndAt] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [materials, setMaterials] = useState<TaskMaterialRow[] | null>(null);
  const [materialsErr, setMaterialsErr] = useState<string | null>(null);
  const [matQuery, setMatQuery] = useState("");
  const [matQty, setMatQty] = useState<string>("1");
  const [matNotes, setMatNotes] = useState("");
  const [matSuggestions, setMatSuggestions] = useState<InventoryRow[]>([]);
  const [matBusy, setMatBusy] = useState(false);
  const [lineKind, setLineKind] = useState<"material" | "equipment">("material");
  const [equipmentRows, setEquipmentRows] = useState<TaskEquipmentRow[] | null>(null);
  const [equipmentErr, setEquipmentErr] = useState<string | null>(null);
  const [eqQuery, setEqQuery] = useState("");
  const [eqSuggestions, setEqSuggestions] = useState<FacilityEquipmentListRow[]>([]);

  const selectablePeers = peerTasks.filter((t) => !task || t.id !== task.id);

  useEffect(() => {
    if (!open) return;
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setAssignee(task.assigned_user_id ?? "");
      setPriority(task.priority);
      setStatus(task.status);
      setStartDate(task.start_date ?? "");
      setEstMinutes(
        typeof task.estimated_completion_minutes === "number" ? String(task.estimated_completion_minutes) : "",
      );
      setLocTag(task.location_tag_id ?? "");
      setSopRef(task.sop_id ?? "");
      setDepSelected([...(task.depends_on_task_ids ?? [])]);
      setSkillsSel([...(task.required_skill_names ?? [])]);
      setEstimatedDuration(task.estimated_duration ?? "");
      setSkillType(task.skill_type ?? "");
      setMaterialNotes(task.material_notes ?? "");
      setPhaseGroup(task.phase_group ?? "");
      setPlannedStartAt(task.planned_start_at ?? "");
      setPlannedEndAt(task.planned_end_at ?? "");
      setShowAdvanced(
        Boolean(
          task.sop_id ||
            (task.depends_on_task_ids?.length ?? 0) > 0 ||
            task.estimated_duration ||
            task.skill_type ||
            task.material_notes ||
            task.phase_group ||
            task.planned_start_at ||
            task.planned_end_at,
        ),
      );
    } else {
      setTitle("");
      setDescription("");
      setAssignee("");
      setPriority("medium");
      setStatus("todo");
      setStartDate("");
      setEstMinutes("");
      setLocTag("");
      setSopRef("");
      setDepSelected([]);
      setSkillsSel([]);
      setEstimatedDuration("");
      setSkillType("");
      setMaterialNotes("");
      setPhaseGroup("");
      setPlannedStartAt("");
      setPlannedEndAt("");
      setShowAdvanced(false);
    }
    setMaterials(null);
    setMaterialsErr(null);
    setMatQuery("");
    setMatQty("1");
    setMatNotes("");
    setMatSuggestions([]);
    setLineKind("material");
    setEquipmentRows(null);
    setEquipmentErr(null);
    setEqQuery("");
    setEqSuggestions([]);
  }, [open, task]);

  useEffect(() => {
    if (!open) return;
    if (!task?.id) {
      setMaterials([]);
      setEquipmentRows([]);
      return;
    }
    (async () => {
      try {
        const rows = await listTaskMaterials(task.id);
        setMaterials(rows);
        setMaterialsErr(null);
      } catch {
        setMaterials([]);
        setMaterialsErr("Could not load materials.");
      }
      try {
        const er = await listTaskEquipment(task.id);
        setEquipmentRows(er);
        setEquipmentErr(null);
      } catch {
        setEquipmentRows([]);
        setEquipmentErr("Could not load equipment.");
      }
    })();
  }, [open, task?.id]);

  useEffect(() => {
    const q = matQuery.trim();
    if (!open || lineKind !== "material" || q.length < 2) {
      setMatSuggestions([]);
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetchInventoryList({ companyId: null, q, limit: 8, offset: 0 });
          setMatSuggestions(res.items ?? []);
        } catch {
          setMatSuggestions([]);
        }
      })();
    }, 180);
    return () => window.clearTimeout(t);
  }, [open, lineKind, matQuery]);

  useEffect(() => {
    const q = eqQuery.trim();
    if (!open || lineKind !== "equipment" || q.length < 2) {
      setEqSuggestions([]);
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetchEquipmentSuggestions(q, 12);
          setEqSuggestions(res ?? []);
        } catch {
          setEqSuggestions([]);
        }
      })();
    }, 180);
    return () => window.clearTimeout(t);
  }, [open, lineKind, eqQuery]);

  const depBlockedLive = depSelected.some((id) => {
    const p = peerTasks.find((x) => x.id === id);
    return Boolean(p && p.status !== "complete");
  });

  function toggleSkill(name: string) {
    setSkillsSel((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]));
  }

  async function save() {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      if (task) {
        await patchTask(task.id, {
          title: title.trim(),
          description: description.trim() || null,
          assigned_user_id: assignee || null,
          priority,
          status,
          start_date: startDate || null,
          estimated_completion_minutes: estMinutes.trim() ? Number(estMinutes.trim()) : null,
          estimated_duration: estimatedDuration.trim() || null,
          skill_type: skillType.trim() || null,
          material_notes: materialNotes.trim() || null,
          phase_group: phaseGroup.trim() || null,
          planned_start_at: plannedStartAt || null,
          planned_end_at: plannedEndAt || null,
          location_tag_id: locTag.trim() || null,
          sop_id: sopRef.trim() || null,
          required_skill_names: skillsSel,
        });
        await syncTaskDependencies(task.id, depSelected);
      } else {
        const created = await createTask({
          project_id: projectId,
          title: title.trim(),
          description: description.trim() || null,
          assigned_user_id: assignee || null,
          priority,
          status,
          start_date: startDate || null,
          estimated_completion_minutes: estMinutes.trim() ? Number(estMinutes.trim()) : null,
          estimated_duration: estimatedDuration.trim() || null,
          skill_type: skillType.trim() || null,
          material_notes: materialNotes.trim() || null,
          phase_group: phaseGroup.trim() || null,
          planned_start_at: plannedStartAt || null,
          planned_end_at: plannedEndAt || null,
          location_tag_id: locTag.trim() || null,
          sop_id: sopRef.trim() || null,
          required_skill_names: skillsSel,
        });
        await syncTaskDependencies(created.id, depSelected);
      }
      await onSaved();
      onClose();
    } catch {
      /* keep modal open */
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="ds-modal-backdrop fixed inset-0 z-[140] flex items-center justify-center p-4 backdrop-blur-[2px]">
      <div
        className="max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200/90 bg-white p-6 shadow-2xl dark:border-ds-border dark:bg-ds-primary"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-modal-title"
      >
        <h2 id="task-modal-title" className="text-lg font-bold text-pulse-navy dark:text-slate-100">
          {task ? "Edit task" : "Create task"}
        </h2>
        <div className="mt-5 space-y-4">
          <div>
            <label className={LABEL} htmlFor="tm-title">
              Task name
            </label>
            <input id="tm-title" className={FIELD} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div>
            <label className={LABEL} htmlFor="tm-desc">
              Description (optional)
            </label>
            <textarea
              id="tm-desc"
              rows={3}
              className={FIELD}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="tm-priority">
                Priority
              </label>
              <select id="tm-priority" className={FIELD} value={priority} onChange={(e) => setPriority(e.target.value)}>
                {(["low", "medium", "high", "critical"] as const).map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="tm-start">
                Start date
              </label>
              <input
                id="tm-start"
                type="date"
                className={FIELD}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className={LABEL} htmlFor="tm-est-min">
              Estimated completion (minutes)
            </label>
            <input
              id="tm-est-min"
              inputMode="numeric"
              className={FIELD}
              value={estMinutes}
              onChange={(e) => setEstMinutes(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="e.g. 240"
            />
            <p className="mt-1 text-[11px] text-ds-muted">
              End date is filled automatically when the task is marked complete.
            </p>
          </div>
          <div>
            <label className={LABEL} htmlFor="tm-loc">
              Location
            </label>
            <input
              id="tm-loc"
              className={FIELD}
              value={locTag}
              onChange={(e) => setLocTag(e.target.value)}
              placeholder="e.g. Pool deck, Mechanical room, Lobby"
            />
          </div>
          <div>
            <label className={LABEL}>
              Required skills
            </label>
            <p className="mb-2 text-[11px] text-pulse-muted">Multi-select from roster and company categories.</p>
            <div className="max-h-36 overflow-y-auto rounded-[10px] border border-slate-200/90 p-2 dark:border-ds-border">
              {skillOptions.length === 0 ? (
                <p className="px-1 text-xs text-pulse-muted">Add skills in Workers &amp; Roles to populate this list.</p>
              ) : (
                <ul className="grid gap-1 sm:grid-cols-2">
                  {skillOptions.map((s) => {
                    const on = skillsSel.includes(s);
                    return (
                      <li key={s}>
                        <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-ds-interactive-hover dark:hover:bg-ds-interactive-hover">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                            checked={on}
                            onChange={() => toggleSkill(s)}
                          />
                          <span className="text-pulse-navy dark:text-slate-200">{s}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
          <div>
            <label className={LABEL} htmlFor="tm-assign">
              Assigned user (optional)
            </label>
            <select id="tm-assign" className={FIELD} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">—</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {displayName(w)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 rounded-xl border border-ds-border bg-ds-secondary/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-ds-foreground">Materials &amp; equipment</p>
              {task ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-pulse-accent hover:underline"
                  onClick={async () => {
                    if (!task?.id) return;
                    try {
                      const [rows, er] = await Promise.all([listTaskMaterials(task.id), listTaskEquipment(task.id)]);
                      setMaterials(rows);
                      setEquipmentRows(er);
                      setMaterialsErr(null);
                      setEquipmentErr(null);
                    } catch {
                      setMaterialsErr("Could not refresh lines.");
                      setEquipmentErr("Could not refresh lines.");
                    }
                  }}
                >
                  Refresh
                </button>
              ) : (
                <span className="text-[11px] text-ds-muted">Save the task first, then add lines.</span>
              )}
            </div>
            {(materialsErr || equipmentErr) ? (
              <p className="text-sm font-medium text-red-700 dark:text-red-400">{materialsErr || equipmentErr}</p>
            ) : null}
            {!task ? (
              <p className="text-xs text-ds-muted">Create the task first, then add materials or equipment.</p>
            ) : (
              <>
                <div>
                  <label className={LABEL} htmlFor="tm-line-kind">
                    Line type
                  </label>
                  <select
                    id="tm-line-kind"
                    className={FIELD}
                    value={lineKind}
                    onChange={(e) => {
                      const v = e.target.value as "material" | "equipment";
                      setLineKind(v);
                      setMatSuggestions([]);
                      setEqSuggestions([]);
                    }}
                  >
                    <option value="material">Material</option>
                    <option value="equipment">Equipment</option>
                  </select>
                </div>
                {lineKind === "material" ? (
                  <div className="grid gap-2 sm:grid-cols-[1fr,110px]">
                    <div className="relative">
                      <label className={LABEL} htmlFor="tm-mat-q">
                        Search inventory
                      </label>
                      <input
                        id="tm-mat-q"
                        className={FIELD}
                        value={matQuery}
                        onChange={(e) => setMatQuery(e.target.value)}
                        placeholder="Start typing…"
                      />
                      {matSuggestions.length ? (
                        <div className="absolute z-30 mt-2 w-full rounded-xl border border-ds-border bg-white p-2 shadow-xl dark:bg-ds-primary">
                          <ul className="max-h-48 overflow-y-auto">
                            {matSuggestions.map((it) => {
                              const oos = (it.quantity ?? 0) <= 0;
                              const low = !oos && (it.quantity ?? 0) <= (it.low_stock_threshold ?? 0);
                              return (
                                <li key={it.id}>
                                  <button
                                    type="button"
                                    className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-ds-interactive-hover"
                                    onClick={() => {
                                      setMatQuery(it.name);
                                      setMatSuggestions([]);
                                    }}
                                  >
                                    <span className="min-w-0 truncate font-semibold text-ds-foreground">{it.name}</span>
                                    {oos || low ? (
                                      <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-950 ring-1 ring-amber-200/80 dark:bg-amber-950/50 dark:text-amber-100 dark:ring-amber-500/40">
                                        {oos ? "Out" : "Low"}
                                      </span>
                                    ) : (
                                      <span className="shrink-0 text-[11px] font-semibold text-ds-muted">
                                        {it.quantity} {it.unit}
                                      </span>
                                    )}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                    <div>
                      <label className={LABEL} htmlFor="tm-mat-qty">
                        Qty
                      </label>
                      <input
                        id="tm-mat-qty"
                        inputMode="decimal"
                        className={FIELD}
                        value={matQty}
                        onChange={(e) => setMatQty(e.target.value.replace(/[^\d.]/g, ""))}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <label className={LABEL} htmlFor="tm-eq-q">
                      Search equipment registry
                    </label>
                    <input
                      id="tm-eq-q"
                      className={FIELD}
                      value={eqQuery}
                      onChange={(e) => setEqQuery(e.target.value)}
                      placeholder="Start typing…"
                    />
                    {eqSuggestions.length ? (
                      <div className="absolute z-30 mt-2 w-full rounded-xl border border-ds-border bg-white p-2 shadow-xl dark:bg-ds-primary">
                        <ul className="max-h-48 overflow-y-auto">
                          {eqSuggestions.map((it) => (
                            <li key={it.id}>
                              <button
                                type="button"
                                className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-ds-interactive-hover"
                                onClick={() => {
                                  setEqQuery(it.name);
                                  setEqSuggestions([]);
                                }}
                              >
                                <span className="min-w-0 truncate font-semibold text-ds-foreground">{it.name}</span>
                                <span className="shrink-0 text-[11px] font-semibold text-ds-muted">
                                  {it.type} · {it.status}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                )}
                <div>
                  <label className={LABEL} htmlFor="tm-mat-notes">
                    Notes (optional)
                  </label>
                  <input
                    id="tm-mat-notes"
                    className={FIELD}
                    value={matNotes}
                    onChange={(e) => setMatNotes(e.target.value)}
                    placeholder="Optional notes"
                  />
                </div>
                <button
                  type="button"
                  className={SECONDARY_BTN}
                  disabled={
                    matBusy ||
                    (lineKind === "material" && (!matQuery.trim() || !(Number(matQty) > 0))) ||
                    (lineKind === "equipment" && !eqQuery.trim())
                  }
                  onClick={async () => {
                    if (!task?.id) return;
                    setMatBusy(true);
                    try {
                      if (lineKind === "material") {
                        const q = matQuery.trim();
                        const match =
                          matSuggestions.find((x) => x.name.trim().toLowerCase() === q.toLowerCase()) ?? null;
                        await addTaskMaterial(task.id, {
                          inventory_item_id: match?.id ?? null,
                          name: q,
                          quantity_required: Number(matQty),
                          unit: match?.unit ?? null,
                          notes: matNotes.trim() || null,
                        });
                        const rows = await listTaskMaterials(task.id);
                        setMaterials(rows);
                        setMatQuery("");
                        setMatQty("1");
                        setMatNotes("");
                        setMaterialsErr(null);
                      } else {
                        const q = eqQuery.trim();
                        const match =
                          eqSuggestions.find((x) => x.name.trim().toLowerCase() === q.toLowerCase()) ?? null;
                        await addTaskEquipment(task.id, {
                          facility_equipment_id: match?.id ?? null,
                          name: q,
                          notes: matNotes.trim() || null,
                        });
                        const er = await listTaskEquipment(task.id);
                        setEquipmentRows(er);
                        setEqQuery("");
                        setMatNotes("");
                        setEquipmentErr(null);
                      }
                    } catch {
                      if (lineKind === "material") {
                        setMaterialsErr("Could not add material.");
                      } else {
                        setEquipmentErr("Could not add equipment.");
                      }
                    } finally {
                      setMatBusy(false);
                    }
                  }}
                >
                  {lineKind === "material" ? "Add material" : "Add equipment"}
                </button>

                <div className="border-t border-ds-border pt-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">Materials on this task</p>
                  {materials === null ? (
                    <p className="mt-2 text-sm text-ds-muted">Loading…</p>
                  ) : materials.length === 0 ? (
                    <p className="mt-2 text-sm text-ds-muted">None yet.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {materials.map((m) => (
                        <li
                          key={m.id}
                          className="flex items-center justify-between gap-3 rounded-md border border-ds-border bg-white px-3 py-2 text-sm dark:bg-ds-primary"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-ds-foreground">{m.name}</p>
                            <p className="mt-0.5 text-[11px] text-ds-muted">
                              {m.quantity_required} {m.unit ?? ""}
                              {m.is_out_of_stock ? " · Out of stock" : m.is_low_stock ? " · Low stock" : ""}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="text-xs font-semibold text-red-700 hover:underline dark:text-red-300"
                            onClick={async () => {
                              if (!task?.id) return;
                              setMatBusy(true);
                              try {
                                await deleteTaskMaterial(task.id, m.id);
                                const rows = await listTaskMaterials(task.id);
                                setMaterials(rows);
                              } finally {
                                setMatBusy(false);
                              }
                            }}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="border-t border-ds-border pt-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">Equipment on this task</p>
                  {equipmentRows === null ? (
                    <p className="mt-2 text-sm text-ds-muted">Loading…</p>
                  ) : equipmentRows.length === 0 ? (
                    <p className="mt-2 text-sm text-ds-muted">None yet.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {equipmentRows.map((ex) => (
                        <li
                          key={ex.id}
                          className="flex items-center justify-between gap-3 rounded-md border border-ds-border bg-white px-3 py-2 text-sm dark:bg-ds-primary"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-ds-foreground">{ex.name}</p>
                            <p className="mt-0.5 text-[11px] text-ds-muted">
                              {ex.equipment_type ? `${ex.equipment_type}` : "Custom"}
                              {ex.equipment_status ? ` · ${ex.equipment_status}` : ""}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="text-xs font-semibold text-red-700 hover:underline dark:text-red-300"
                            onClick={async () => {
                              if (!task?.id) return;
                              setMatBusy(true);
                              try {
                                await deleteTaskEquipment(task.id, ex.id);
                                const er = await listTaskEquipment(task.id);
                                setEquipmentRows(er);
                              } finally {
                                setMatBusy(false);
                              }
                            }}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
          {task ? (
            <div>
              <label className={LABEL} htmlFor="tm-status">
                Status
              </label>
              <select id="tm-status" className={FIELD} value={status} onChange={(e) => setStatus(e.target.value)}>
                {(["todo", "in_progress", "blocked", "complete"] as const).map((p) => (
                  <option key={p} value={p} disabled={p === "complete" && depBlockedLive}>
                    {p.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {canUsePMFeatures ? (
            <button
              type="button"
              className="text-xs font-semibold text-pulse-accent hover:underline"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? "Hide advanced" : "Advanced: planning"}
            </button>
          ) : null}
          {showAdvanced && canUsePMFeatures ? (
            <div className="space-y-4 border-t border-slate-100 pt-4 dark:border-ds-border">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL} htmlFor="tm-duration">
                    Estimated duration
                  </label>
                  <input
                    id="tm-duration"
                    className={FIELD}
                    value={estimatedDuration}
                    onChange={(e) => setEstimatedDuration(e.target.value)}
                    placeholder="e.g. half day"
                  />
                </div>
                <div>
                  <label className={LABEL} htmlFor="tm-skill-type">
                    Skill type
                  </label>
                  <input
                    id="tm-skill-type"
                    className={FIELD}
                    value={skillType}
                    onChange={(e) => setSkillType(e.target.value)}
                    placeholder="Optional label"
                  />
                </div>
              </div>
              <div>
                <label className={LABEL} htmlFor="tm-phase">
                  Phase group
                </label>
                <input
                  id="tm-phase"
                  className={FIELD}
                  value={phaseGroup}
                  onChange={(e) => setPhaseGroup(e.target.value)}
                  placeholder="e.g. Prep, Repair, Wrap-up"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL} htmlFor="tm-plan-start">
                    Planned start
                  </label>
                  <input
                    id="tm-plan-start"
                    type="datetime-local"
                    className={FIELD}
                    value={plannedStartAt ? plannedStartAt.slice(0, 16) : ""}
                    onChange={(e) => setPlannedStartAt(e.target.value ? new Date(e.target.value).toISOString() : "")}
                  />
                </div>
                <div>
                  <label className={LABEL} htmlFor="tm-plan-end">
                    Planned end
                  </label>
                  <input
                    id="tm-plan-end"
                    type="datetime-local"
                    className={FIELD}
                    value={plannedEndAt ? plannedEndAt.slice(0, 16) : ""}
                    onChange={(e) => setPlannedEndAt(e.target.value ? new Date(e.target.value).toISOString() : "")}
                  />
                </div>
              </div>
              <div>
                <label className={LABEL} htmlFor="tm-materials">
                  Material notes
                </label>
                <textarea
                  id="tm-materials"
                  rows={3}
                  className={FIELD}
                  value={materialNotes}
                  onChange={(e) => setMaterialNotes(e.target.value)}
                  placeholder="Optional materials/tools notes"
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="tm-sop">
                  SOP id
                </label>
                <input id="tm-sop" className={FIELD} value={sopRef} onChange={(e) => setSopRef(e.target.value)} />
              </div>
              <div>
                <label className={LABEL} htmlFor="tm-deps">
                  Depends on (multi-select)
                </label>
                <select
                  id="tm-deps"
                  multiple
                  className={`${FIELD} min-h-[6rem]`}
                  value={depSelected}
                  onChange={(e) => setDepSelected(Array.from(e.target.selectedOptions, (o) => o.value))}
                >
                  {selectablePeers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-ds-border">
          {task ? (
            <button
              type="button"
              className="text-sm font-semibold text-red-700 hover:text-red-800 dark:text-red-400"
              onClick={async () => {
                setBusy(true);
                try {
                  await deleteTask(task.id);
                  await onSaved();
                  onClose();
                } finally {
                  setBusy(false);
                }
              }}
            >
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap gap-3">
            <button type="button" className="text-sm font-semibold text-pulse-muted hover:text-pulse-navy dark:hover:text-slate-200" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className={PRIMARY_BTN} disabled={busy} onClick={() => void save()}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
