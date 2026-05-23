"use client";

import {
  expandBlockDates,
  formatDatesSummary,
  timeOffKindLabel,
  timeOffStatusLabel,
} from "@/lib/schedule/time-off-request";
import type { TimeOffBlock, Worker } from "@/lib/schedule/types";
import { cn } from "@/lib/cn";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200",
  approved: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200",
  denied: "bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200",
  needs_review: "bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-200",
};

type Props = {
  blocks: TimeOffBlock[];
  workers: Worker[];
  workerId?: string;
  title?: string;
};

export function TimeOffRequestHistory({ blocks, workers, workerId, title = "Submitted requests" }: Props) {
  const workerMap = new Map(workers.map((w) => [w.id, w.name]));
  const filtered = [...blocks]
    .filter((b) => !workerId || b.workerId === workerId)
    .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-pulse-muted">{title}</h3>
      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-pulseShell-border px-3 py-4 text-center text-sm text-pulse-muted">
          No requests yet.
        </p>
      ) : (
        <ul className="max-h-52 space-y-2 overflow-y-auto pr-1">
          {filtered.map((b) => {
            const dates = expandBlockDates(b);
            const submitted = b.submittedAt ? new Date(b.submittedAt).toLocaleDateString() : "—";
            const updated = b.updatedAt ? new Date(b.updatedAt).toLocaleString() : "—";
            return (
              <li
                key={b.id}
                className="rounded-lg border border-pulseShell-border bg-pulseShell-surface/80 px-3 py-2.5 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {timeOffKindLabel(b.kind)}
                      {!workerId ? (
                        <span className="font-normal text-pulse-muted"> · {workerMap.get(b.workerId) ?? "Worker"}</span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-pulse-muted">{formatDatesSummary(dates)}</p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      STATUS_STYLES[b.status] ?? STATUS_STYLES.pending,
                    )}
                  >
                    {timeOffStatusLabel(b.status)}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] text-pulse-muted">
                  Submitted {submitted} · Updated {updated}
                </p>
                {b.note ? <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{b.note}</p> : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
