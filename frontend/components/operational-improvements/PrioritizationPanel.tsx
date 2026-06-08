"use client";

import { useEffect, useState } from "react";
import {
  QUADRANT_DESCRIPTIONS,
  QUADRANT_LABELS,
  enrichPrioritization,
  type PrioritizationQuadrant,
  type PrioritizationScores,
} from "@/lib/operational-improvements/prioritization";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

const FIELD =
  "mt-1 w-full rounded-[10px] border border-slate-200/90 bg-white px-3 py-2 text-sm shadow-sm dark:border-ds-border dark:bg-ds-secondary dark:text-ds-foreground";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-ds-muted";
const PRIMARY = cn(buttonVariants({ surface: "light", intent: "accent" }), "px-3 py-2 text-sm font-bold");

type Props = {
  value: PrioritizationScores | null;
  disabled?: boolean;
  onSave: (scores: PrioritizationScores) => Promise<void>;
};

function ScoreSlider({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className={LABEL}>{label}</label>
        <span className="text-sm font-bold tabular-nums text-ds-foreground">{value}</span>
      </div>
      <input type="range" min={1} max={5} step={1} disabled={disabled} value={value} className="mt-2 w-full" onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

export function PrioritizationPanel({ value, disabled, onSave }: Props) {
  const [draft, setDraft] = useState<PrioritizationScores>(value ?? { impact: 3, effort: 3, risk: 3 });
  useEffect(() => {
    if (value) setDraft(value);
  }, [value]);
  const enriched = enrichPrioritization(draft);
  const quadrant = (enriched.quadrant ?? "low_priority") as Exclude<PrioritizationQuadrant, "unscored">;

  return (
    <div className="space-y-4 rounded-xl border border-ds-border bg-ds-primary p-4">
      <div>
        <h3 className="text-sm font-bold text-ds-foreground">Impact / effort prioritization</h3>
        <p className="mt-1 text-sm text-ds-muted">Score the opportunity to place it on the improvement matrix.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <ScoreSlider label="Impact" value={draft.impact} disabled={disabled} onChange={(impact) => setDraft((d) => ({ ...d, impact }))} />
        <ScoreSlider label="Effort" value={draft.effort} disabled={disabled} onChange={(effort) => setDraft((d) => ({ ...d, effort }))} />
        <ScoreSlider label="Risk" value={draft.risk} disabled={disabled} onChange={(risk) => setDraft((d) => ({ ...d, risk }))} />
      </div>
      <div className="rounded-lg bg-ds-secondary/60 px-3 py-2">
        <p className="text-xs font-bold uppercase tracking-wider text-ds-accent">{QUADRANT_LABELS[quadrant]}</p>
        <p className="mt-1 text-sm text-ds-muted">{QUADRANT_DESCRIPTIONS[quadrant]}</p>
      </div>
      {!disabled ? (
        <button type="button" className={PRIMARY} onClick={() => void onSave(enrichPrioritization(draft))}>
          Save prioritization
        </button>
      ) : null}
    </div>
  );
}

export function PrioritizationMatrixPreview({
  counts,
}: {
  counts: Record<string, number>;
}) {
  const cells = [
    { key: "quick_win", className: "bg-emerald-50 dark:bg-emerald-950/30" },
    { key: "major_project", className: "bg-sky-50 dark:bg-sky-950/30" },
    { key: "fill_in", className: "bg-amber-50 dark:bg-amber-950/30" },
    { key: "low_priority", className: "bg-slate-50 dark:bg-slate-900/40" },
  ] as const;
  return (
    <div className="grid grid-cols-2 gap-2">
      {cells.map(({ key, className }) => (
        <div key={key} className={cn("rounded-lg border border-ds-border p-3", className)}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-ds-muted">{QUADRANT_LABELS[key]}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-ds-foreground">{counts[key] ?? 0}</p>
        </div>
      ))}
    </div>
  );
}
