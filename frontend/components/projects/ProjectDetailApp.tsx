"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  FolderKanban,
  LayoutGrid,
  List,
  Plus,
  Settings2,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/pulse/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/schedule/SegmentedControl";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { apiFetch } from "@/lib/api";
import { emitOnboardingMaybeUpdated } from "@/lib/onboarding-events";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { ProjectAutomationPanel } from "@/components/projects/ProjectAutomationPanel";
import {
  createTask,
  deleteTask,
  getProject,
  patchProject,
  patchTask,
  syncTaskDependencies,
  type ProjectDetail,
  type TaskRow,
} from "@/lib/projectsService";
import type { PulseWorkerApi } from "@/lib/schedule/pulse-bridge";
import { useResolvedAvatarSrc } from "@/lib/useResolvedAvatarSrc";

const PRIMARY_BTN =
  "rounded-[10px] bg-[#2B4C7E] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#234066] disabled:opacity-50";
const SECONDARY_BTN =
  "rounded-[10px] border border-slate-200/90 bg-white px-4 py-2 text-sm font-semibold text-pulse-navy shadow-sm transition-colors hover:bg-slate-50 dark:border-ds-border dark:bg-ds-secondary dark:text-slate-100 dark:hover:bg-ds-interactive-hover";
const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-ds-border bg-ds-secondary px-3 py-2.5 text-sm text-ds-foreground shadow-sm focus:border-[color-mix(in_srgb,var(--ds-success)_45%,var(--ds-border))] focus:outline-none focus:ring-1 focus:ring-[color-mix(in_srgb,var(--ds-success)_28%,transparent)]";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-ds-muted";

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
  const [data, setData] = useState<ProjectDetail | null>(null);
  const [workers, setWorkers] = useState<PulseWorkerApi[]>([]);
  const [skillCategories, setSkillCategories] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [blockHint, setBlockHint] = useState<string | null>(null);
  const [viewTab, setViewTab] = useState<"tasks" | "board" | "automation">("tasks");
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [projectCompleting, setProjectCompleting] = useState(false);

  const [matchTaskId, setMatchTaskId] = useState<string>("");
  const [workerFilter, setWorkerFilter] = useState<"all" | "matching">("all");

  const reload = useCallback(async () => {
    try {
      const p = await getProject(projectId);
      setData(p);
      setErr(null);
    } catch {
      setErr("Could not load project.");
    }
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    (async () => {
      try {
        const w = await apiFetch<PulseWorkerApi[]>("/api/v1/pulse/workers");
        setWorkers(w);
      } catch {
        setWorkers([]);
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
      emitOnboardingMaybeUpdated();
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
                <TaskSection
                  title="Active tasks"
                  empty="No active tasks. Create one to get started."
                  tasks={activeTasks}
                  onEdit={(t) => {
                    setEditingTask(t);
                    setTaskModalOpen(true);
                  }}
                  onComplete={(t) => void markComplete(t)}
                  workerMap={workerMap}
                />
                <TaskSection
                  title="Completed tasks"
                  empty="No completed tasks yet."
                  tasks={completedTasks}
                  onEdit={(t) => {
                    setEditingTask(t);
                    setTaskModalOpen(true);
                  }}
                  onComplete={() => {}}
                  workerMap={workerMap}
                  completedStyle
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
        onSaved={async () => {
          await reload();
          setToast(editingTask ? "Task updated." : "Task created.");
        }}
      />
    </div>
  );
}

function TaskSection({
  title,
  empty,
  tasks,
  onEdit,
  onComplete,
  workerMap,
  completedStyle,
}: {
  title: string;
  empty: string;
  tasks: TaskRow[];
  onEdit: (t: TaskRow) => void;
  onComplete: (t: TaskRow) => void;
  workerMap: Map<string, string>;
  completedStyle?: boolean;
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
              className={completedStyle ? "opacity-90" : ""}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    className="text-left text-base font-semibold text-pulse-navy hover:text-pulse-accent dark:text-slate-100"
                    onClick={() => onEdit(t)}
                  >
                    {t.title}
                  </button>
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
                    {t.due_date ? (
                      <span className="text-[11px] tabular-nums text-pulse-muted">Due {t.due_date}</span>
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
                {!completedStyle && t.status !== "complete" ? (
                  <button type="button" className={SECONDARY_BTN} onClick={() => onComplete(t)}>
                    Mark complete
                  </button>
                ) : null}
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
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  peerTasks: TaskRow[];
  workers: PulseWorkerApi[];
  skillOptions: string[];
  task: TaskRow | null;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState("");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("todo");
  const [due, setDue] = useState("");
  const [locTag, setLocTag] = useState("");
  const [sopRef, setSopRef] = useState("");
  const [depSelected, setDepSelected] = useState<string[]>([]);
  const [skillsSel, setSkillsSel] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);

  const selectablePeers = peerTasks.filter((t) => !task || t.id !== task.id);

  useEffect(() => {
    if (!open) return;
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setAssignee(task.assigned_user_id ?? "");
      setPriority(task.priority);
      setStatus(task.status);
      setDue(task.due_date ?? "");
      setLocTag(task.location_tag_id ?? "");
      setSopRef(task.sop_id ?? "");
      setDepSelected([...(task.depends_on_task_ids ?? [])]);
      setSkillsSel([...(task.required_skill_names ?? [])]);
      setShowAdvanced(Boolean(task.location_tag_id || task.sop_id || (task.depends_on_task_ids?.length ?? 0) > 0));
    } else {
      setTitle("");
      setDescription("");
      setAssignee("");
      setPriority("medium");
      setStatus("todo");
      setDue("");
      setLocTag("");
      setSopRef("");
      setDepSelected([]);
      setSkillsSel([]);
      setShowAdvanced(false);
    }
  }, [open, task]);

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
          due_date: due || null,
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
          due_date: due || null,
          location_tag_id: locTag.trim() || null,
          sop_id: sopRef.trim() || null,
          required_skill_names: skillsSel,
        });
        await syncTaskDependencies(created.id, depSelected);
        emitOnboardingMaybeUpdated();
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
    <div className="ds-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-[2px]">
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
              <label className={LABEL} htmlFor="tm-due">
                Due date
              </label>
              <input id="tm-due" type="date" className={FIELD} value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
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
                        <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-ds-interactive-hover">
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
          <button
            type="button"
            className="text-xs font-semibold text-pulse-accent hover:underline"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced ? "Hide advanced" : "Advanced: location, SOP, dependencies"}
          </button>
          {showAdvanced ? (
            <div className="space-y-4 border-t border-slate-100 pt-4 dark:border-ds-border">
              <div>
                <label className={LABEL} htmlFor="tm-loc">
                  Location tag
                </label>
                <input id="tm-loc" className={FIELD} value={locTag} onChange={(e) => setLocTag(e.target.value)} />
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
