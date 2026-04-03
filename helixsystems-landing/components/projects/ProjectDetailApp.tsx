"use client";

import Link from "next/link";
import { ArrowLeft, FolderKanban, GripVertical, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PulseDrawer } from "@/components/schedule/PulseDrawer";
import { SegmentedControl } from "@/components/schedule/SegmentedControl";
import { Card } from "@/components/pulse/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiFetch } from "@/lib/api";
import { ProjectAutomationPanel } from "@/components/projects/ProjectAutomationPanel";
import {
  createTask,
  deleteTask,
  getProject,
  patchTask,
  syncTaskDependencies,
  type ProjectDetail,
  type TaskRow,
} from "@/lib/projectsService";
import type { PulseWorkerApi } from "@/lib/schedule/pulse-bridge";

const PRIMARY_BTN =
  "rounded-[10px] bg-[#2B4C7E] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#234066] disabled:opacity-50";
const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-pulse-navy shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-pulse-muted";

const KANBAN_COLS = [
  { key: "todo" as const, label: "Todo" },
  { key: "in_progress" as const, label: "In Progress" },
  { key: "blocked" as const, label: "Blocked" },
  { key: "complete" as const, label: "Complete" },
];

function initials(name: string | null | undefined, email: string): string {
  if (name?.trim()) {
    const p = name.trim().split(/\s+/).filter(Boolean);
    if (p.length >= 2) return (p[0][0] + p[p.length - 1][0]).toUpperCase();
    return p[0].slice(0, 2).toUpperCase();
  }
  return email.split("@")[0]?.slice(0, 2).toUpperCase() || "?";
}

function priorityBadge(p: string): string {
  if (p === "critical") return "bg-red-50 text-red-900 ring-1 ring-red-200/80";
  if (p === "high") return "bg-amber-50 text-amber-950 ring-1 ring-amber-200/80";
  if (p === "low") return "bg-slate-100 text-pulse-muted ring-1 ring-slate-200/80";
  return "bg-sky-50 text-[#2B4C7E] ring-1 ring-sky-200/80";
}

export function ProjectDetailApp({ projectId }: { projectId: string }) {
  const [data, setData] = useState<ProjectDetail | null>(null);
  const [workers, setWorkers] = useState<PulseWorkerApi[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [blockHint, setBlockHint] = useState<string | null>(null);
  const [view, setView] = useState<"kanban" | "list" | "automation">("kanban");
  const [readyOnly, setReadyOnly] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [editing, setEditing] = useState<TaskRow | null>(null);

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
    })();
  }, []);

  const workerMap = useMemo(
    () => new Map(workers.map((w) => [w.id, w.full_name || w.email])),
    [workers],
  );

  const workerById = useMemo(() => new Map(workers.map((w) => [w.id, w])), [workers]);

  const tasks = data?.tasks ?? [];

  const visibleTasks = useMemo(
    () => (readyOnly ? tasks.filter((t) => t.is_ready) : tasks),
    [tasks, readyOnly],
  );

  useEffect(() => {
    if (!blockHint) return;
    const t = window.setTimeout(() => setBlockHint(null), 4000);
    return () => window.clearTimeout(t);
  }, [blockHint]);

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
        description={data ? `${data.start_date} → ${data.end_date}` : undefined}
        icon={FolderKanban}
        actions={
          <>
            <Link
              href="/projects"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-pulse-navy shadow-sm hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Projects
            </Link>
            <button
              type="button"
              className={`inline-flex items-center rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors ${
                readyOnly
                  ? "border-emerald-200/90 bg-emerald-50/90 text-emerald-950"
                  : "border-slate-200/90 bg-white text-pulse-navy hover:bg-slate-50"
              }`}
              onClick={() => setReadyOnly((v) => !v)}
            >
              Ready only
            </button>
            <button
              type="button"
              className={PRIMARY_BTN}
              onClick={() => {
                setEditing(null);
                setTaskOpen(true);
              }}
            >
              <span className="inline-flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add task
              </span>
            </button>
          </>
        }
      />

      {err ? <p className="text-sm font-medium text-red-700">{err}</p> : null}

      {!data ? (
        <p className="text-sm text-pulse-muted">Loading…</p>
      ) : (
        <>
          {blockHint ? (
            <p className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-2 text-sm font-medium text-amber-950">
              {blockHint}
            </p>
          ) : null}
          <div className="max-w-xl">
            <SegmentedControl
              value={view}
              onChange={setView}
              options={[
                { value: "kanban", label: "Board" },
                { value: "list", label: "List" },
                { value: "automation", label: "Automation" },
              ]}
            />
          </div>

          {view === "automation" ? (
            <ProjectAutomationPanel projectId={projectId} />
          ) : null}

          {view !== "automation" && readyOnly ? (
            <p className="text-xs text-pulse-muted">Showing tasks that are Todo, unblocked, and actionable.</p>
          ) : null}

          {view !== "automation" && readyOnly && visibleTasks.length === 0 ? (
            <Card padding="md">
              <p className="text-sm text-pulse-muted">No ready tasks in this project.</p>
            </Card>
          ) : null}

          {view === "kanban" ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {KANBAN_COLS.map((col) => (
                <div
                  key={col.key}
                  title={col.key === "complete" ? "Complete is disabled while dependencies are unfinished." : undefined}
                  className="flex min-h-[12rem] flex-col rounded-2xl border border-slate-200/90 bg-white/90 p-3 shadow-sm"
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
                  <p className="border-b border-slate-100 pb-2 text-center text-[11px] font-bold uppercase tracking-wide text-pulse-muted">
                    {col.label}
                  </p>
                  <div className="mt-2 flex flex-1 flex-col gap-2">
                    {visibleTasks
                      .filter((t) => t.status === col.key)
                      .map((t) => (
                        <div
                          key={t.id}
                          draggable
                          title={
                            t.is_blocked
                              ? `This task is blocked by ${t.blocking_tasks?.length ?? 0} incomplete task(s)`
                              : undefined
                          }
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/task-id", t.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          className={`cursor-grab rounded-xl border border-slate-200/90 bg-slate-50/90 px-3 py-2.5 text-left shadow-sm active:cursor-grabbing ${
                            t.is_blocked ? "opacity-75" : ""
                          } ${t.is_ready ? "ring-1 ring-emerald-200/70" : ""}`}
                        >
                          <div className="flex items-start gap-2">
                            <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-pulse-muted" aria-hidden />
                            <button
                              type="button"
                              className="min-w-0 flex-1 text-left"
                              onClick={() => {
                                setEditing(t);
                                setTaskOpen(true);
                              }}
                            >
                              <p className="text-sm font-semibold text-pulse-navy">{t.title}</p>
                              {t.due_date ? (
                                <p className="mt-0.5 text-[11px] text-pulse-muted">Due {t.due_date}</p>
                              ) : null}
                              <div className="mt-1 flex flex-wrap gap-1">
                                <span
                                  className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${priorityBadge(t.priority)}`}
                                >
                                  {t.priority}
                                </span>
                                {t.is_blocked ? (
                                  <span className="inline-flex rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-950 ring-1 ring-amber-200/80">
                                    Blocked
                                  </span>
                                ) : null}
                                {t.is_ready ? (
                                  <span className="inline-flex rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-900 ring-1 ring-emerald-200/80">
                                    Ready
                                  </span>
                                ) : null}
                              </div>
                              {t.assigned_user_id ? (
                                <div className="mt-2 flex items-center gap-2">
                                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[10px] font-bold text-pulse-navy ring-1 ring-slate-200">
                                    {(() => {
                                      const w = workerById.get(t.assigned_user_id);
                                      return initials(w?.full_name ?? null, w?.email ?? "");
                                    })()}
                                  </span>
                                  <span className="truncate text-xs text-pulse-muted">
                                    {workerMap.get(t.assigned_user_id) ?? t.assigned_user_id}
                                  </span>
                                </div>
                              ) : null}
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Card padding="md" className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-pulse-muted">
                    <th className="px-3 py-2">Task</th>
                    <th className="px-3 py-2">Assignee</th>
                    <th className="px-3 py-2">Priority</th>
                    <th className="px-3 py-2">Status / deps</th>
                    <th className="px-3 py-2">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTasks.map((t) => (
                    <tr key={t.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="text-left font-medium text-pulse-navy hover:text-pulse-accent"
                            onClick={() => {
                              setEditing(t);
                              setTaskOpen(true);
                            }}
                          >
                            {t.title}
                          </button>
                          {t.is_ready ? (
                            <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-900 ring-1 ring-emerald-200/80">
                              Ready
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-pulse-muted">
                        {t.assigned_user_id ? (workerMap.get(t.assigned_user_id) ?? "—") : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${priorityBadge(t.priority)}`}
                        >
                          {t.priority}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-pulse-muted">
                        <span className="capitalize">{t.status.replace("_", " ")}</span>
                        {t.is_blocked ? (
                          <span className="ml-2 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-950 ring-1 ring-amber-200/80">
                            Blocked
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 tabular-nums text-pulse-muted">{t.due_date ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}

      <ProjectTaskDrawer
        open={taskOpen}
        onClose={() => {
          setTaskOpen(false);
          setEditing(null);
        }}
        projectId={projectId}
        peerTasks={tasks}
        workers={workers}
        task={editing}
        onSaved={() => void reload()}
      />
    </div>
  );
}

function ProjectTaskDrawer({
  open,
  onClose,
  projectId,
  peerTasks,
  workers,
  task,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  peerTasks: TaskRow[];
  workers: PulseWorkerApi[];
  task: TaskRow | null;
  onSaved: () => void;
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
    } else {
      setTitle("");
      setDescription("");
      setAssignee(workers[0]?.id ?? "");
      setPriority("medium");
      setStatus("todo");
      setDue("");
      setLocTag("");
      setSopRef("");
      setDepSelected([]);
    }
  }, [open, task, workers]);

  const depBlockedLive = depSelected.some((id) => {
    const p = peerTasks.find((x) => x.id === id);
    return Boolean(p && p.status !== "complete");
  });

  async function save() {
    if (!title.trim()) return;
    if (task) {
      try {
        await patchTask(task.id, {
          title: title.trim(),
          description: description.trim() || null,
          assigned_user_id: assignee || null,
          priority,
          status,
          due_date: due || null,
          location_tag_id: locTag.trim() || null,
          sop_id: sopRef.trim() || null,
        });
        await syncTaskDependencies(task.id, depSelected);
      } catch {
        return;
      }
    } else {
      try {
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
        });
        await syncTaskDependencies(created.id, depSelected);
      } catch {
        return;
      }
    }
    onSaved();
    onClose();
  }

  return (
    <PulseDrawer
      open={open}
      title={task ? "Edit task" : "New task"}
      subtitle="Task details sync to the schedule when assignee and due date are set."
      onClose={onClose}
      labelledBy="project-task-title"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          {task ? (
            <button
              type="button"
              className="text-sm font-semibold text-red-700 hover:text-red-800"
              onClick={async () => {
                await deleteTask(task.id);
                onSaved();
                onClose();
              }}
            >
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap gap-3">
            <button type="button" className="text-sm font-semibold text-pulse-muted hover:text-pulse-navy" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className={PRIMARY_BTN} onClick={() => void save()}>
              Save
            </button>
          </div>
        </div>
      }
    >
      <div className="mx-auto max-w-lg space-y-4">
        <div>
          <label className={LABEL} htmlFor="pt-title">
            Title
          </label>
          <input id="pt-title" className={FIELD} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className={LABEL} htmlFor="pt-desc">
            Description
          </label>
          <textarea
            id="pt-desc"
            rows={3}
            className={FIELD}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <label className={LABEL} htmlFor="pt-assign">
            Assigned user
          </label>
          <select id="pt-assign" className={FIELD} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">—</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.full_name || w.email}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL} htmlFor="pt-priority">
              Priority
            </label>
            <select id="pt-priority" className={FIELD} value={priority} onChange={(e) => setPriority(e.target.value)}>
              {(["low", "medium", "high", "critical"] as const).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="pt-status">
              Status
            </label>
            <select id="pt-status" className={FIELD} value={status} onChange={(e) => setStatus(e.target.value)}>
              {(["todo", "in_progress", "blocked", "complete"] as const).map((p) => (
                <option key={p} value={p} disabled={p === "complete" && depBlockedLive}>
                  {p.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
        </div>
        {depBlockedLive && status === "complete" ? (
          <p className="text-xs font-medium text-amber-900">Complete is disabled until prerequisite tasks finish.</p>
        ) : null}
        <div>
          <label className={LABEL} htmlFor="pt-due">
            Due date
          </label>
          <input id="pt-due" type="date" className={FIELD} value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        <div>
          <label className={LABEL} htmlFor="pt-loc">
            Location tag (BLE / equipment id)
          </label>
          <input
            id="pt-loc"
            className={FIELD}
            placeholder="Beacon id for proximity"
            value={locTag}
            onChange={(e) => setLocTag(e.target.value)}
          />
        </div>
        <div>
          <label className={LABEL} htmlFor="pt-sop">
            SOP id (optional)
          </label>
          <input id="pt-sop" className={FIELD} placeholder="Opens /sop/… when starting from proximity" value={sopRef} onChange={(e) => setSopRef(e.target.value)} />
        </div>
        <div>
          <label className={LABEL} htmlFor="pt-deps">
            Depends on (hold Ctrl/Cmd to multi-select)
          </label>
          <select
            id="pt-deps"
            multiple
            className={`${FIELD} min-h-[7rem]`}
            value={depSelected}
            onChange={(e) => setDepSelected(Array.from(e.target.selectedOptions, (o) => o.value))}
          >
            {selectablePeers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          {depSelected.length > 0 ? (
            <p className="mt-1.5 text-xs text-pulse-muted">
              {depSelected.length} prerequisite(s) — task stays blocked until they are complete.
            </p>
          ) : null}
        </div>
      </div>
    </PulseDrawer>
  );
}
