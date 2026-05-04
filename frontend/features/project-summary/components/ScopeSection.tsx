import { Card } from "@/components/pulse/Card";
import type { SummaryScope } from "../types";

const ROW = "flex flex-wrap justify-between gap-2 border-b border-ds-border py-2.5 text-sm last:border-0";
const LABEL = "font-medium text-ds-muted";
const VALUE = "font-semibold tabular-nums text-ds-foreground";

export function ScopeSection({ scope }: { scope: SummaryScope }) {
  const pct =
    scope.planned_tasks > 0 ? Math.round((scope.completed_tasks / scope.planned_tasks) * 100) : scope.completed_tasks > 0 ? 100 : 0;
  return (
    <Card padding="md" variant="secondary" className="h-full">
      <h2 className="text-sm font-bold text-ds-foreground">Scope</h2>
      <p className="mt-0.5 text-xs text-ds-muted">Task counts and recorded scope changes.</p>
      <dl className="mt-4 divide-y divide-ds-border rounded-lg border border-ds-border bg-ds-primary px-3 dark:bg-ds-elevated">
        <div className={ROW}>
          <dt className={LABEL}>Planned tasks</dt>
          <dd className={VALUE}>{scope.planned_tasks}</dd>
        </div>
        <div className={ROW}>
          <dt className={LABEL}>Completed tasks</dt>
          <dd className={VALUE}>{scope.completed_tasks}</dd>
        </div>
        <div className={ROW}>
          <dt className={LABEL}>Completion</dt>
          <dd className={VALUE}>{pct}%</dd>
        </div>
      </dl>
      <div className="mt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Scope changes</p>
        {scope.scope_changes?.length ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ds-foreground">
            {scope.scope_changes.map((line, i) => (
              <li key={`${i}-${line.slice(0, 24)}`}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ds-muted">No scope changes recorded.</p>
        )}
      </div>
    </Card>
  );
}
