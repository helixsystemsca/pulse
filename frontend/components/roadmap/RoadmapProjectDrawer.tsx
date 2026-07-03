"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PulseDrawer } from "@/components/schedule/PulseDrawer";
import { getProject, listCategories, patchProject, type CategoryRow, type ProjectDetail } from "@/lib/projectsService";
import type { PulseWorkerApi } from "@/lib/schedule/pulse-bridge";
import { cn } from "@/lib/cn";

const fieldClass =
  "w-full rounded-lg border border-ds-border bg-ds-bg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ds-primary";

type Tab = "general" | "dates" | "notes";

const TABS: { id: Tab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "dates", label: "Dates" },
  { id: "notes", label: "Notes" },
];

type Props = {
  projectId: string | null;
  open: boolean;
  canEdit: boolean;
  workers: PulseWorkerApi[];
  onClose: () => void;
  onSaved: () => void;
};

export function RoadmapProjectDrawer({ projectId, open, canEdit, workers, onClose, onSaved }: Props) {
  const [tab, setTab] = useState<Tab>("general");
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    const [detail, cats] = await Promise.all([getProject(projectId), listCategories()]);
    setProject(detail);
    setCategories(cats);
  }, [projectId]);

  useEffect(() => {
    if (open && projectId) void load();
    else setProject(null);
  }, [open, projectId, load]);

  async function save(patch: Parameters<typeof patchProject>[1]) {
    if (!project || !canEdit) return;
    setSaving(true);
    try {
      const updated = await patchProject(project.id, patch);
      setProject({ ...project, ...updated });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const ownerLabel = project?.owner_user_id
    ? workers.find((w) => w.id === project.owner_user_id)?.full_name ?? project.owner_user_id
    : null;

  const taskTotal = project?.tasks?.length ?? project?.task_total ?? 0;
  const taskDone =
    project?.tasks?.filter((t) => t.status === "complete").length ?? project?.task_completed ?? 0;
  const progressPct =
    project?.progress_pct ?? (taskTotal ? Math.round((100 * taskDone) / taskTotal) : 0);

  return (
    <PulseDrawer
      open={open}
      onClose={onClose}
      title={project?.name ?? "Project"}
      subtitle={
        project
          ? `${project.status.replace("_", " ")} · ${progressPct}% complete (${taskDone}/${taskTotal} tasks)`
          : undefined
      }
      wide
      footer={
        project ? (
          <div className="flex flex-wrap items-center gap-3">
            {project.roadmap_stub && canEdit && (
              <button
                type="button"
                className="rounded-lg bg-ds-primary px-3 py-1.5 text-sm font-semibold text-white"
                onClick={() =>
                  void save({ roadmap_stub: false, status: "active", show_on_schedule: true }).then(onSaved)
                }
              >
                Set up full project
              </button>
            )}
            <Link href="/projects" className="text-sm font-medium text-ds-primary hover:underline">
              Open Projects editor →
            </Link>
          </div>
        ) : undefined
      }
    >
      {project && (
        <div className="flex h-full flex-col gap-4">
          <nav className="flex flex-wrap gap-1 border-b border-ds-border pb-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                  tab === t.id ? "bg-ds-primary text-white" : "text-ds-muted hover:bg-ds-secondary",
                )}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {tab === "general" && (
            <div className="space-y-4">
              <Field label="Name">
                <input
                  className={fieldClass}
                  value={project.name}
                  disabled={!canEdit}
                  onChange={(e) => setProject({ ...project, name: e.target.value })}
                  onBlur={() => void save({ name: project.name })}
                />
              </Field>
              <Field label="Description">
                <textarea
                  className={cn(fieldClass, "min-h-[80px]")}
                  value={project.description ?? ""}
                  disabled={!canEdit}
                  onChange={(e) => setProject({ ...project, description: e.target.value })}
                  onBlur={() => void save({ description: project.description })}
                />
              </Field>
              <Field label="Category">
                <select
                  className={fieldClass}
                  value={project.category_id ?? ""}
                  disabled={!canEdit}
                  onChange={(e) => {
                    const category_id = e.target.value || null;
                    setProject({ ...project, category_id });
                    void save({ category_id });
                  }}
                >
                  <option value="">Uncategorized</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Owner">
                <select
                  className={fieldClass}
                  value={project.owner_user_id ?? ""}
                  disabled={!canEdit}
                  onChange={(e) => {
                    const owner_user_id = e.target.value || null;
                    setProject({ ...project, owner_user_id });
                    void save({ owner_user_id });
                  }}
                >
                  <option value="">Unassigned</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>{w.full_name || w.email}</option>
                  ))}
                </select>
                {ownerLabel && <p className="text-xs text-ds-muted">Current: {ownerLabel}</p>}
              </Field>
              <Field label="Status">
                <select
                  className={fieldClass}
                  value={project.status}
                  disabled={!canEdit}
                  onChange={(e) => {
                    const status = e.target.value;
                    setProject({ ...project, status });
                    void save({ status });
                  }}
                >
                  <option value="active">Active</option>
                  <option value="future">Future</option>
                  <option value="on_hold">On hold</option>
                  <option value="completed">Completed</option>
                </select>
              </Field>
              <Field label="Schedule color">
                <input
                  type="color"
                  className="h-10 w-full cursor-pointer rounded-lg border border-ds-border"
                  value={project.overlay_color ?? "#2563eb"}
                  disabled={!canEdit}
                  onChange={(e) => {
                    setProject({ ...project, overlay_color: e.target.value });
                    void save({ overlay_color: e.target.value });
                  }}
                />
              </Field>
              <p className="text-xs text-ds-muted">
                Progress ({progressPct}%) is calculated from completed tasks on the Projects page.
              </p>
            </div>
          )}

          {tab === "dates" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start">
                <input
                  type="date"
                  className={fieldClass}
                  value={project.start_date}
                  disabled={!canEdit}
                  onChange={(e) => {
                    setProject({ ...project, start_date: e.target.value });
                    void save({ start_date: e.target.value });
                  }}
                />
              </Field>
              <Field label="End">
                <input
                  type="date"
                  className={fieldClass}
                  value={project.end_date}
                  disabled={!canEdit}
                  onChange={(e) => {
                    setProject({ ...project, end_date: e.target.value });
                    void save({ end_date: e.target.value });
                  }}
                />
              </Field>
            </div>
          )}

          {tab === "notes" && (
            <textarea
              className={cn(fieldClass, "min-h-[200px]")}
              placeholder="Project notes…"
              value={project.notes ?? ""}
              disabled={!canEdit}
              onChange={(e) => setProject({ ...project, notes: e.target.value })}
              onBlur={() => void save({ notes: project.notes })}
            />
          )}

          {saving && <p className="text-xs text-ds-muted">Saving…</p>}
        </div>
      )}
    </PulseDrawer>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-ds-muted">{label}</span>
      {children}
    </label>
  );
}
