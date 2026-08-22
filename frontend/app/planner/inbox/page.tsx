"use client";

import { useCallback, useEffect, useState } from "react";
import { ListChecks } from "lucide-react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlannerChrome } from "@/components/planner/PlannerChrome";
import {
  blockTask,
  completeTask,
  createTask,
  fetchCategories,
  fetchEmailSuggestions,
  fetchTasks,
  generateDay,
  startTask,
  type PlannerCategory,
  type PlannerTask,
} from "@/lib/planner/plannerService";

const inputClass =
  "w-full rounded-lg border border-ds-border bg-ds-bg px-3 py-2 text-sm text-ds-foreground outline-none focus:border-ds-primary";
const btnPrimary =
  "rounded-lg bg-ds-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50";
const btnGhost = "rounded-lg border border-ds-border px-3 py-1.5 text-sm text-ds-foreground hover:bg-ds-card";

const emptyForm = {
  title: "",
  description: "",
  category_id: "",
  priority: "medium",
  estimated_minutes: 30,
  due_date: "",
  deadline: "",
  source_type: "manual",
  project_id: "",
  asset_id: "",
  person_label: "",
  recurrence: "",
  notes: "",
  tags: "",
};

export default function PlannerInboxPage() {
  const [cats, setCats] = useState<PlannerCategory[]>([]);
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [emailCount, setEmailCount] = useState(0);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [c, t, email] = await Promise.all([
        fetchCategories(),
        fetchTasks({ q: q || undefined, status: status || undefined }),
        fetchEmailSuggestions(),
      ]);
      setCats(c);
      setTasks(t);
      setEmailCount(email.length);
      setForm((f) => ({ ...f, category_id: f.category_id || c[0]?.id || "" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load inbox");
    }
  }, [q, status]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setBusy(true);
    try {
      await createTask({
        title: form.title.trim(),
        description: form.description || undefined,
        category_id: form.category_id || undefined,
        priority: form.priority,
        estimated_minutes: Number(form.estimated_minutes) || 30,
        due_date: form.due_date || undefined,
        deadline: form.deadline || undefined,
        source_type: form.source_type,
        project_id: form.project_id || undefined,
        asset_id: form.asset_id || undefined,
        person_label: form.person_label || undefined,
        recurrence: form.recurrence || undefined,
        notes: form.notes || undefined,
        tags: form.tags
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setForm((f) => ({ ...emptyForm, category_id: f.category_id }));
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Task Inbox"
        description="Fast capture for work that should land on the day automatically."
        icon={ListChecks}
      />
      <PageBody>
        <PlannerChrome />
        {error ? <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

        <section className="rounded-xl border border-dashed border-ds-border bg-ds-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Potential tasks from email</p>
          <p className="mt-1 text-sm text-ds-muted">
            Email connectors are not connected. Suggestions will appear here for review — never auto-created.
            {emailCount ? ` ${emailCount} pending.` : ""}
          </p>
        </section>

        <form onSubmit={onCreate} className="grid gap-3 rounded-xl border border-ds-border bg-ds-card p-4 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ds-muted">Task name</span>
            <input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Develop pool shutdown SOP" />
          </label>
          <label className="md:col-span-2">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ds-muted">Description</span>
            <textarea className={inputClass} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ds-muted">Category</span>
            <select className={inputClass} value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ds-muted">Priority</span>
            <select className={inputClass} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {["critical", "high", "medium", "low"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ds-muted">Estimated minutes</span>
            <input className={inputClass} type="number" min={5} value={form.estimated_minutes} onChange={(e) => setForm({ ...form, estimated_minutes: Number(e.target.value) })} />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ds-muted">Source</span>
            <select className={inputClass} value={form.source_type} onChange={(e) => setForm({ ...form, source_type: e.target.value })}>
              {["manual", "project", "work_request", "pm", "inspection", "procedure", "asset", "compliance", "training"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ds-muted">Due date</span>
            <input className={inputClass} type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ds-muted">Deadline</span>
            <input className={inputClass} type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ds-muted">Project id</span>
            <input className={inputClass} value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} placeholder="Optional existing project" />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ds-muted">Asset id</span>
            <input className={inputClass} value={form.asset_id} onChange={(e) => setForm({ ...form, asset_id: e.target.value })} placeholder="Optional existing asset" />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ds-muted">Person / department</span>
            <input className={inputClass} value={form.person_label} onChange={(e) => setForm({ ...form, person_label: e.target.value })} />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ds-muted">Recurrence</span>
            <input className={inputClass} value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value })} placeholder="weekdays" />
          </label>
          <label className="md:col-span-2">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ds-muted">Tags</span>
            <input className={inputClass} value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="comma separated" />
          </label>
          <label className="md:col-span-2">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ds-muted">Notes</span>
            <textarea className={inputClass} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
          <div className="md:col-span-2 flex gap-2">
            <button type="submit" className={btnPrimary} disabled={busy}>
              Add to inbox
            </button>
            <button type="button" className={btnGhost} disabled={busy} onClick={() => void generateDay()}>
              Place on today
            </button>
          </div>
        </form>

        <div className="flex flex-wrap gap-2">
          <input className={`${inputClass} max-w-sm`} placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className={`${inputClass} w-44`} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All open</option>
            {["not_started", "in_progress", "deferred", "blocked", "complete"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <ul className="space-y-2">
          {tasks.map((t) => (
            <li key={t.id} className="rounded-xl border border-ds-border bg-ds-card p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-ds-foreground">{t.title}</p>
                  <p className="text-xs text-ds-muted">
                    {t.category_name} · {t.priority} · {t.estimated_minutes} min · {t.status}
                    {t.delay_count ? ` · delayed ${t.delay_count}×` : ""}
                    {t.project_id ? ` · project ${t.project_id}` : ""}
                    {t.asset_id ? ` · asset ${t.asset_id}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <button type="button" className={btnGhost} onClick={() => void startTask(t.id).then(() => reload())}>
                    Start
                  </button>
                  <button type="button" className={btnGhost} onClick={() => void completeTask(t.id).then(() => reload())}>
                    Complete
                  </button>
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() =>
                      void blockTask(t.id, { blocker_type: "waiting_on_person", description: "Blocked from inbox" }).then(() => reload())
                    }
                  >
                    Block
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </PageBody>
    </div>
  );
}
