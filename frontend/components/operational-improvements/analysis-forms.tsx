"use client";

import { ArrowDown, Plus, Trash2 } from "lucide-react";
import { LEAN_WASTE_TYPES, FISHBONE_CATEGORIES } from "@/lib/operational-improvements/analysis-defaults";
import {
  computeValueStreamTotals,
  emptyValueStreamStep,
  type ValueStreamMapData,
  type ValueStreamStep,
} from "@/lib/operational-improvements/value-stream";
import { cn } from "@/lib/cn";

const FIELD =
  "mt-1 w-full rounded-[10px] border border-slate-200/90 bg-white px-3 py-2 text-sm shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25 dark:border-ds-border dark:bg-ds-secondary dark:text-ds-foreground";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-ds-muted";

type FormProps = {
  data: Record<string, unknown>;
  disabled?: boolean;
  onChange: (data: Record<string, unknown>) => void;
};

export function FiveWhysForm({ data, disabled, onChange }: FormProps) {
  const whys = (data.whys as string[]) ?? ["", "", "", "", ""];
  const set = (patch: Record<string, unknown>) => onChange({ ...data, ...patch });
  return (
    <div className="space-y-3">
      <div>
        <label className={LABEL}>Problem statement</label>
        <textarea
          className={cn(FIELD, "min-h-[64px]")}
          disabled={disabled}
          value={String(data.problem_statement ?? "")}
          onChange={(e) => set({ problem_statement: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        {whys.map((why, i) => (
          <div key={i} className="relative pl-4">
            {i > 0 ? <ArrowDown className="absolute left-0 top-3 h-3 w-3 text-ds-muted" aria-hidden /> : null}
            <label className={LABEL}>Why #{i + 1}</label>
            <textarea
              className={cn(FIELD, "min-h-[52px]")}
              disabled={disabled}
              value={why}
              onChange={(e) => {
                const next = [...whys];
                next[i] = e.target.value;
                set({ whys: next });
              }}
            />
          </div>
        ))}
      </div>
      <div>
        <label className={LABEL}>Root cause</label>
        <textarea className={cn(FIELD, "min-h-[52px]")} disabled={disabled} value={String(data.root_cause ?? "")} onChange={(e) => set({ root_cause: e.target.value })} />
      </div>
      <div>
        <label className={LABEL}>Contributing factors</label>
        <textarea className={cn(FIELD, "min-h-[52px]")} disabled={disabled} value={String(data.contributing_factors ?? "")} onChange={(e) => set({ contributing_factors: e.target.value })} />
      </div>
      <div>
        <label className={LABEL}>Lessons learned</label>
        <textarea className={cn(FIELD, "min-h-[52px]")} disabled={disabled} value={String(data.lessons_learned ?? "")} onChange={(e) => set({ lessons_learned: e.target.value })} />
      </div>
    </div>
  );
}

export function FishboneForm({ data, disabled, onChange }: FormProps) {
  const categories = (data.categories as Record<string, string[]>) ?? {};
  const set = (patch: Record<string, unknown>) => onChange({ ...data, ...patch });
  return (
    <div className="space-y-3">
      <div>
        <label className={LABEL}>Problem statement</label>
        <textarea className={cn(FIELD, "min-h-[64px]")} disabled={disabled} value={String(data.problem_statement ?? "")} onChange={(e) => set({ problem_statement: e.target.value })} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {FISHBONE_CATEGORIES.map((cat) => {
          const items = categories[cat] ?? [];
          return (
            <div key={cat} className="rounded-lg border border-ds-border bg-ds-primary p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-ds-accent">{cat}</p>
              <ul className="mt-2 space-y-2">
                {items.map((item, idx) => (
                  <li key={idx} className="flex gap-1">
                    <input
                      className={FIELD}
                      disabled={disabled}
                      value={item}
                      onChange={(e) => {
                        const next = { ...categories, [cat]: [...items] };
                        next[cat][idx] = e.target.value;
                        set({ categories: next });
                      }}
                    />
                    {!disabled ? (
                      <button
                        type="button"
                        className="shrink-0 rounded p-2 text-ds-muted hover:text-red-600"
                        onClick={() => {
                          const next = { ...categories, [cat]: items.filter((_, j) => j !== idx) };
                          set({ categories: next });
                        }}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
              {!disabled ? (
                <button
                  type="button"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-ds-accent"
                  onClick={() => set({ categories: { ...categories, [cat]: [...items, ""] } })}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Add cause
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LeanWasteForm({ data, disabled, onChange }: FormProps) {
  const wastes = (data.wastes as Array<Record<string, string>>) ?? [];
  const setWastes = (next: Array<Record<string, string>>) => onChange({ ...data, wastes: next });
  return (
    <div className="space-y-3">
      <p className="text-sm text-ds-muted">Identify lean wastes — each row is an improvement opportunity.</p>
      {wastes.map((w, i) => (
        <div key={i} className="rounded-lg border border-ds-border p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className={LABEL}>Waste type</label>
              <select
                className={FIELD}
                disabled={disabled}
                value={w.waste_type ?? ""}
                onChange={(e) => {
                  const next = [...wastes];
                  next[i] = { ...w, waste_type: e.target.value };
                  setWastes(next);
                }}
              >
                <option value="">Select…</option>
                {LEAN_WASTE_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Severity (1-5)</label>
              <input className={FIELD} disabled={disabled} value={w.severity ?? ""} onChange={(e) => { const next = [...wastes]; next[i] = { ...w, severity: e.target.value }; setWastes(next); }} />
            </div>
          </div>
          <div className="mt-2">
            <label className={LABEL}>Description</label>
            <textarea className={cn(FIELD, "min-h-[52px]")} disabled={disabled} value={w.description ?? ""} onChange={(e) => { const next = [...wastes]; next[i] = { ...w, description: e.target.value }; setWastes(next); }} />
          </div>
          <div className="mt-2">
            <label className={LABEL}>Impact</label>
            <input className={FIELD} disabled={disabled} value={w.impact ?? ""} onChange={(e) => { const next = [...wastes]; next[i] = { ...w, impact: e.target.value }; setWastes(next); }} />
          </div>
          <div className="mt-2">
            <label className={LABEL}>Suggested improvement</label>
            <textarea className={cn(FIELD, "min-h-[52px]")} disabled={disabled} value={w.suggested_improvement ?? ""} onChange={(e) => { const next = [...wastes]; next[i] = { ...w, suggested_improvement: e.target.value }; setWastes(next); }} />
          </div>
        </div>
      ))}
      {!disabled ? (
        <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold text-ds-accent" onClick={() => setWastes([...wastes, { waste_type: "", description: "", impact: "", severity: "", suggested_improvement: "" }])}>
          <Plus className="h-4 w-4" aria-hidden />
          Add waste
        </button>
      ) : null}
    </div>
  );
}

function ValueStreamStepsEditor({
  label,
  map,
  disabled,
  onChange,
}: {
  label: string;
  map: ValueStreamMapData;
  disabled?: boolean;
  onChange: (map: ValueStreamMapData) => void;
}) {
  const totals = computeValueStreamTotals(map.steps);
  const updateStep = (idx: number, patch: Partial<ValueStreamStep>) => {
    const steps = map.steps.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onChange({ ...map, steps });
  };
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-bold text-ds-foreground">{label}</h4>
      <div className="grid grid-cols-2 gap-2 rounded-lg bg-ds-secondary/50 p-3 text-xs sm:grid-cols-4">
        <div><span className="text-ds-muted">Cycle</span><p className="font-bold tabular-nums">{totals.totalCycle} min</p></div>
        <div><span className="text-ds-muted">Wait</span><p className="font-bold tabular-nums">{totals.totalWait} min</p></div>
        <div><span className="text-ds-muted">Value-added</span><p className="font-bold tabular-nums">{totals.valueAdded} min</p></div>
        <div><span className="text-ds-muted">Non-value</span><p className="font-bold tabular-nums">{totals.nonValueAdded} min</p></div>
      </div>
      <div className="space-y-2">
        {map.steps.map((step, idx) => (
          <div key={step.id} className="rounded-lg border border-ds-border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase text-ds-muted">Step {idx + 1}</span>
              {!disabled && map.steps.length > 1 ? (
                <button type="button" className="text-ds-muted hover:text-red-600" onClick={() => onChange({ ...map, steps: map.steps.filter((_, i) => i !== idx) })}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input className={FIELD} placeholder="Step name" disabled={disabled} value={step.step_name} onChange={(e) => updateStep(idx, { step_name: e.target.value })} />
              <input className={FIELD} placeholder="Responsible party" disabled={disabled} value={step.responsible_party} onChange={(e) => updateStep(idx, { responsible_party: e.target.value })} />
              <input className={FIELD} placeholder="Cycle time (min)" disabled={disabled} value={step.cycle_time_minutes} onChange={(e) => updateStep(idx, { cycle_time_minutes: e.target.value })} />
              <input className={FIELD} placeholder="Wait time (min)" disabled={disabled} value={step.wait_time_minutes} onChange={(e) => updateStep(idx, { wait_time_minutes: e.target.value })} />
            </div>
            <textarea className={cn(FIELD, "mt-2 min-h-[44px]")} placeholder="Description" disabled={disabled} value={step.description} onChange={(e) => updateStep(idx, { description: e.target.value })} />
            <textarea className={cn(FIELD, "mt-2 min-h-[44px]")} placeholder="Pain points" disabled={disabled} value={step.pain_points} onChange={(e) => updateStep(idx, { pain_points: e.target.value })} />
            <select className={cn(FIELD, "mt-2")} disabled={disabled} value={step.value_added} onChange={(e) => updateStep(idx, { value_added: e.target.value as ValueStreamStep["value_added"] })}>
              <option value="">Value added?</option>
              <option value="yes">Yes — value added</option>
              <option value="no">No — non-value added</option>
            </select>
          </div>
        ))}
      </div>
      {!disabled ? (
        <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold text-ds-accent" onClick={() => onChange({ ...map, steps: [...map.steps, emptyValueStreamStep()] })}>
          <Plus className="h-4 w-4" aria-hidden />
          Add step
        </button>
      ) : null}
    </div>
  );
}

export function ValueStreamMapForm({ data, disabled, onChange }: FormProps) {
  const current = (data.current as ValueStreamMapData) ?? { map_type: "current", steps: [emptyValueStreamStep()] };
  const future = (data.future as ValueStreamMapData) ?? { map_type: "future", steps: [emptyValueStreamStep()] };
  return (
    <div className="space-y-6">
      <ValueStreamStepsEditor
        label="Current state"
        map={current}
        disabled={disabled}
        onChange={(m) => onChange({ ...data, current: m })}
      />
      <ValueStreamStepsEditor
        label="Future state"
        map={future}
        disabled={disabled}
        onChange={(m) => onChange({ ...data, future: m })}
      />
    </div>
  );
}

export function GuidedAnalysisEditor({ analysisType, data, disabled, onChange }: FormProps & { analysisType: string }) {
  switch (analysisType) {
    case "root_cause_5_whys":
      return <FiveWhysForm data={data} disabled={disabled} onChange={onChange} />;
    case "fishbone":
      return <FishboneForm data={data} disabled={disabled} onChange={onChange} />;
    case "lean_waste":
      return <LeanWasteForm data={data} disabled={disabled} onChange={onChange} />;
    case "value_stream_map":
      return <ValueStreamMapForm data={data} disabled={disabled} onChange={onChange} />;
    default:
      return (
        <textarea
          className={cn(FIELD, "min-h-[160px] font-mono text-xs")}
          disabled={disabled}
          value={JSON.stringify(data, null, 2)}
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value) as Record<string, unknown>);
            } catch {
              /* ignore while typing */
            }
          }}
        />
      );
  }
}
