"use client";

import { FileBarChart } from "lucide-react";

export function ScheduleReports() {
  return (
    <div className="rounded-md border border-dashed border-pulseShell-border bg-pulseShell-surface p-10 text-center shadow-[var(--pulse-shell-shadow)]">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-pulseShell-elevated text-gray-500 dark:text-slate-400">
        <FileBarChart className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">Reports</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
        Utilization exports, labor variance, and audit trails will appear here. This area is reserved for the next
        milestone.
      </p>
    </div>
  );
}
