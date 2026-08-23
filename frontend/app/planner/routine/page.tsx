"use client";

import { useCallback, useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlannerChrome } from "@/components/planner/PlannerChrome";
import {
  createRoutine,
  deleteRoutine,
  fetchCategories,
  fetchRoutine,
  fetchSettings,
  hhmm,
  patchRoutine,
  patchSettings,
  type PlannerCategory,
  type PlannerRoutine,
  type PlannerSettings,
} from "@/lib/planner/plannerService";

const inputClass =
  "w-full rounded-lg border border-ds-border bg-ds-bg px-3 py-2 text-sm text-ds-foreground outline-none focus:border-ds-primary";
const btnPrimary =
  "rounded-lg bg-ds-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50";
const btnGhost = "rounded-lg border border-ds-border px-3 py-1.5 text-sm text-ds-foreground hover:bg-ds-card";

export default function PlannerRoutinePage() {
  const [cats, setCats] = useState<PlannerCategory[]>([]);
  const [rows, setRows] = useState<PlannerRoutine[]>([]);
  const [settings, setSettings] = useState<PlannerSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", category_id: "", start_time: "08:30", end_time: "09:30", protected: false, flexible: true });

  const reload = useCallback(async () => {
    try {
      const [c, r, s] = await Promise.all([fetchCategories(), fetchRoutine(), fetchSettings()]);
      setCats(c);
      setRows(r);
      setSettings(s);
      setDraft((d) => ({ ...d, category_id: d.category_id || c[0]?.id || "" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load routine");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function saveTargets(slug: string, pct: number) {
    if (!settings) return;
    const next = { ...settings.category_targets, [slug]: Math.max(0, pct) / 100 };
    const updated = await patchSettings({ category_targets: next });
    setSettings(updated);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Routine"
        description="Protected morning rhythm plus category targets. Times are not hard-coded — change them here."
        icon={Settings}
      />
      <PageBody>
        <PlannerChrome />
        {error ? <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

        {settings ? (
          <section data-tour="planner-hours" className="rounded-xl border border-ds-border bg-ds-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Working hours</p>
            <div className="mt-2 grid max-w-lg grid-cols-2 gap-3">
              <label>
                <span className="mb-1 block text-xs text-ds-muted">Start</span>
                <input
                  className={inputClass}
                  type="time"
                  value={hhmm(settings.work_start)}
                  onChange={(e) => void patchSettings({ work_start: e.target.value }).then(setSettings)}
                />
              </label>
              <label>
                <span className="mb-1 block text-xs text-ds-muted">End</span>
                <input
                  className={inputClass}
                  type="time"
                  value={hhmm(settings.work_end)}
                  onChange={(e) => void patchSettings({ work_end: e.target.value }).then(setSettings)}
                />
              </label>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.adaptive_scheduling}
                onChange={(e) => void patchSettings({ adaptive_scheduling: e.target.checked }).then(setSettings)}
              />
              Adaptive duration estimates (optional — uses completed actuals)
            </label>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ds-muted">Category targets (%)</p>
            <div data-tour="planner-targets" className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {cats.map((c) => (
                <label key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-ds-border px-2 py-1">
                  <span className="text-sm" style={{ color: c.color }}>
                    {c.name}
                  </span>
                  <input
                    className={`${inputClass} w-20`}
                    type="number"
                    min={0}
                    max={100}
                    value={Math.round((settings.category_targets[c.slug] ?? 0) * 100)}
                    onChange={(e) => void saveTargets(c.slug, Number(e.target.value))}
                  />
                </label>
              ))}
            </div>
          </section>
        ) : null}

        <section data-tour="planner-routine-list" className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="grid gap-2 rounded-xl border border-ds-border bg-ds-card p-3 md:grid-cols-6">
              <input className={`${inputClass} md:col-span-2`} value={r.name} onBlur={() => void patchRoutine(r.id, { name: r.name })} onChange={(e) => setRows((all) => all.map((x) => (x.id === r.id ? { ...x, name: e.target.value } : x)))} />
              <select
                className={inputClass}
                value={r.category_id}
                onChange={(e) => {
                  const category_id = e.target.value;
                  setRows((all) => all.map((x) => (x.id === r.id ? { ...x, category_id } : x)));
                  void patchRoutine(r.id, { category_id });
                }}
              >
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input className={inputClass} type="time" value={hhmm(r.start_time)} onChange={(e) => void patchRoutine(r.id, { start_time: e.target.value }).then(() => reload())} />
              <input className={inputClass} type="time" value={hhmm(r.end_time)} onChange={(e) => void patchRoutine(r.id, { end_time: e.target.value }).then(() => reload())} />
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  className={inputClass}
                  value={r.recurrence}
                  onChange={(e) => void patchRoutine(r.id, { recurrence: e.target.value }).then(() => reload())}
                >
                  <option value="weekdays">Weekdays</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={r.protected} onChange={(e) => void patchRoutine(r.id, { protected: e.target.checked }).then(() => reload())} />
                  Protected
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={r.flexible} onChange={(e) => void patchRoutine(r.id, { flexible: e.target.checked }).then(() => reload())} />
                  Flexible
                </label>
                <button type="button" className={btnGhost} onClick={() => void deleteRoutine(r.id).then(() => reload())}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </section>

        <form
          className="grid gap-2 rounded-xl border border-dashed border-ds-border p-3 md:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.name.trim()) return;
            void createRoutine({
              name: draft.name.trim(),
              category_id: draft.category_id,
              start_time: draft.start_time,
              end_time: draft.end_time,
              protected: draft.protected,
              flexible: draft.flexible,
              recurrence: "weekdays",
            }).then(() => {
              setDraft((d) => ({ ...d, name: "" }));
              void reload();
            });
          }}
        >
          <input className={`${inputClass} md:col-span-2`} placeholder="New block name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <select className={inputClass} value={draft.category_id} onChange={(e) => setDraft({ ...draft, category_id: e.target.value })}>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input className={inputClass} type="time" value={draft.start_time} onChange={(e) => setDraft({ ...draft, start_time: e.target.value })} />
          <input className={inputClass} type="time" value={draft.end_time} onChange={(e) => setDraft({ ...draft, end_time: e.target.value })} />
          <div className="md:col-span-5 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={draft.protected} onChange={(e) => setDraft({ ...draft, protected: e.target.checked })} />
              Protected
            </label>
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={draft.flexible} onChange={(e) => setDraft({ ...draft, flexible: e.target.checked })} />
              Flexible
            </label>
            <button type="submit" className={btnPrimary}>
              Add routine block
            </button>
          </div>
        </form>
      </PageBody>
    </div>
  );
}
