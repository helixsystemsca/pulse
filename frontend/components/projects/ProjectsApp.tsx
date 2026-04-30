"use client";

import Link from "next/link";
import { CalendarRange, FolderKanban, Pencil, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/pulse/Card";
import { ModuleOnboardingHint } from "@/components/onboarding/ModuleOnboardingHint";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageBody } from "@/components/ui/PageBody";
import { SegmentedControl } from "@/components/schedule/SegmentedControl";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { apiFetch } from "@/lib/api";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import {
  createProject,
  createCategory,
  deleteProject,
  listProjects,
  listCategories,
  listProjectTemplates,
  patchProject,
  type ProjectRow,
  type ProjectTemplateRow,
  type CategoryRow,
} from "@/lib/projectsService";
import type { PulseWorkerApi } from "@/lib/schedule/pulse-bridge";

const PRIMARY_BTN =
  "rounded-[10px] bg-[#2B4C7E] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#234066] disabled:opacity-50";
const SECONDARY_BTN =
  "rounded-[10px] border border-slate-200/90 bg-white px-5 py-2.5 text-sm font-semibold text-pulse-navy shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-ds-border dark:bg-ds-secondary dark:text-slate-100 dark:hover:bg-ds-interactive-hover";
const DANGER_BTN =
  "rounded-[10px] border border-red-200/90 bg-white px-5 py-2.5 text-sm font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-500/35 dark:bg-ds-secondary dark:text-red-300 dark:hover:bg-red-950/50";
const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-pulse-navy shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-pulse-muted";

function displayName(w: PulseWorkerApi): string {
  return (w.full_name || w.email || "User").trim();
}

function statusLabel(st: string): string {
  if (st === "on_hold") return "On hold";
  if (st === "completed") return "Completed";
  if (st === "future") return "Future";
  return "Active";
}

function healthBadgeClass(h: string | null | undefined): string {
  const v = (h || "").toLowerCase();
  if (v.includes("risk")) return "bg-red-50 text-red-800 ring-red-200/90 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-500/35";
  if (v.includes("attention")) return "bg-amber-50 text-amber-900 ring-amber-200/90 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-500/35";
  return "bg-slate-100 text-pulse-muted ring-slate-200/80 dark:bg-ds-secondary dark:text-slate-300 dark:ring-ds-border";
}

const CATEGORY_SUGGESTIONS = ["Pool", "Arena", "Grounds", "Building", "Other"] as const;

function categoryDotClass(color: string | null | undefined): string {
  const c = (color || "").trim();
  if (!c) return "bg-ds-muted";
  // Expect a token-like class suffix (e.g. "ds-success"); fallback to muted.
  if (c === "ds-success") return "bg-ds-success";
  if (c === "ds-warning") return "bg-ds-warning";
  if (c === "ds-danger") return "bg-ds-danger";
  if (c === "ds-info") return "bg-[var(--ds-info)]";
  return "bg-ds-muted";
}

function categoryMatchByName(categories: CategoryRow[], name: string): CategoryRow | null {
  const q = name.trim().toLowerCase();
  if (!q) return null;
  return categories.find((c) => c.name.trim().toLowerCase() === q) ?? null;
}

export function ProjectsApp() {
  const { session } = usePulseAuth();
  const myUserId = session?.sub ?? null;
  const [rows, setRows] = useState<ProjectRow[] | null>(null);
  const [workers, setWorkers] = useState<PulseWorkerApi[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<"active" | "completed">("active");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editFor, setEditFor] = useState<ProjectRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formScope, setFormScope] = useState("");
  const [formOwner, setFormOwner] = useState("");
  const [formStatus, setFormStatus] = useState<"active" | "future" | "on_hold" | "completed">("active");
  const [templates, setTemplates] = useState<ProjectTemplateRow[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [categoryQuery, setCategoryQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState<string>("");

  const workerById = useMemo(() => new Map(workers.map((w) => [w.id, w])), [workers]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const filteredCategories = useMemo(() => {
    const q = categoryQuery.trim().toLowerCase();
    if (!q) return categories.slice().sort((a, b) => a.name.localeCompare(b.name));
    return categories
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [categories, categoryQuery]);

  async function ensureCategory(name: string, color?: string | null): Promise<CategoryRow | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const existing = categoryMatchByName(categories, trimmed);
    if (existing) return existing;
    try {
      const created = await createCategory({ name: trimmed, color: color || null });
      setCategories((prev) => [created, ...prev].sort((a, b) => a.name.localeCompare(b.name)));
      return created;
    } catch {
      return null;
    }
  }

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
        const t = await listProjectTemplates();
        setTemplates(t);
      } catch {
        setTemplates([]);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const c = await listCategories();
        setCategories(c);
      } catch {
        setCategories([]);
      }
    })();
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

  const groupedProjects = useMemo(() => {
    if (!rows) return null;
    const base = rows.filter((p) => (filter === "completed" ? p.status === "completed" : p.status !== "completed"));
    const uniqueCats = new Set(base.map((p) => p.category?.name || "Uncategorized"));
    if (uniqueCats.size <= 1) return null;
    const groups = new Map<string, ProjectRow[]>();
    for (const p of base) {
      const key = p.category?.name || "Uncategorized";
      groups.set(key, [...(groups.get(key) || []), p]);
    }
    const keys = [...groups.keys()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    return { keys, groups };
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
        template_id: templateId.trim() || null,
        category_id: categoryId || null,
      });
      setRows((prev) => (prev ? [created, ...prev] : prev));
      setCreateOpen(false);
      setFormName("");
      setFormStart("");
      setFormEnd("");
      setFormScope("");
      setFormOwner("");
      setTemplateId("");
      setCategoryId("");
      setCategoryQuery("");
      setToast("Project created.");
    } catch {
      setToast("Could not create project.");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(p: ProjectRow) {
    setEditFor(p);
    setFormName(p.name ?? "");
    setFormStart(p.start_date ?? "");
    setFormEnd(p.end_date ?? "");
    setFormScope(p.description ?? "");
    setFormOwner((p.owner_user_id ?? "") || "");
    setCategoryId((p.category_id as string) || "");
    setCategoryQuery(p.category?.name || "");
    const st = (p.status ?? "active") as string;
    setFormStatus(
      st === "completed"
        ? "completed"
        : st === "on_hold"
          ? "on_hold"
          : st === "future"
            ? "future"
            : "active",
    );
    setEditOpen(true);
  }

  async function submitEdit() {
    if (!editFor || !formName.trim() || !formStart || !formEnd || saving) return;
    if (formEnd < formStart) {
      setToast("End date must be on or after start date.");
      return;
    }
    setSaving(true);
    try {
      const out = await patchProject(editFor.id, {
        name: formName.trim(),
        description: formScope.trim() || null,
        start_date: formStart,
        end_date: formEnd,
        owner_user_id: formOwner.trim() || null,
        status: formStatus,
        category_id: categoryId || null,
      });
      setRows((prev) =>
        prev?.map((r) =>
          r.id === editFor.id
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
      setEditOpen(false);
      setEditFor(null);
      setToast("Project updated.");
    } catch (e) {
      const { message } = parseClientApiError(e);
      setToast(message || "Could not update project.");
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
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={SECONDARY_BTN} onClick={() => setCreateCategoryOpen(true)}>
              <span className="inline-flex items-center gap-2">
                <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                Category
              </span>
            </button>
            <button type="button" className={PRIMARY_BTN} onClick={() => setCreateOpen(true)}>
              <span className="inline-flex items-center gap-2">
                <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                Create project
              </span>
            </button>
          </div>
        }
      />

      <PageBody>
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
          className="space-y-3 border-dashed border-slate-200/90 dark:border-ds-border"
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
        <div className="space-y-6">
          {(groupedProjects ? groupedProjects.keys : [""]).map((groupName) => {
            const groupRows = groupedProjects ? groupedProjects.groups.get(groupName) || [] : filtered;
            return (
              <div key={groupName || "all"} className="space-y-3">
                {groupedProjects ? (
                  <p className="text-[11px] font-bold uppercase tracking-wide text-pulse-muted">
                    {groupName}
                  </p>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {groupRows.map((p) => {
                    const owner = p.owner_user_id ? workerById.get(p.owner_user_id) : undefined;
                    const creatorIsYou = Boolean(myUserId && p.created_by_user_id && p.created_by_user_id === myUserId);
                    const creatorCanComplete = creatorIsYou && p.status !== "completed";
                    const lastTs = (p.last_activity_at || p.updated_at || p.created_at || "").trim();
                    const lastUpdateLabel = (() => {
                      if (!lastTs) return "";
                      const t = new Date(lastTs).getTime();
                      if (!Number.isFinite(t)) return "";
                      const days = Math.max(0, Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24)));
                      if (days <= 0) return "Last update: today";
                      if (days === 1) return "Last update: 1 day ago";
                      return `Last update: ${days} days ago`;
                    })();
                    return (
                      <Card key={p.id} padding="md" className="h-full">
                        <div className="flex items-start gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200/80 bg-slate-50 text-pulse-accent dark:border-ds-border dark:bg-ds-secondary">
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
                            {p.category ? (
                              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                {p.category.color ? (
                                  <span className={`h-2 w-2 rounded-full ${categoryDotClass(p.category.color)}`} aria-hidden />
                                ) : null}
                                <span className="text-xs text-muted-foreground">{p.category.name}</span>
                              </div>
                            ) : null}
                            {lastUpdateLabel ? (
                              <p className="mt-1 text-[11px] font-medium text-pulse-muted">{lastUpdateLabel}</p>
                            ) : null}
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-pulse-muted ring-1 ring-slate-200/80 dark:bg-ds-secondary dark:text-slate-300 dark:ring-ds-border">
                                {statusLabel(p.status)}
                              </span>
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${healthBadgeClass(
                                  p.health_status,
                                )}`}
                                title="Project health is derived from overdue tasks and issue activity."
                              >
                                {(p.health_status || "On Track").toString()}
                              </span>
                            </div>
                            <div className="mt-4">
                              <div className="flex items-center justify-between text-[11px] font-semibold text-pulse-muted">
                                <span>Progress</span>
                                <span className="tabular-nums text-pulse-navy dark:text-slate-200">{p.progress_pct}%</span>
                              </div>
                              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-ds-secondary">
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
                                  <button
                                    type="button"
                                    className={`${SECONDARY_BTN} w-full sm:flex-1`}
                                    disabled={saving || completingId === p.id || deletingId === p.id}
                                    onClick={() => openEdit(p)}
                                  >
                                    <span className="inline-flex items-center justify-center gap-2">
                                      <Pencil className="h-4 w-4" aria-hidden />
                                      Edit
                                    </span>
                                  </button>
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
              </div>
            );
          })}
        </div>
      )}

      {createOpen ? (
        <div className="ds-modal-backdrop fixed inset-0 z-[140] flex items-center justify-center p-4 backdrop-blur-[2px]">
          <div
            className="max-h-[min(90vh,640px)] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200/90 bg-white p-6 shadow-2xl dark:border-ds-border dark:bg-ds-primary"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-project-title"
          >
            <h2 id="create-project-title" className="text-lg font-bold text-pulse-navy dark:text-slate-100">
              Create project
            </h2>
            <p className="mt-1 text-xs text-pulse-muted">All fields except scope are required.</p>
            <div className="mt-5 space-y-4">
              {templates.length > 0 ? (
                <div>
                  <label className={LABEL} htmlFor="cp-template">
                    Template (optional)
                  </label>
                  <select
                    id="cp-template"
                    className={FIELD}
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                  >
                    <option value="">— No template —</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-pulse-muted">
                    If selected, we’ll copy the template’s default notes and suggested tasks into the project.
                  </p>
                </div>
              ) : null}
              <div className="relative">
                <label className={LABEL} htmlFor="cp-category">
                  Category
                </label>
                <input
                  id="cp-category"
                  className={FIELD}
                  value={categoryQuery}
                  onChange={(e) => {
                    setCategoryQuery(e.target.value);
                    setCategoryOpen(true);
                    setCategoryId("");
                  }}
                  onFocus={() => setCategoryOpen(true)}
                  placeholder="Select or type…"
                />
                {categoryOpen ? (
                  <div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200/90 bg-white p-3 shadow-xl dark:border-ds-border dark:bg-ds-primary">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-pulse-muted">Suggested</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {CATEGORY_SUGGESTIONS.map((name) => (
                        <button
                          key={name}
                          type="button"
                          className="rounded-full border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-pulse-navy hover:bg-slate-50 dark:border-ds-border dark:bg-ds-secondary dark:text-slate-100 dark:hover:bg-ds-interactive-hover"
                          onClick={async () => {
                            const c = await ensureCategory(name);
                            if (c) {
                              setCategoryId(c.id);
                              setCategoryQuery(c.name);
                            } else {
                              setCategoryQuery(name);
                            }
                            setCategoryOpen(false);
                          }}
                        >
                          {name}
                        </button>
                      ))}
                    </div>

                    <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-pulse-muted">All categories</p>
                    <div className="mt-2 max-h-40 overflow-y-auto">
                      {filteredCategories.length === 0 ? (
                        <p className="text-sm text-pulse-muted">No categories yet.</p>
                      ) : (
                        <ul className="space-y-1">
                          {filteredCategories.map((c) => (
                            <li key={c.id}>
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold text-pulse-navy hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-ds-interactive-hover"
                                onClick={() => {
                                  setCategoryId(c.id);
                                  setCategoryQuery(c.name);
                                  setCategoryOpen(false);
                                }}
                              >
                                <span className={`h-2 w-2 rounded-full ${categoryDotClass(c.color)}`} aria-hidden />
                                {c.name}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {categoryQuery.trim() && !categoryMatchByName(categories, categoryQuery) ? (
                      <div className="mt-3 border-t border-slate-100 pt-3 dark:border-ds-border">
                        <button
                          type="button"
                          className="w-full rounded-lg border border-ds-border bg-ds-secondary px-3 py-2 text-left text-sm font-semibold text-ds-foreground hover:bg-ds-interactive-hover"
                          onClick={async () => {
                            const created = await ensureCategory(categoryQuery);
                            if (created) {
                              setCategoryId(created.id);
                              setCategoryQuery(created.name);
                            }
                            setCategoryOpen(false);
                          }}
                        >
                          Create “{categoryQuery.trim()}”
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
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

      {createCategoryOpen ? (
        <div className="ds-modal-backdrop fixed inset-0 z-[140] flex items-center justify-center p-4 backdrop-blur-[2px]">
          <div
            className="max-h-[min(90vh,520px)] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200/90 bg-white p-6 shadow-2xl dark:border-ds-border dark:bg-ds-primary"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-category-title"
          >
            <h2 id="create-category-title" className="text-lg font-bold text-pulse-navy dark:text-slate-100">
              Create category
            </h2>
            <div className="mt-5 space-y-4">
              <div>
                <label className={LABEL} htmlFor="cat-name">
                  Name
                </label>
                <input
                  id="cat-name"
                  className={FIELD}
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="cat-color">
                  Color (optional)
                </label>
                <select id="cat-color" className={FIELD} value={newCatColor} onChange={(e) => setNewCatColor(e.target.value)}>
                  <option value="">— None —</option>
                  <option value="ds-success">Teal</option>
                  <option value="ds-warning">Attention</option>
                  <option value="ds-danger">Critical</option>
                  <option value="ds-info">Info</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className="rounded-lg px-4 py-2.5 text-sm font-semibold text-pulse-muted transition-colors hover:text-pulse-navy dark:hover:text-slate-200"
                onClick={() => {
                  setCreateCategoryOpen(false);
                  setNewCatName("");
                  setNewCatColor("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={PRIMARY_BTN}
                disabled={!newCatName.trim()}
                onClick={async () => {
                  const created = await ensureCategory(newCatName, newCatColor || null);
                  if (created) setToast("Category created.");
                  setCreateCategoryOpen(false);
                  setNewCatName("");
                  setNewCatColor("");
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}

        {editOpen && editFor ? (
        <div className="ds-modal-backdrop fixed inset-0 z-[140] flex items-center justify-center p-4 backdrop-blur-[2px]">
          <div
            className="max-h-[min(90vh,680px)] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200/90 bg-white p-6 shadow-2xl dark:border-ds-border dark:bg-ds-primary"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-project-title"
          >
            <h2 id="edit-project-title" className="text-lg font-bold text-pulse-navy dark:text-slate-100">
              Edit project
            </h2>
            <p className="mt-1 text-xs text-pulse-muted">Update name, dates, owner, scope, or status.</p>
            <div className="mt-5 space-y-4">
              <div className="relative">
                <label className={LABEL} htmlFor="ep-category">
                  Category
                </label>
                <input
                  id="ep-category"
                  className={FIELD}
                  value={categoryQuery}
                  onChange={(e) => {
                    setCategoryQuery(e.target.value);
                    setCategoryOpen(true);
                    setCategoryId("");
                  }}
                  onFocus={() => setCategoryOpen(true)}
                  placeholder="Select or type…"
                />
                {categoryOpen ? (
                  <div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200/90 bg-white p-3 shadow-xl dark:border-ds-border dark:bg-ds-primary">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-pulse-muted">Suggested</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {CATEGORY_SUGGESTIONS.map((name) => (
                        <button
                          key={name}
                          type="button"
                          className="rounded-full border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-pulse-navy hover:bg-slate-50 dark:border-ds-border dark:bg-ds-secondary dark:text-slate-100 dark:hover:bg-ds-interactive-hover"
                          onClick={async () => {
                            const c = await ensureCategory(name);
                            if (c) {
                              setCategoryId(c.id);
                              setCategoryQuery(c.name);
                            } else {
                              setCategoryQuery(name);
                            }
                            setCategoryOpen(false);
                          }}
                        >
                          {name}
                        </button>
                      ))}
                    </div>

                    <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-pulse-muted">All categories</p>
                    <div className="mt-2 max-h-40 overflow-y-auto">
                      {filteredCategories.length === 0 ? (
                        <p className="text-sm text-pulse-muted">No categories yet.</p>
                      ) : (
                        <ul className="space-y-1">
                          {filteredCategories.map((c) => (
                            <li key={c.id}>
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold text-pulse-navy hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-ds-interactive-hover"
                                onClick={() => {
                                  setCategoryId(c.id);
                                  setCategoryQuery(c.name);
                                  setCategoryOpen(false);
                                }}
                              >
                                <span className={`h-2 w-2 rounded-full ${categoryDotClass(c.color)}`} aria-hidden />
                                {c.name}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {categoryQuery.trim() && !categoryMatchByName(categories, categoryQuery) ? (
                      <div className="mt-3 border-t border-slate-100 pt-3 dark:border-ds-border">
                        <button
                          type="button"
                          className="w-full rounded-lg border border-ds-border bg-ds-secondary px-3 py-2 text-left text-sm font-semibold text-ds-foreground hover:bg-ds-interactive-hover"
                          onClick={async () => {
                            const created = await ensureCategory(categoryQuery);
                            if (created) {
                              setCategoryId(created.id);
                              setCategoryQuery(created.name);
                            }
                            setCategoryOpen(false);
                          }}
                        >
                          Create “{categoryQuery.trim()}”
                        </button>
                      </div>
                    ) : null}
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        className="text-xs font-semibold text-pulse-muted hover:text-pulse-navy dark:hover:text-slate-200"
                        onClick={() => {
                          setCategoryOpen(false);
                        }}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              <div>
                <label className={LABEL} htmlFor="ep-name">
                  Project name
                </label>
                <input id="ep-name" className={FIELD} value={formName} onChange={(e) => setFormName(e.target.value)} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL} htmlFor="ep-start">
                    Start date
                  </label>
                  <input id="ep-start" type="date" className={FIELD} value={formStart} onChange={(e) => setFormStart(e.target.value)} />
                </div>
                <div>
                  <label className={LABEL} htmlFor="ep-end">
                    End date
                  </label>
                  <input id="ep-end" type="date" className={FIELD} value={formEnd} onChange={(e) => setFormEnd(e.target.value)} />
                </div>
              </div>
              <div>
                <label className={LABEL} htmlFor="ep-owner">
                  Project owner
                </label>
                <select id="ep-owner" className={FIELD} value={formOwner} onChange={(e) => setFormOwner(e.target.value)}>
                  <option value="">— Select user —</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {displayName(w)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="ep-status">
                  Status
                </label>
                <select
                  id="ep-status"
                  className={FIELD}
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as typeof formStatus)}
                >
                  <option value="active">Active</option>
                  <option value="future">Future</option>
                  <option value="on_hold">On hold</option>
                  <option value="completed">Completed</option>
                </select>
                {formStatus === "completed" ? (
                  <p className="mt-1 text-xs text-pulse-muted">
                    Note: the backend only allows the project creator to mark a project complete.
                  </p>
                ) : null}
              </div>
              <div>
                <label className={LABEL} htmlFor="ep-scope">
                  Scope description
                </label>
                <textarea
                  id="ep-scope"
                  rows={3}
                  className={FIELD}
                  value={formScope}
                  onChange={(e) => setFormScope(e.target.value)}
                  placeholder="Optional summary for your team"
                />
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className="rounded-lg px-4 py-2.5 text-sm font-semibold text-pulse-muted transition-colors hover:text-pulse-navy dark:hover:text-slate-200"
                onClick={() => {
                  setEditOpen(false);
                  setEditFor(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={PRIMARY_BTN}
                disabled={saving || !formName.trim() || !formStart || !formEnd}
                onClick={() => void submitEdit()}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
        ) : null}
      </PageBody>
    </div>
  );
}
