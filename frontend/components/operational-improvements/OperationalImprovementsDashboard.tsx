"use client";

import type { OperationalImprovementStats } from "@/lib/operational-improvements/types";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/lib/operational-improvements/labels";
import { PrioritizationMatrixPreview } from "@/components/operational-improvements/PrioritizationPanel";
import { LEAN_WASTE_TYPES } from "@/lib/operational-improvements/analysis-defaults";

type Props = {
  stats: OperationalImprovementStats | null;
};

function wasteLabel(key: string): string {
  return LEAN_WASTE_TYPES.find((w) => w.key === key)?.label ?? key;
}

export function OperationalImprovementsDashboard({ stats }: Props) {
  if (!stats) {
    return (
      <p className="rounded-lg border border-dashed border-ds-border px-4 py-8 text-center text-sm text-ds-muted">
        Dashboard metrics will appear once opportunities are logged.
      </p>
    );
  }

  const cards = [
    { label: "Open improvements", value: stats.open_count },
    { label: "Completion rate", value: `${Math.round(stats.completion_rate * 100)}%` },
    { label: "Quick wins done", value: stats.quick_wins_completed },
    { label: "Knowledge base", value: stats.knowledge_base_count },
    { label: "Est. savings", value: stats.estimated_savings_total ? `$${stats.estimated_savings_total.toLocaleString()}` : "—" },
    { label: "Awaiting review", value: stats.awaiting_review_count },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-ds-border bg-ds-primary p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">{c.label}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-ds-foreground">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-ds-border bg-ds-primary p-4">
          <h3 className="text-sm font-bold text-ds-foreground">Prioritization matrix</h3>
          <div className="mt-3">
            <PrioritizationMatrixPreview counts={stats.by_prioritization_quadrant} />
          </div>
        </section>
        <section className="rounded-xl border border-ds-border bg-ds-primary p-4">
          <h3 className="text-sm font-bold text-ds-foreground">Open by department</h3>
          <ul className="mt-3 space-y-2">
            {Object.entries(stats.open_by_department).length === 0 ? (
              <li className="text-sm text-ds-muted">No open items by department.</li>
            ) : (
              Object.entries(stats.open_by_department).map(([dept, count]) => (
                <li key={dept} className="flex justify-between text-sm">
                  <span className="text-ds-muted">{dept}</span>
                  <span className="font-semibold tabular-nums">{count}</span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-ds-border bg-ds-primary p-4">
          <h3 className="text-sm font-bold text-ds-foreground">Top recurring root causes</h3>
          <ul className="mt-3 space-y-2">
            {stats.top_root_causes.length === 0 ? (
              <li className="text-sm text-ds-muted">Complete 5 Whys or fishbone analyses to populate.</li>
            ) : (
              stats.top_root_causes.map((r) => (
                <li key={r.label} className="text-sm">
                  <span className="text-ds-foreground">{r.label}</span>
                  <span className="ml-2 text-ds-muted">×{r.count}</span>
                </li>
              ))
            )}
          </ul>
        </section>
        <section className="rounded-xl border border-ds-border bg-ds-primary p-4">
          <h3 className="text-sm font-bold text-ds-foreground">Most common waste categories</h3>
          <ul className="mt-3 space-y-2">
            {stats.top_waste_categories.length === 0 ? (
              <li className="text-sm text-ds-muted">Add lean waste analyses to track waste patterns.</li>
            ) : (
              stats.top_waste_categories.map((w) => (
                <li key={w.label} className="flex justify-between text-sm">
                  <span className="text-ds-muted">{wasteLabel(w.label)}</span>
                  <span className="font-semibold tabular-nums">{w.count}</span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-ds-border bg-ds-primary p-4">
          <h3 className="text-sm font-bold text-ds-foreground">By status</h3>
          <ul className="mt-3 space-y-2">
            {Object.entries(stats.by_status).map(([key, count]) => (
              <li key={key} className="flex items-center justify-between text-sm">
                <span className="text-ds-muted">{STATUS_LABELS[key as keyof typeof STATUS_LABELS] ?? key}</span>
                <span className="font-semibold tabular-nums text-ds-foreground">{count}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border border-ds-border bg-ds-primary p-4">
          <h3 className="text-sm font-bold text-ds-foreground">By category</h3>
          <ul className="mt-3 space-y-2">
            {Object.entries(stats.by_category).map(([key, count]) => (
              <li key={key} className="flex items-center justify-between text-sm">
                <span className="text-ds-muted">{CATEGORY_LABELS[key as keyof typeof CATEGORY_LABELS] ?? key}</span>
                <span className="font-semibold tabular-nums text-ds-foreground">{count}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
