"use client";

import type { WorkforceSummary } from "@/lib/schedule/types";

export function ScheduleWorkforceBar({ summary }: { summary: WorkforceSummary }) {
  return (
    <div className="sticky bottom-0 z-20 mt-4 border-t border-slate-200/90 bg-white/95 px-4 py-3 shadow-[0_-4px_24px_rgba(15,23,42,0.06)] backdrop-blur sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 text-sm">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-pulse-muted">Active workers</p>
            <p className="mt-0.5 font-semibold tabular-nums text-pulse-navy">
              {summary.activeWorkers}
              <span className="font-normal text-pulse-muted"> / {summary.activeTarget}</span>
            </p>
          </div>
          <div className="h-8 w-px bg-slate-200/90" aria-hidden />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-pulse-muted">OT risk</p>
            <p
              className={`mt-0.5 font-semibold tabular-nums ${
                summary.otRiskLabel === "Elevated"
                  ? "text-red-700"
                  : summary.otRiskLabel === "Moderate"
                    ? "text-amber-800"
                    : "text-emerald-800"
              }`}
            >
              {summary.otRiskLabel}
            </p>
          </div>
          <div className="h-8 w-px bg-slate-200/90" aria-hidden />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-pulse-muted">Fill rate</p>
            <p className="mt-0.5 font-semibold tabular-nums text-pulse-navy">{summary.fillPercent}%</p>
          </div>
          <div className="h-8 w-px bg-slate-200/90" aria-hidden />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-pulse-muted">Requests</p>
            <p className="mt-0.5 font-semibold tabular-nums text-pulse-navy">{summary.pendingRequests} pending</p>
          </div>
        </div>
      </div>
    </div>
  );
}
