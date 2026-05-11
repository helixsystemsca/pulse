"use client";

import { useMemo } from "react";
import { CalendarDays } from "lucide-react";

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

/**
 * Manager-calendar style milestones (deterministic from server clock until a live calendar feed exists).
 */
export function ImportantDatesOpsWidget() {
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
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-[color-mix(in_srgb,var(--ops-dash-widget-bg,#fff)_65%,var(--ops-dash-border,#cbd5e1))] bg-[var(--ops-dash-widget-bg,#ffffff)] p-3 shadow-sm dark:border-white/[0.07] dark:bg-[color-mix(in_srgb,#0f172a_96%,#1e293b)]">
      <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold text-[color-mix(in_srgb,var(--ds-text-primary)_55%,transparent)]">
        <CalendarDays className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
        <span>Synced to manager calendar</span>
      </div>
      <ul className="min-h-0 flex-1 space-y-2 overflow-auto pr-0.5">
        {items.map((row) => (
          <li
            key={row.label}
            className={cn(
              "flex items-start justify-between gap-3 rounded-lg px-2.5 py-2 text-xs",
              row.tone === "accent"
                ? "bg-[color-mix(in_srgb,var(--ds-accent)_14%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--ds-accent)_28%,transparent)]"
                : "bg-[color-mix(in_srgb,var(--ds-text-primary)_4%,transparent)]",
            )}
          >
            <span className="min-w-0 flex-1 font-semibold leading-snug text-[color-mix(in_srgb,var(--ds-text-primary)_92%,transparent)]">
              {row.label}
            </span>
            <time className="shrink-0 tabular-nums text-[11px] font-bold text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]">
              {formatShort(row.date)}
            </time>
          </li>
        ))}
      </ul>
    </div>
  );
}
