"use client";

import { FileBarChart } from "lucide-react";

export function ScheduleReports() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-pulse-muted">
        <FileBarChart className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-pulse-navy">Reports</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-pulse-muted">
        Utilization exports, labor variance, and audit trails will appear here. This area is reserved for the next
        milestone.
      </p>
    </div>
  );
}
