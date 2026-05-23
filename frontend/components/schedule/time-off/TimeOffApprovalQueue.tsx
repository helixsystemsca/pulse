"use client";

import { useMemo } from "react";
import { AlertTriangle, Check, X } from "lucide-react";
import { assessSelectionWarnings } from "@/lib/schedule/time-off-calendar";
import {
  expandBlockDates,
  formatDatesSummary,
  timeOffKindLabel,
} from "@/lib/schedule/time-off-request";
import type { ProjectScheduleOverlayMeta } from "@/lib/schedule/project-overlay-styles";
import type { ScheduleSettings, Shift, TimeOffBlock, Worker } from "@/lib/schedule/types";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

type Props = {
  blocks: TimeOffBlock[];
  workers: Worker[];
  shifts: Shift[];
  settings: ScheduleSettings;
  projects: readonly ProjectScheduleOverlayMeta[];
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
  onNeedsReview: (id: string) => void;
};

export function TimeOffApprovalQueue({
  blocks,
  workers,
  shifts,
  settings,
  projects,
  onApprove,
  onDeny,
  onNeedsReview,
}: Props) {
  const workerMap = useMemo(() => new Map(workers.map((w) => [w.id, w.name])), [workers]);

  const pending = useMemo(
    () =>
      [...blocks]
        .filter((b) => b.status === "pending" || b.status === "needs_review")
        .sort((a, b) => (a.submittedAt ?? "").localeCompare(b.submittedAt ?? "")),
    [blocks],
  );

  if (!pending.length) {
    return (
      <p className="rounded-lg border border-dashed border-pulseShell-border px-3 py-6 text-center text-sm text-pulse-muted">
        No requests awaiting review.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {pending.map((b) => {
        const dates = expandBlockDates(b);
        const warnings = assessSelectionWarnings(
          b.workerId,
          dates,
          projects,
          shifts,
          workers,
          settings,
          blocks.filter((x) => x.id !== b.id),
        );
        return (
          <li
            key={b.id}
            className="rounded-xl border border-pulseShell-border bg-pulseShell-surface px-3 py-3 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {workerMap.get(b.workerId) ?? "Worker"}
                </p>
                <p className="text-xs text-pulse-muted">
                  {timeOffKindLabel(b.kind)} · {formatDatesSummary(dates)}
                </p>
              </div>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                {b.status === "needs_review" ? "Needs review" : "Pending"}
              </span>
            </div>

            {warnings.length > 0 ? (
              <div className="mt-2 rounded-lg border border-amber-200/80 bg-amber-50/80 px-2.5 py-2 dark:border-amber-900/40 dark:bg-amber-950/30">
                <div className="flex gap-1.5 text-xs text-amber-950 dark:text-amber-100">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  <ul className="space-y-0.5">
                    {warnings.slice(0, 3).map((w) => (
                      <li key={`${w.code}-${w.message}`}>{w.message}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}

            {b.note ? <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">{b.note}</p> : null}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={cn(buttonVariants({ surface: "light", intent: "accent" }), "inline-flex items-center gap-1 px-3 py-1.5 text-xs")}
                onClick={() => onApprove(b.id)}
              >
                <Check className="h-3.5 w-3.5" />
                Approve
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg border border-pulseShell-border px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                onClick={() => onNeedsReview(b.id)}
              >
                Needs review
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-950/40"
                onClick={() => onDeny(b.id)}
              >
                <X className="h-3.5 w-3.5" />
                Deny
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
