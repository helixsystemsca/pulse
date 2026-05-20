"use client";

import { useEffect, useState } from "react";
import { PulseDrawer } from "@/components/schedule/PulseDrawer";
import { apiFetch, isApiMode } from "@/lib/api";
import type { PlanningIdeaRow } from "@/lib/planning-ideas/types";
import { formatEstimatedCost } from "@/lib/planning-ideas/labels";
import { listProjectTemplates, type ProjectTemplateRow } from "@/lib/projectsService";
import { scheduleDepartmentOptionsForSession } from "@/lib/schedule/schedule-department";
import { usePulseAuth } from "@/hooks/usePulseAuth";

type WorkerOption = { id: string; label: string };

const FIELD =
  "mt-1.5 w-full rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-sm text-ds-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ds-accent/30";

type Props = {
  open: boolean;
  idea: PlanningIdeaRow | null;
  onClose: () => void;
  onConfirm: (body: {
    owner_user_id: string | null;
    department_slug: string | null;
    target_start_date: string;
    target_end_date: string | null;
    template_id: string | null;
    project_status: string;
  }) => Promise<void>;
};

function defaultEndDate(start: string): string {
  const d = new Date(`${start}T12:00:00`);
  d.setMonth(d.getMonth() + 3);
  return d.toISOString().slice(0, 10);
}

export function PlanningIdeaConvertModal({ open, idea, onClose, onConfirm }: Props) {
  const { session } = usePulseAuth();
  const [ownerId, setOwnerId] = useState("");
  const [department, setDepartment] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [projectStatus, setProjectStatus] = useState("future");
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [templates, setTemplates] = useState<ProjectTemplateRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const deptOptions = scheduleDepartmentOptionsForSession(session, true);

  useEffect(() => {
    if (!open || !idea) return;
    const today = new Date().toISOString().slice(0, 10);
    setStartDate(today);
    setEndDate(defaultEndDate(today));
    setOwnerId(session?.sub ?? "");
    setDepartment(deptOptions[0]?.slug ?? "");
    setTemplateId("");
    setProjectStatus("future");
    setErr(null);
    if (isApiMode()) {
      void (async () => {
        try {
          const [w, t] = await Promise.all([
            apiFetch<{ id: string; full_name?: string | null; email: string }[]>("/api/v1/pulse/workers"),
            listProjectTemplates(),
          ]);
          setWorkers(
            w.map((row) => ({
              id: row.id,
              label: (row.full_name || row.email || row.id).trim(),
            })),
          );
          setTemplates(t);
        } catch {
          setWorkers([]);
          setTemplates([]);
        }
      })();
    }
  }, [open, idea, session?.sub]);

  if (!open || !idea) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!startDate || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await onConfirm({
        owner_user_id: ownerId.trim() || null,
        department_slug: department.trim() || null,
        target_start_date: startDate,
        target_end_date: endDate.trim() || null,
        template_id: templateId.trim() || null,
        project_status: projectStatus,
      });
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not create project.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PulseDrawer
      open={open}
      title="Convert idea to project"
      subtitle="Creates a project shell, activity note, and optional template tasks."
      onClose={onClose}
      wide
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className="rounded-lg px-4 py-2 text-sm font-semibold text-ds-muted" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="planning-convert-form"
            disabled={busy || !startDate}
            className="rounded-lg bg-ds-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create project"}
          </button>
        </div>
      }
    >
      <form id="planning-convert-form" className="space-y-4" onSubmit={(e) => void submit(e)}>
        {err ? <p className="text-sm text-ds-danger">{err}</p> : null}
        <div className="rounded-lg border border-ds-border/70 bg-ds-secondary/25 p-3 text-sm">
          <p className="font-semibold text-ds-foreground">{idea.title}</p>
          {idea.description ? <p className="mt-1 text-ds-muted line-clamp-3">{idea.description}</p> : null}
          <dl className="mt-2 grid grid-cols-2 gap-2 text-xs text-ds-muted">
            <div>
              <dt>Location</dt>
              <dd className="font-medium text-ds-foreground">{idea.location || "—"}</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd className="font-medium text-ds-foreground">{idea.category || "—"}</dd>
            </div>
            <div>
              <dt>Rough cost</dt>
              <dd className="font-medium text-ds-foreground">{formatEstimatedCost(idea.estimated_cost)}</dd>
            </div>
          </dl>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase text-ds-muted">Project manager</label>
            <select className={FIELD} value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">— Select —</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-ds-muted">Department</label>
            <select className={FIELD} value={department} onChange={(e) => setDepartment(e.target.value)}>
              {deptOptions.map((d) => (
                <option key={d.slug} value={d.slug}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-ds-muted">Target start</label>
            <input
              type="date"
              className={FIELD}
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (!endDate || endDate < e.target.value) setEndDate(defaultEndDate(e.target.value));
              }}
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-ds-muted">Target end</label>
            <input type="date" className={FIELD} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-ds-muted">Project template</label>
            <select className={FIELD} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">Empty shell (no template tasks)</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-ds-muted">Initial status</label>
            <select className={FIELD} value={projectStatus} onChange={(e) => setProjectStatus(e.target.value)}>
              <option value="future">Future</option>
              <option value="active">Active</option>
              <option value="on_hold">On hold</option>
            </select>
          </div>
        </div>
      </form>
    </PulseDrawer>
  );
}
