"use client";

import { FileBarChart } from "lucide-react";

export function ScheduleReports() {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center shadow-sm dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-500 dark:bg-[#0F172A] dark:text-gray-400">
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
