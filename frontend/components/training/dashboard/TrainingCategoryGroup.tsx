"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import type { MatrixCategoryGroup } from "@/lib/training/dashboardMetrics";
import { cn } from "@/lib/cn";

export function TrainingCategoryGroupToolbar({
  groups,
  collapsed,
  onToggle,
}: {
  groups: MatrixCategoryGroup[];
  collapsed: Record<string, boolean>;
  onToggle: (groupId: string) => void;
}) {
  if (groups.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label="Training column groups">
      {groups.map((g) => {
        const isCollapsed = Boolean(collapsed[g.id]);
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => onToggle(g.id)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
              isCollapsed
                ? "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                : "border-teal-200/80 bg-teal-50 text-teal-900 dark:border-teal-500/30 dark:bg-teal-950/40 dark:text-teal-100",
            )}
          >
            {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" aria-hidden /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden />}
            {g.label}
            <span className="tabular-nums opacity-70">({g.programs.length})</span>
          </button>
        );
      })}
    </div>
  );
}
