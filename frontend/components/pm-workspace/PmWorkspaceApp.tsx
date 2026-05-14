"use client";

import { useCallback, useEffect, useState } from "react";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import {
  pmCoordCreateProject,
  pmCoordCreateTask,
  pmCoordGetProject,
  pmCoordListProjects,
  pmCoordPatchProject,
  type PmCoordProjectDetail,
  type PmCoordProjectSummary,
} from "@/lib/pmCoordWorkspace";
import { apiFetch } from "@/lib/api";

/** Internal coordination workspace — API gated by `can_use_pm_features` server-side. */
export function PmWorkspaceApp() {
  const { session } = usePulseAuth();
  const allowed = Boolean(session?.can_use_pm_features);

  const [projects, setProjects] = useState<PmCoordProjectSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PmCoordProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const refreshList = useCallback(async () => {
    const rows = await pmCoordListProjects();
    setProjects(rows);
    return rows;
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    const d = await pmCoordGetProject(id);
    setDetail(d);
  }, []);

  useEffect(() => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await refreshList();
        if (!cancelled && rows.length > 0) {
          setSelectedId((prev) => prev ?? rows[0]!.id);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Load failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed, refreshList]);

  useEffect(() => {
    if (!allowed || !selectedId) return;
    let cancelled = false;
    (async () => {
      try {
        await loadDetail(selectedId);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Load failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed, selectedId, loadDetail]);

  if (!allowed) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-ds-border bg-ds-secondary/40 p-6 text-center">
        <h1 className="text-lg font-semibold text-ds-foreground">PM workspace</h1>
        <p className="mt-2 text-sm text-ds-muted">
          This area is for internal planning only. Your account does not have the PM coordination flag enabled.
        </p>
      </div>
    );
  }

  if (loading) {
    return <p className="text-sm text-ds-muted">Loading…</p>;
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-ds-foreground">PM workspace</h1>
        <p className="text-sm text-ds-muted">
          Lightweight PMBOK-style coordination (brief, WBS, dependencies, risks, readiness) — separate from public
          Projects.
        </p>
      </div>
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <div className="flex flex-col gap-4 lg:flex-row">
        <aside className="w-full shrink-0 space-y-3 rounded-lg border border-ds-border bg-ds-primary p-3 lg:max-w-xs">
          <p className="text-xs font-semibold uppercase text-ds-muted">Project workspace</p>
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const name = newName.trim();
              if (!name || saving) return;
              setSaving(true);
              setError(null);
              try {
                const d = await pmCoordCreateProject({ name });
                setNewName("");
                await refreshList();
                setSelectedId(d.id);
                setDetail(d);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Create failed");
              } finally {
                setSaving(false);
              }
            }}
          >
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New workspace name"
              className="min-w-0 flex-1 rounded-md border border-ds-border bg-background px-2 py-1.5 text-sm"
            />
            <button
              type="submit"
              disabled={saving || !newName.trim()}
              className="rounded-md bg-ds-success px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Add
            </button>
          </form>
          <ul className="space-y-1">
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={`w-full rounded-md px-2 py-1.5 text-left text-sm font-medium ${
                    selectedId === p.id
                      ? "bg-ds-interactive-hover-strong text-ds-foreground"
                      : "text-ds-muted hover:bg-ds-interactive-hover"
                  }`}
                >
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <main className="min-w-0 flex-1 space-y-4">
          {detail ? (
            <ProjectDetailEditor
              detail={detail}
              onPatch={async (patch) => {
                setSaving(true);
                setError(null);
                try {
                  const d = await pmCoordPatchProject(detail.id, patch);
                  setDetail(d);
                  await refreshList();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Save failed");
                } finally {
                  setSaving(false);
                }
              }}
              onAddTask={async (title) => {
                setSaving(true);
                setError(null);
                try {
                  const d = await pmCoordCreateTask(detail.id, { title });
                  setDetail(d);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Task failed");
                } finally {
                  setSaving(false);
                }
              }}
              onRefresh={() => loadDetail(detail.id)}
            />
          ) : (
            <p className="text-sm text-ds-muted">Select or create a workspace.</p>
          )}
        </main>
      </div>
    </div>
  );
}

function ProjectDetailEditor({
  detail,
  onPatch,
  onAddTask,
  onRefresh,
}: {
  detail: PmCoordProjectDetail;
  onPatch: (p: Parameters<typeof pmCoordPatchProject>[1]) => Promise<void>;
  onAddTask: (title: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const [taskTitle, setTaskTitle] = useState("");
  const [riskText, setRiskText] = useState("");
  const [depTaskId, setDepTaskId] = useState("");
  const [depPrereqId, setDepPrereqId] = useState("");

  return (
    <div className="space-y-6 rounded-lg border border-ds-border bg-ds-primary p-4">
      <header>
        <h2 className="text-lg font-semibold text-ds-foreground">{detail.name}</h2>
      </header>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase text-ds-muted">Project brief</h3>
        <label className="block text-xs text-ds-muted">Objective</label>
        <textarea
          defaultValue={detail.objective ?? ""}
          key={`obj-${detail.updated_at}`}
          rows={2}
          className="w-full rounded-md border border-ds-border bg-background px-2 py-1.5 text-sm"
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== (detail.objective ?? "")) void onPatch({ objective: v || null });
          }}
        />
        <label className="block text-xs text-ds-muted">Deliverables</label>
        <textarea
          defaultValue={detail.deliverables ?? ""}
          key={`del-${detail.updated_at}`}
          rows={2}
          className="w-full rounded-md border border-ds-border bg-background px-2 py-1.5 text-sm"
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== (detail.deliverables ?? "")) void onPatch({ deliverables: v || null });
          }}
        />
        <label className="block text-xs text-ds-muted">Definition of done</label>
        <textarea
          defaultValue={detail.definition_of_done ?? ""}
          key={`dod-${detail.updated_at}`}
          rows={2}
          className="w-full rounded-md border border-ds-border bg-background px-2 py-1.5 text-sm"
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== (detail.definition_of_done ?? "")) void onPatch({ definition_of_done: v || null });
          }}
        />
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase text-ds-muted">Readiness gate</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          {(
            [
              ["readiness_tasks_defined", detail.readiness_tasks_defined],
              ["readiness_materials_ready", detail.readiness_materials_ready],
              ["readiness_dependencies_set", detail.readiness_dependencies_set],
            ] as const
          ).map(([k, v]) => (
            <label key={k} className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={v}
                onChange={(e) => void onPatch({ [k]: e.target.checked })}
              />
              <span>{k.replace(/^readiness_/, "").replace(/_/g, " ")}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase text-ds-muted">Status & review</h3>
        <label className="block text-xs text-ds-muted">Latest update (daily / weekly)</label>
        <textarea
          defaultValue={detail.current_update ?? ""}
          key={`cu-${detail.updated_at}`}
          rows={3}
          className="w-full rounded-md border border-ds-border bg-background px-2 py-1.5 text-sm"
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== (detail.current_update ?? "")) void onPatch({ current_update: v || null });
          }}
        />
        <label className="block text-xs text-ds-muted">Post-project review</label>
        <textarea
          defaultValue={detail.post_project_review ?? ""}
          key={`ppr-${detail.updated_at}`}
          rows={3}
          className="w-full rounded-md border border-ds-border bg-background px-2 py-1.5 text-sm"
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== (detail.post_project_review ?? "")) void onPatch({ post_project_review: v || null });
          }}
        />
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase text-ds-muted">Tasks (WBS-lite)</h3>
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const t = taskTitle.trim();
            if (!t) return;
            setTaskTitle("");
            await onAddTask(t);
          }}
        >
          <input
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            placeholder="Task title"
            className="min-w-0 flex-1 rounded-md border border-ds-border bg-background px-2 py-1.5 text-sm"
          />
          <button type="submit" className="rounded-md border border-ds-border px-3 py-1.5 text-sm font-semibold">
            Add task
          </button>
        </form>
        <ul className="space-y-2 text-sm">
          {detail.tasks.map((t) => (
            <li key={t.id} className="rounded-md border border-ds-border/60 bg-background/60 px-2 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{t.title}</span>
                <select
                  value={t.status}
                  onChange={async (e) => {
                    await apiFetch(`/api/v1/pm-coord/tasks/${t.id}`, {
                      method: "PATCH",
                      json: { status: e.target.value },
                    });
                    await onRefresh();
                  }}
                  className="rounded border border-ds-border bg-background px-2 py-1 text-xs"
                >
                  <option value="not_started">Not started</option>
                  <option value="in_progress">In progress</option>
                  <option value="complete">Complete</option>
                </select>
              </div>
              {t.depends_on_task_ids.length > 0 ? (
                <p className="mt-1 text-xs text-ds-muted">Blocked by: {t.depends_on_task_ids.join(", ")}</p>
              ) : null}
              {t.resources.length > 0 ? (
                <ul className="mt-1 text-xs text-ds-muted">
                  {t.resources.map((r) => (
                    <li key={r.id}>
                      {r.resource_kind}: {r.label}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="rounded-md border border-dashed border-ds-border p-2 text-xs">
          <p className="mb-1 font-semibold text-ds-muted">Add dependency (task ← prerequisite)</p>
          <div className="flex flex-wrap gap-2">
            <input
              value={depTaskId}
              onChange={(e) => setDepTaskId(e.target.value)}
              placeholder="Task id (successor)"
              className="min-w-[8rem] flex-1 rounded border border-ds-border bg-background px-2 py-1"
            />
            <input
              value={depPrereqId}
              onChange={(e) => setDepPrereqId(e.target.value)}
              placeholder="Prerequisite task id"
              className="min-w-[8rem] flex-1 rounded border border-ds-border bg-background px-2 py-1"
            />
            <button
              type="button"
              className="rounded bg-ds-secondary px-2 py-1 font-semibold"
              onClick={async () => {
                if (!depTaskId.trim() || !depPrereqId.trim()) return;
                await apiFetch(`/api/v1/pm-coord/tasks/${depTaskId.trim()}/dependencies`, {
                  method: "POST",
                  json: { depends_on_task_id: depPrereqId.trim() },
                });
                setDepTaskId("");
                setDepPrereqId("");
                await onRefresh();
              }}
            >
              Link
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase text-ds-muted">Risks</h3>
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const txt = riskText.trim();
            if (!txt) return;
            await apiFetch(`/api/v1/pm-coord/projects/${detail.id}/risks`, {
              method: "POST",
              json: { risk_description: txt, impact: "medium" },
            });
            setRiskText("");
            await onRefresh();
          }}
        >
          <input
            value={riskText}
            onChange={(e) => setRiskText(e.target.value)}
            placeholder="Describe risk"
            className="min-w-0 flex-1 rounded-md border border-ds-border bg-background px-2 py-1.5 text-sm"
          />
          <button type="submit" className="rounded-md border border-ds-border px-3 py-1.5 text-sm font-semibold">
            Add
          </button>
        </form>
        <ul className="space-y-1 text-sm">
          {detail.risks.map((r) => (
            <li key={r.id} className="rounded border border-ds-border/50 px-2 py-1">
              <span className="font-medium">{r.risk_description}</span>{" "}
              <span className="text-xs uppercase text-ds-muted">({r.impact})</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
