"use client";

import Link from "next/link";
import { CalendarRange, FolderKanban, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/pulse/Card";
import { ModuleOnboardingHint } from "@/components/onboarding/ModuleOnboardingHint";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/schedule/SegmentedControl";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { apiFetch } from "@/lib/api";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { createProject, deleteProject, listProjects, patchProject, type ProjectRow } from "@/lib/projectsService";
import type { PulseWorkerApi } from "@/lib/schedule/pulse-bridge";

const PRIMARY_BTN =
  "rounded-[10px] bg-[#2B4C7E] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#234066] disabled:opacity-50";
const SECONDARY_BTN =
  "rounded-[10px] border border-slate-200/90 bg-white px-5 py-2.5 text-sm font-semibold text-pulse-navy shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-[#374151] dark:bg-[#1F2937] dark:text-slate-100 dark:hover:bg-[#374151]";
const DANGER_BTN =
  "rounded-[10px] border border-red-200/90 bg-white px-5 py-2.5 text-sm font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-500/35 dark:bg-[#1F2937] dark:text-red-300 dark:hover:bg-red-950/50";
const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-pulse-navy shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25 dark:border-[#374151] dark:bg-[#0F172A] dark:text-gray-100";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-pulse-muted";

function displayName(w: PulseWorkerApi): string {
  return (w.full_name || w.email || "User").trim();
}

function statusLabel(st: string): string {
  if (st === "on_hold") return "On hold";
  if (st === "completed") return "Completed";
  return "Active";
}

export function ProjectsApp() {
  const { session } = usePulseAuth();
  const myUserId = session?.sub ?? null;
  const [rows, setRows] = useState<ProjectRow[] | null>(null);
  const [workers, setWorkers] = useState<PulseWorkerApi[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<"active" | "completed">("active");
  const [createOpen, setCreateOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formScope, setFormScope] = useState("");
  const [formOwner, setFormOwner] = useState("");

  const workerById = useMemo(() => new Map(workers.map((w) => [w.id, w])), [workers]);

  async function reload() {
    try {
      const data = await listProjects();
      setRows(data);
      setErr(null);
    } catch {
      setErr("Could not load projects.");
    }
  }

  useEffect(() => {
    void reload();
  }, []);

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

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    return rows.filter((p) => (filter === "completed" ? p.status === "completed" : p.status !== "completed"));
  }, [rows, filter]);

  async function markProjectComplete(p: ProjectRow) {
    if (!myUserId || p.created_by_user_id !== myUserId || completingId) return;
    setCompletingId(p.id);
    try {
      const out = await patchProject(p.id, { status: "completed" });
      setRows((prev) =>
        prev?.map((r) =>
          r.id === p.id
            ? {
                ...r,
                ...out,
                task_total: r.task_total,
                task_completed: r.task_completed,
                progress_pct: r.progress_pct,
                assignee_user_ids: r.assignee_user_ids,
              }
            : r,
        ) ?? null,
      );
      setToast("Project marked complete.");
    } catch (e) {
      const { message } = parseClientApiError(e);
      setToast(message || "Could not update project.");
    } finally {
      setCompletingId(null);
    }
  }

  async function removeProject(p: ProjectRow) {
    if (!myUserId || p.created_by_user_id !== myUserId || deletingId) return;
    if (
      !confirm(
        `Delete "${p.name}"? All tasks in this project will be removed. This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeletingId(p.id);
    try {
      await deleteProject(p.id);
      setRows((prev) => prev?.filter((r) => r.id !== p.id) ?? null);
      setToast("Project deleted.");
    } catch (e) {
      const { message } = parseClientApiError(e);
      setToast(message || "Could not delete project.");
    } finally {
      setDeletingId(null);
    }
  }

  async function submitCreate() {
    if (!formName.trim() || !formStart || !formEnd || saving) return;
    if (formEnd < formStart) {
      setToast("End date must be on or after start date.");
      return;
    }
    setSaving(true);
    try {
      const created = await createProject({
        name: formName.trim(),
        description: formScope.trim() || null,
        start_date: formStart,
        end_date: formEnd,
        owner_user_id: formOwner.trim() || null,
        status: "active",
      });
      setRows((prev) => (prev ? [created, ...prev] : prev));
      setCreateOpen(false);
      setFormName("");
      setFormStart("");
      setFormEnd("");
      setFormScope("");
      setFormOwner("");
      setToast("Project created.");
    } catch {
      setToast("Could not create project.");
    } finally {
      setSaving(false);
    }
  }

  if (err) {
    return <p className="text-sm font-medium text-red-700 dark:text-red-400">{err}</p>;
  }
  if (rows === null) {
    return (
      <div className="flex min-h-[32vh] items-center justify-center text-sm text-pulse-muted">Loading projects…</div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Operational initiatives, tasks, and workforce-ready skill matching."
        icon={FolderKanban}
        actions={
          <button type="button" className={PRIMARY_BTN} onClick={() => setCreateOpen(true)}>
            <span className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
              Create project
            </span>
          </button>
        }
      />

      <div className="max-w-md">
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          options={[
            { value: "active", label: "Active" },
            { value: "completed", label: "Completed" },
          ]}
        />
      </div>

      {toast ? (
        <div
          className="fixed bottom-6 left-1/2 z-50 max-w-md -translate-x-1/2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 shadow-lg dark:border-emerald-500/35 dark:bg-emerald-950/95 dark:text-emerald-100"
          role="status"
        >
          {toast}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <Card
          padding="md"
          className="space-y-3 border-dashed border-slate-200/90 dark:border-[#374151]"
        >
          {rows.length === 0 ? (
            <ModuleOnboardingHint>
              <strong className="font-semibold text-pulse-navy dark:text-slate-100">Projects organize work.</strong> Create
              a project, add tasks with priorities and required skills, then match workers from roster profiles.
            </ModuleOnboardingHint>
          ) : null}
          <p className="text-sm text-pulse-muted">
            {rows.length === 0
              ? "No projects yet. Create one to get started."
              : filter === "completed"
                ? "No completed projects in this view."
                : "No active projects in this filter. Switch to Completed or create a project."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => {
            const owner = p.owner_user_id ? workerById.get(p.owner_user_id) : undefined;
            const creatorIsYou = Boolean(myUserId && p.created_by_user_id && p.created_by_user_id === myUserId);
            const creatorCanComplete = creatorIsYou && p.status !== "completed";
            return (
              <Card
                key={p.id}
                padding="md"
                className="group h-full transition-all duration-200 hover:-translate-y-0.5 hover:border-pulse-accent/45 hover:shadow-md dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200/80 bg-slate-50 text-pulse-accent dark:border-[#374151] dark:bg-[#0F172A]">
                    <FolderKanban className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-headline text-base font-semibold text-pulse-navy dark:text-slate-100">{p.name}</p>
                    <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-pulse-muted">
                      <CalendarRange className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                      <span className="tabular-nums">
                        {p.start_date} → {p.end_date}
                      </span>
                    </p>
                    <p className="mt-2 text-xs text-pulse-muted">
                      <span className="font-semibold text-pulse-navy/80 dark:text-slate-300">Owner: </span>
                      {owner ? displayName(owner) : "—"}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-pulse-muted ring-1 ring-slate-200/80 dark:bg-[#1F2937] dark:text-slate-300 dark:ring-[#374151]">
                        {statusLabel(p.status)}
                      </span>
                    </div>
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-pulse-muted">
                        <span>Progress</span>
                        <span className="tabular-nums text-pulse-navy dark:text-slate-200">{p.progress_pct}%</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-[#1F2937]">
                        <div
                          className="h-full rounded-full bg-pulse-accent transition-[width] duration-500 ease-out"
                          style={{ width: `${p.progress_pct}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-pulse-muted">
                        {p.task_completed} / {p.task_total} tasks complete
                      </p>
                    </div>
                    <div className="mt-4 flex flex-col gap-2">
                      {creatorIsYou ? (
                        <div className="flex flex-col gap-2 sm:flex-row">
                          {creatorCanComplete ? (
                            <button
                              type="button"
                              className={`${SECONDARY_BTN} w-full sm:flex-1`}
                              disabled={completingId === p.id || deletingId === p.id}
                              onClick={() => void markProjectComplete(p)}
                            >
                              {completingId === p.id ? "Updating…" : "Mark complete"}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className={`${DANGER_BTN} w-full ${creatorCanComplete ? "sm:flex-1" : ""}`}
                            disabled={deletingId === p.id || completingId === p.id}
                            onClick={() => void removeProject(p)}
                          >
                            {deletingId === p.id ? "Deleting…" : "Delete"}
                          </button>
                        </div>
                      ) : null}
                      <Link
                        href={`/projects/${p.id}`}
                        className={`${PRIMARY_BTN} inline-flex w-full items-center justify-center no-underline`}
                      >
                        Open project
                      </Link>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px] dark:bg-black/60">
          <div
            className="max-h-[min(90vh,640px)] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200/90 bg-white p-6 shadow-2xl dark:border-[#374151] dark:bg-[#111827]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-project-title"
          >
            <h2 id="create-project-title" className="text-lg font-bold text-pulse-navy dark:text-slate-100">
              Create project
            </h2>
            <p className="mt-1 text-xs text-pulse-muted">All fields except scope are required.</p>
            <div className="mt-5 space-y-4">
              <div>
                <label className={LABEL} htmlFor="cp-name">
                  Project name
                </label>
                <input
                  id="cp-name"
                  className={FIELD}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL} htmlFor="cp-start">
                    Start date
                  </label>
                  <input
                    id="cp-start"
                    type="date"
                    className={FIELD}
                    value={formStart}
                    onChange={(e) => setFormStart(e.target.value)}
                  />
                </div>
                <div>
                  <label className={LABEL} htmlFor="cp-end">
                    End date
                  </label>
                  <input id="cp-end" type="date" className={FIELD} value={formEnd} onChange={(e) => setFormEnd(e.target.value)} />
                </div>
              </div>
              <div>
                <label className={LABEL} htmlFor="cp-scope">
                  Scope description
                </label>
                <textarea
                  id="cp-scope"
                  rows={3}
                  className={FIELD}
                  value={formScope}
                  onChange={(e) => setFormScope(e.target.value)}
                  placeholder="Optional summary for your team"
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="cp-owner">
                  Project owner
                </label>
                <select id="cp-owner" className={FIELD} value={formOwner} onChange={(e) => setFormOwner(e.target.value)}>
                  <option value="">— Select user —</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {displayName(w)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className="rounded-lg px-4 py-2.5 text-sm font-semibold text-pulse-muted transition-colors hover:text-pulse-navy dark:hover:text-slate-200"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={PRIMARY_BTN}
                disabled={saving || !formName.trim() || !formStart || !formEnd}
                onClick={() => void submitCreate()}
              >
                {saving ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
