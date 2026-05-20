"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FolderKanban,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { PlanningIdeaConvertModal } from "@/components/planning/PlanningIdeaConvertModal";
import { PlanningIdeaFormModal } from "@/components/planning/PlanningIdeaFormModal";
import {
  formatEstimatedCost,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from "@/lib/planning-ideas/labels";
import {
  createPlanningIdea,
  deletePlanningIdea,
  listPlanningIdeas,
  patchPlanningIdea,
  convertPlanningIdea,
} from "@/lib/planning-ideas/api";
import type { PlanningIdeaRow, PlanningIdeaStatus } from "@/lib/planning-ideas/types";
import { PLANNING_IDEA_STATUSES } from "@/lib/planning-ideas/types";
import {
  priorityBadgeClass,
  rowSurfaceClass,
  statusBadgeClass,
} from "@/components/planning/planning-ui";
import { cn } from "@/lib/cn";

type SortKey = "created" | "priority" | "cost" | "title";

const PRIORITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function parseCost(row: PlanningIdeaRow): number {
  const raw = row.estimated_cost;
  if (raw == null || raw === "") return -1;
  const n = typeof raw === "number" ? raw : Number.parseFloat(String(raw));
  return Number.isFinite(n) ? n : -1;
}

function sortRows(rows: PlanningIdeaRow[], sort: SortKey): PlanningIdeaRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    if (sort === "title") return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    if (sort === "cost") return parseCost(b) - parseCost(a);
    if (sort === "priority") {
      return (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  return copy;
}

type Props = {
  onToast: (message: string) => void;
};

export function PlanningListTab({ onToast }: Props) {
  const [rows, setRows] = useState<PlanningIdeaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sort, setSort] = useState<SortKey>("created");
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PlanningIdeaRow | null>(null);
  const [convertTarget, setConvertTarget] = useState<PlanningIdeaRow | null>(null);
  const [convertSuccess, setConvertSuccess] = useState<{ projectId: string; projectName: string } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPlanningIdeas({ q: q.trim() || undefined, status: statusFilter || undefined });
      setRows(data);
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Could not load ideas.");
    } finally {
      setLoading(false);
    }
  }, [q, statusFilter, onToast]);

  useEffect(() => {
    const delay = q.trim() ? 280 : 0;
    const t = window.setTimeout(() => void refresh(), delay);
    return () => window.clearTimeout(t);
  }, [q, statusFilter, refresh]);

  const statusCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of PLANNING_IDEA_STATUSES) m.set(s, 0);
    for (const r of rows) m.set(r.status, (m.get(r.status) ?? 0) + 1);
    return m;
  }, [rows]);

  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort]);

  const grouped = useMemo(() => {
    const active = sorted.filter((r) => r.status !== "converted");
    const converted = sorted.filter((r) => r.status === "converted");
    return { active, converted };
  }, [sorted]);

  async function handleCreate(draft: {
    title: string;
    description: string;
    location: string;
    category: string;
    estimated_cost: number | null;
    priority: string;
    status: PlanningIdeaStatus;
  }) {
    const tempId = `temp-${Date.now()}`;
    const optimistic: PlanningIdeaRow = {
      id: tempId,
      company_id: "",
      title: draft.title,
      description: draft.description || null,
      location: draft.location || null,
      category: draft.category || null,
      estimated_cost: draft.estimated_cost,
      priority: draft.priority as PlanningIdeaRow["priority"],
      status: draft.status,
      created_by_user_id: null,
      linked_project_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      converted_at: null,
    };
    setRows((prev) => [optimistic, ...prev]);
    try {
      const saved = await createPlanningIdea({
        title: draft.title,
        description: draft.description || null,
        location: draft.location || null,
        category: draft.category || null,
        estimated_cost: draft.estimated_cost,
        priority: draft.priority as PlanningIdeaRow["priority"],
        status: draft.status,
      });
      setRows((prev) => prev.map((r) => (r.id === tempId ? saved : r)));
      onToast("Idea added.");
    } catch (e) {
      setRows((prev) => prev.filter((r) => r.id !== tempId));
      throw e;
    }
  }

  async function handleEdit(
    id: string,
    draft: {
      title: string;
      description: string;
      location: string;
      category: string;
      estimated_cost: number | null;
      priority: string;
      status: PlanningIdeaStatus;
    },
  ) {
    const prev = rows.find((r) => r.id === id);
    if (!prev) return;
    const patch = {
      title: draft.title,
      description: draft.description || null,
      location: draft.location || null,
      category: draft.category || null,
      estimated_cost: draft.estimated_cost,
      priority: draft.priority as PlanningIdeaRow["priority"],
      status: draft.status,
    };
    setRows((list) =>
      list.map((r) =>
        r.id === id
          ? {
              ...r,
              ...patch,
              updated_at: new Date().toISOString(),
            }
          : r,
      ),
    );
    try {
      const saved = await patchPlanningIdea(id, patch);
      setRows((list) => list.map((r) => (r.id === id ? saved : r)));
      onToast("Idea updated.");
    } catch (e) {
      setRows((list) => list.map((r) => (r.id === id ? prev : r)));
      throw e;
    }
  }

  async function handleDelete(row: PlanningIdeaRow) {
    if (!window.confirm(`Delete “${row.title}”?`)) return;
    const snapshot = rows;
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    try {
      await deletePlanningIdea(row.id);
      onToast("Idea deleted.");
    } catch (e) {
      setRows(snapshot);
      onToast(e instanceof Error ? e.message : "Could not delete.");
    }
  }

  async function handleInlineStatus(row: PlanningIdeaRow, status: PlanningIdeaStatus) {
    if (row.status === "converted") return;
    const prev = row.status;
    setRows((list) => list.map((r) => (r.id === row.id ? { ...r, status } : r)));
    try {
      const saved = await patchPlanningIdea(row.id, { status });
      setRows((list) => list.map((r) => (r.id === row.id ? saved : r)));
    } catch {
      setRows((list) => list.map((r) => (r.id === row.id ? { ...r, status: prev } : r)));
      onToast("Could not update status.");
    }
  }

  async function handleConvert(
    body: Parameters<NonNullable<Parameters<typeof PlanningIdeaConvertModal>[0]["onConfirm"]>>[0],
  ) {
    if (!convertTarget) return;
    const result = await convertPlanningIdea(convertTarget.id, body);
    setRows((list) => list.map((r) => (r.id === convertTarget.id ? result.idea : r)));
    setConvertTarget(null);
    setConvertSuccess({ projectId: result.project_id, projectName: result.project_name });
    onToast("Project created from planning idea.");
  }

  function IdeaCard({ row }: { row: PlanningIdeaRow }) {
    const converted = row.status === "converted";
    return (
      <article className={cn(rowSurfaceClass(converted), "grid gap-3 p-4 sm:grid-cols-[auto_1fr_auto] sm:items-start")}>
        <div className="flex flex-col gap-2 sm:min-w-[7.5rem]">
          <select
            className={cn(
              "w-full rounded-md border-0 bg-transparent py-0.5 text-xs font-bold ring-1 ring-inset",
              statusBadgeClass(row.status),
            )}
            value={row.status}
            disabled={converted}
            aria-label="Status"
            onChange={(e) => void handleInlineStatus(row, e.target.value as PlanningIdeaStatus)}
          >
            {PLANNING_IDEA_STATUSES.filter((s) => s !== "converted" || row.status === "converted").map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <span
            className={cn(
              "inline-flex w-fit rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
              priorityBadgeClass(row.priority),
            )}
          >
            {PRIORITY_LABELS[row.priority]}
          </span>
        </div>

        <div className="min-w-0 space-y-1">
          <h3 className="truncate text-base font-semibold text-ds-foreground">{row.title}</h3>
          {row.description ? (
            <p className="line-clamp-2 text-sm text-ds-muted">{row.description}</p>
          ) : (
            <p className="text-sm italic text-ds-muted">No description</p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ds-muted">
            <span>
              <span className="font-semibold text-ds-foreground/80">Location:</span> {row.location || "—"}
            </span>
            <span>
              <span className="font-semibold text-ds-foreground/80">Category:</span> {row.category || "—"}
            </span>
            <span>
              <span className="font-semibold text-ds-foreground/80">Cost:</span> {formatEstimatedCost(row.estimated_cost)}
            </span>
            <span>
              <span className="font-semibold text-ds-foreground/80">Created:</span>{" "}
              {new Date(row.created_at).toLocaleDateString()}
            </span>
          </div>
          {converted && row.linked_project_id ? (
            <Link
              href={`/projects/${row.linked_project_id}`}
              className="inline-block text-xs font-semibold text-ds-accent hover:underline"
            >
              Open linked project →
            </Link>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
          {!converted ? (
            <button
              type="button"
              title="Create project"
              className="rounded-lg border border-ds-border p-2 text-ds-foreground hover:bg-ds-interactive-hover"
              onClick={() => setConvertTarget(row)}
            >
              <FolderKanban className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
          {!converted ? (
            <button
              type="button"
              title="Edit"
              className="rounded-lg border border-ds-border p-2 text-ds-foreground hover:bg-ds-interactive-hover"
              onClick={() => {
                setEditTarget(row);
                setFormOpen(true);
              }}
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            title="Delete"
            className="rounded-lg border border-ds-border p-2 text-ds-danger hover:bg-ds-danger/10"
            onClick={() => void handleDelete(row)}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </article>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ds-foreground">Idea backlog</h2>
          <p className="text-sm text-ds-muted">Structured intake before projects enter the portfolio.</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-ds-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95"
          onClick={() => {
            setEditTarget(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add idea
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-ds-border/70 bg-ds-secondary/15 p-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-muted" />
          <input
            className="w-full rounded-lg border border-ds-border bg-ds-primary py-2 pl-9 pr-3 text-sm"
            placeholder="Search ideas…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          className="rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {PLANNING_IDEA_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]} ({statusCounts.get(s) ?? 0})
            </option>
          ))}
        </select>
        <select
          className="rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-sm"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort"
        >
          <option value="created">Newest first</option>
          <option value="priority">Priority</option>
          <option value="cost">Rough cost</option>
          <option value="title">Title</option>
        </select>
      </div>

      {convertSuccess ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm dark:border-emerald-800 dark:bg-emerald-950/30">
          <span className="text-emerald-900 dark:text-emerald-100">
            Created project <strong>{convertSuccess.projectName}</strong>.
          </span>
          <div className="flex gap-2">
            <Link
              href={`/projects/${convertSuccess.projectId}`}
              className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Open project
            </Link>
            <button
              type="button"
              className="rounded-md border border-emerald-400/60 px-3 py-1.5 text-xs font-semibold text-emerald-900 dark:text-emerald-100"
              onClick={() => setConvertSuccess(null)}
            >
              Stay here
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-ds-muted">Loading ideas…</p>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ds-border px-8 py-12 text-center text-sm text-ds-muted">
          No ideas yet. Use <strong>Add idea</strong> to capture your first project concept.
        </div>
      ) : (
        <div className="space-y-6">
          <section className="space-y-2">
            {grouped.active.map((row) => (
              <div key={row.id} className="group">
                <IdeaCard row={row} />
              </div>
            ))}
          </section>
          {grouped.converted.length > 0 ? (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ds-muted">
                Converted ({grouped.converted.length})
              </h3>
              <div className="space-y-2">
                {grouped.converted.map((row) => (
                  <div key={row.id} className="group">
                    <IdeaCard row={row} />
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      <PlanningIdeaFormModal
        open={formOpen}
        idea={editTarget}
        onClose={() => {
          setFormOpen(false);
          setEditTarget(null);
        }}
        onSave={async (draft) => {
          if (editTarget) await handleEdit(editTarget.id, draft);
          else await handleCreate(draft);
        }}
      />

      <PlanningIdeaConvertModal
        open={convertTarget != null}
        idea={convertTarget}
        onClose={() => setConvertTarget(null)}
        onConfirm={handleConvert}
      />
    </div>
  );
}
