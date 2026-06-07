"use client";

import type { OperationalImprovementStats } from "@/lib/operational-improvements/types";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/lib/operational-improvements/labels";

type Props = {
  stats: OperationalImprovementStats | null;
};

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
    { label: "Completed", value: stats.completed_count },
    { label: "Awaiting review", value: stats.awaiting_review_count },
    { label: "High-impact open", value: stats.high_impact_open },
  ];

  const topCategories = Object.entries(stats.by_category)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const topStatuses = Object.entries(stats.by_status).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-ds-border bg-ds-primary p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">{c.label}</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-ds-foreground">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-ds-border bg-ds-primary p-4">
          <h3 className="text-sm font-bold text-ds-foreground">By status</h3>
          <ul className="mt-3 space-y-2">
            {topStatuses.map(([key, count]) => (
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
            {topCategories.map(([key, count]) => (
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
