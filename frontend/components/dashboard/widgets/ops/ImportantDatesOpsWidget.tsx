"use client";

import { useMemo } from "react";
import { CalendarDays } from "lucide-react";

import type { DashboardWidgetRenderContext } from "@/lib/dashboard/render-context";
import type { WidgetHeightTier } from "@/lib/dashboard/workspace-layout";
import { getServerNow } from "@/lib/serverTime";
import { cn } from "@/lib/cn";

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function formatShort(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function spreadsRows(tier: WidgetHeightTier): boolean {
  return tier === "expanded" || tier === "tall";
}

/**
 * Manager-calendar style milestones (deterministic from server clock until a live calendar feed exists).
 */
export function ImportantDatesOpsWidget({
  layoutContext,
}: {
  layoutContext?: DashboardWidgetRenderContext | null;
}) {
  const tier = layoutContext?.heightTier ?? "medium";
  const fillRows = spreadsRows(tier);

  const items = useMemo(() => {
    const now = new Date(getServerNow());
    return [
      { label: "Facility inspection window", date: addDays(now, 5), tone: "neutral" as const },
      { label: "Chemical delivery", date: addDays(now, 1), tone: "accent" as const },
      { label: "Staff safety stand-up", date: addDays(now, 3), tone: "neutral" as const },
      { label: "Pool vacuum / deep clean", date: addDays(now, 7), tone: "neutral" as const },
    ];
  }, []);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
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
          "mt-1.5 flex min-h-0 flex-1 flex-col",
          fillRows ? "justify-between gap-2" : "gap-1.5 overflow-y-auto pr-0.5",
        )}
      >
        {items.map((row) => (
          <li
            key={row.label}
            className={cn(
              "flex min-h-0 items-center justify-between gap-3 rounded-lg px-2.5",
              fillRows ? "flex-1 py-2.5" : "shrink-0 py-2",
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
            <time
              className={cn(
                "shrink-0 tabular-nums font-bold text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]",
                fillRows ? "text-xs" : "text-[11px]",
              )}
            >
              {formatShort(row.date)}
            </time>
          </li>
        ))}
      </ul>
    </div>
  );
}
