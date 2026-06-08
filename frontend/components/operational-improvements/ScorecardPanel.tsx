"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { ScorecardMetric } from "@/lib/operational-improvements/types";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

const FIELD =
  "mt-1 w-full rounded-[10px] border border-slate-200/90 bg-white px-3 py-2 text-sm shadow-sm dark:border-ds-border dark:bg-ds-secondary dark:text-ds-foreground";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-ds-muted";
const PRIMARY = cn(buttonVariants({ surface: "light", intent: "accent" }), "px-3 py-2 text-sm font-bold");
const GHOST = cn(buttonVariants({ surface: "light", intent: "secondary" }), "inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold");

const METRIC_PRESETS = [
  "Cost",
  "Time",
  "Labor hours",
  "Stockouts",
  "Defects",
  "Downtime",
  "Response time",
  "Lead time",
  "Customer satisfaction",
];

type Props = {
  metrics: ScorecardMetric[];
  estimatedSavings?: string;
  disabled?: boolean;
  onSave: (metrics: ScorecardMetric[], estimatedSavings: string) => Promise<void>;
};

export function ScorecardPanel({ metrics, estimatedSavings = "", disabled, onSave }: Props) {
  const [rows, setRows] = useState<ScorecardMetric[]>(metrics);
  const [savings, setSavings] = useState(estimatedSavings);
  useEffect(() => {
    setRows(metrics);
    setSavings(estimatedSavings);
  }, [metrics, estimatedSavings]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-ds-muted">Track baseline → target → actual for each metric that proves the improvement worked.</p>
      <div className="space-y-3">
        {rows.map((m, i) => (
          <div key={m.id} className="rounded-lg border border-ds-border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="grid flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="sm:col-span-2">
                  <label className={LABEL}>Metric</label>
                  <input className={FIELD} disabled={disabled} value={m.label} list="oi-metric-presets" onChange={(e) => { const next = [...rows]; next[i] = { ...m, label: e.target.value }; setRows(next); }} />
                </div>
                <div>
                  <label className={LABEL}>Baseline</label>
                  <input className={FIELD} disabled={disabled} value={m.baseline} onChange={(e) => { const next = [...rows]; next[i] = { ...m, baseline: e.target.value }; setRows(next); }} />
                </div>
                <div>
                  <label className={LABEL}>Target</label>
                  <input className={FIELD} disabled={disabled} value={m.target} onChange={(e) => { const next = [...rows]; next[i] = { ...m, target: e.target.value }; setRows(next); }} />
                </div>
                <div>
                  <label className={LABEL}>Actual</label>
                  <input className={FIELD} disabled={disabled} value={m.actual} onChange={(e) => { const next = [...rows]; next[i] = { ...m, actual: e.target.value }; setRows(next); }} />
                </div>
                <div>
                  <label className={LABEL}>Unit</label>
                  <input className={FIELD} disabled={disabled} value={m.unit ?? ""} onChange={(e) => { const next = [...rows]; next[i] = { ...m, unit: e.target.value }; setRows(next); }} />
                </div>
              </div>
              {!disabled ? (
                <button type="button" className={GHOST} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </div>
            {(m.baseline || m.actual) && (
              <p className="mt-2 text-xs text-ds-muted">
                {m.baseline ? `Was: ${m.baseline}${m.unit ? ` ${m.unit}` : ""}` : ""}
                {m.actual ? ` → Now: ${m.actual}${m.unit ? ` ${m.unit}` : ""}` : ""}
              </p>
            )}
          </div>
        ))}
      </div>
      <datalist id="oi-metric-presets">
        {METRIC_PRESETS.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      {!disabled ? (
        <button
          type="button"
          className={GHOST}
          onClick={() =>
            setRows([
              ...rows,
              { id: `m-${Date.now()}`, label: "", metric_key: "", baseline: "", target: "", actual: "", unit: "" },
            ])
          }
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add metric
        </button>
      ) : null}
      <div>
        <label className={LABEL}>Estimated savings ($ optional)</label>
        <input className={FIELD} disabled={disabled} value={savings} onChange={(e) => setSavings(e.target.value)} placeholder="e.g. 12000" />
      </div>
      {!disabled ? (
        <button type="button" className={PRIMARY} onClick={() => void onSave(rows, savings)}>
          Save scorecard
        </button>
      ) : null}
    </div>
  );
}
