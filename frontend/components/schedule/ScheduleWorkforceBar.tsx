"use client";

import type { WorkforceSummary } from "@/lib/schedule/types";

export function ScheduleWorkforceBar({ summary }: { summary: WorkforceSummary }) {
  return (
    <div className="sticky bottom-0 z-20 mt-4 border-t border-pulseShell-border bg-pulseShell-surface/95 py-3 shadow-[0_-4px_24px_rgba(15,23,42,0.06)] backdrop-blur-md dark:shadow-[0_-4px_24px_rgba(0,0,0,0.35)]">
      <div className="flex w-full flex-wrap items-center justify-between gap-4 text-sm">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Active workers</p>
            <p className="mt-0.5 font-semibold tabular-nums text-gray-900 dark:text-gray-100">
              {summary.activeWorkers}
              <span className="font-normal text-gray-500 dark:text-gray-400"> / {summary.activeTarget}</span>
            </p>
          </div>
          <div className="h-8 w-px bg-pulseShell-border" aria-hidden />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">OT risk</p>
            <p
              className={`mt-0.5 font-semibold tabular-nums ${
                summary.otRiskLabel === "Elevated"
                  ? "text-red-700 dark:text-red-400"
                  : summary.otRiskLabel === "Moderate"
                    ? "text-amber-800 dark:text-amber-300"
                    : summary.otRiskLabel === "Low"
                      ? "text-emerald-800 dark:text-emerald-400"
                      : "text-gray-700 dark:text-gray-300"
              }`}
            >
              {summary.otRiskLabel === "None" || summary.otRiskLabel === "Low"
                ? "No OT risk"
                : summary.otRiskLabel}
            </p>
          </div>
          <div className="h-8 w-px bg-pulseShell-border" aria-hidden />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Fill rate</p>
            <p className="mt-0.5 font-semibold tabular-nums text-gray-900 dark:text-gray-100">{summary.fillPercent}%</p>
          </div>
          <div className="h-8 w-px bg-pulseShell-border" aria-hidden />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Requests</p>
            <p className="mt-0.5 font-semibold tabular-nums text-gray-900 dark:text-gray-100">{summary.pendingRequests} pending</p>
          </div>
        </div>
      </div>
    </div>
  );
}
