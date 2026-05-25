"use client";

import { CalendarDays } from "lucide-react";

import type { DashboardWidgetRenderContext } from "@/lib/dashboard/render-context";
import { opsWidgetFillLayout } from "@/lib/dashboard/ops-widget-fill";
import { cn } from "@/lib/cn";

const IMPORTANT_DATES_DEMO: {
  label: string;
  dateLabel: string;
  tone: "neutral" | "accent";
}[] = [
  { label: "Staff Meeting", dateLabel: "May 27th", tone: "accent" },
  { label: "Earthquake Drill", dateLabel: "May 29th", tone: "neutral" },
  { label: "Performance Reviews", dateLabel: "June 4th", tone: "neutral" },
  { label: "Capital Planning Meeting", dateLabel: "June 9th", tone: "neutral" },
];

/**
 * Manager-calendar style milestones (demo data until a live calendar feed exists).
 */
export function ImportantDatesOpsWidget({
  layoutContext,
}: {
  layoutContext?: DashboardWidgetRenderContext | null;
}) {
  const fillRows = opsWidgetFillLayout(layoutContext?.heightTier);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <div className="ops-dash-inner-card flex min-h-0 flex-1 flex-col gap-[3px]">
        <div
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-md bg-[color-mix(in_srgb,var(--ds-text-primary)_5%,transparent)] px-2 font-semibold text-[color-mix(in_srgb,var(--ds-text-primary)_55%,transparent)]",
            fillRows ? "py-1.5 text-[11px]" : "py-1 text-[10px]",
          )}
        >
          <CalendarDays className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
          <span>Synced to manager calendar</span>
        </div>

        <ul
          className={cn(
            "flex min-h-0 flex-1 flex-col",
            fillRows ? "justify-evenly gap-1.5" : "gap-1.5 overflow-y-auto pr-0.5",
          )}
        >
          {IMPORTANT_DATES_DEMO.map((row) => (
            <li
              key={row.label}
              className={cn(
                "flex min-h-0 items-center justify-between gap-3 rounded-lg px-2.5",
                fillRows ? "shrink-0 py-2" : "shrink-0 py-2",
                row.tone === "accent"
                  ? "bg-[color-mix(in_srgb,var(--ds-accent)_14%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--ds-accent)_28%,transparent)]"
                  : "bg-[color-mix(in_srgb,var(--ds-text-primary)_4%,transparent)]",
              )}
            >
              <span
                className={cn(
                  "min-w-0 flex-1 font-semibold leading-snug text-[color-mix(in_srgb,var(--ds-text-primary)_92%,transparent)]",
                  fillRows ? "text-sm" : "text-xs",
                )}
              >
                {row.label}
              </span>
              <span
                className={cn(
                  "shrink-0 font-bold text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]",
                  fillRows ? "text-xs" : "text-[11px]",
                )}
              >
                {row.dateLabel}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
