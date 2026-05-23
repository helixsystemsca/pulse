"use client";

import { ClipboardList } from "lucide-react";

/** Shown when daily assignment tools require a published schedule. */
export function AssignmentsLockedNotice({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border border-amber-200/90 bg-amber-50/80 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100 ${className}`}
      role="status"
    >
      <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 opacity-80" aria-hidden />
      <p>
        <span className="font-semibold">Assignments become available after schedule publication.</span> Finish
        generating, saving, and publishing the monthly schedule before assigning routines and near-term work.
      </p>
    </div>
  );
}
