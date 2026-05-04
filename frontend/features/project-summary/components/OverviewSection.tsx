import { Card } from "@/components/pulse/Card";
import type { SummaryOverview } from "../types";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = iso.slice(0, 10);
  return d || "—";
}

function successLabel(flag: boolean | null | undefined): { text: string; className: string } {
  if (flag === true) return { text: "On track signal", className: "bg-emerald-500/15 text-emerald-800 ring-emerald-500/25 dark:text-emerald-200" };
  if (flag === false) return { text: "Needs attention", className: "bg-amber-500/15 text-amber-900 ring-amber-500/25 dark:text-amber-100" };
  return { text: "Mixed / insufficient data", className: "bg-ds-secondary text-ds-muted ring-ds-border" };
}

const ROW = "flex flex-wrap justify-between gap-2 border-b border-ds-border py-2.5 text-sm last:border-0";
const LABEL = "font-medium text-ds-muted";
const VALUE = "text-right text-ds-foreground";

export function OverviewSection({ overview }: { overview: SummaryOverview }) {
  const badge = successLabel(overview.success_flag);
  return (
    <Card padding="md" variant="secondary" className="h-full">
      <h2 className="text-sm font-bold text-ds-foreground">Overview</h2>
      <p className="mt-0.5 text-xs text-ds-muted">Auto-filled from project records.</p>
      <dl className="mt-4 divide-y divide-ds-border rounded-lg border border-ds-border bg-ds-primary px-3 dark:bg-ds-elevated">
        <div className={ROW}>
          <dt className={LABEL}>Project</dt>
          <dd className={`${VALUE} max-w-[65%]`}>{overview.project_name || "—"}</dd>
        </div>
        <div className={ROW}>
          <dt className={LABEL}>Type</dt>
          <dd className={VALUE}>{overview.project_type || "—"}</dd>
        </div>
        <div className={ROW}>
          <dt className={LABEL}>Owner</dt>
          <dd className={VALUE}>{overview.owner || "—"}</dd>
        </div>
        <div className={ROW}>
          <dt className={LABEL}>Start</dt>
          <dd className={VALUE}>{formatDate(overview.start_date)}</dd>
        </div>
        <div className={ROW}>
          <dt className={LABEL}>End</dt>
          <dd className={VALUE}>{formatDate(overview.end_date)}</dd>
        </div>
        <div className={`${ROW} items-center`}>
          <dt className={LABEL}>Delivery signal</dt>
          <dd>
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${badge.className}`}>
              {badge.text}
            </span>
          </dd>
        </div>
      </dl>
    </Card>
  );
}
