"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  buildTimeOffDayStates,
  monthGrid,
  visibleDatesAroundMonth,
  type TimeOffDayHint,
} from "@/lib/schedule/time-off-calendar";
import type { ProjectScheduleOverlayMeta } from "@/lib/schedule/project-overlay-styles";
import type { ScheduleSettings, Shift, TimeOffBlock, Worker } from "@/lib/schedule/types";
import { cn } from "@/lib/cn";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const HINT_STYLES: Record<TimeOffDayHint, string> = {
  selected: "ring-2 ring-pulse-accent/80 bg-pulse-accent/15 font-semibold",
  scheduled: "after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-sky-500",
  off_day: "bg-gray-100/80 dark:bg-gray-800/50",
  blackout: "bg-rose-50/90 dark:bg-rose-950/40",
  shortage: "bg-amber-50/80 dark:bg-amber-950/30",
  holiday: "bg-violet-50/70 dark:bg-violet-950/30",
};

type Props = {
  year: number;
  monthIndex: number;
  onMonthChange: (year: number, monthIndex: number) => void;
  workerId: string;
  selectedDates: Set<string>;
  onToggleDate: (date: string) => void;
  shifts: Shift[];
  workers: Worker[];
  settings: ScheduleSettings;
  timeOffBlocks: TimeOffBlock[];
  projects: readonly ProjectScheduleOverlayMeta[];
};

export function TimeOffSchedulingCalendar({
  year,
  monthIndex,
  onMonthChange,
  workerId,
  selectedDates,
  onToggleDate,
  shifts,
  workers,
  settings,
  timeOffBlocks,
  projects,
}: Props) {
  const cells = useMemo(() => monthGrid(year, monthIndex), [year, monthIndex]);
  const visibleDates = useMemo(() => visibleDatesAroundMonth(year, monthIndex), [year, monthIndex]);

  const dayStates = useMemo(
    () =>
      buildTimeOffDayStates({
        workerId,
        dates: cells.map((c) => c.date),
        selectedDates,
        shifts,
        workers,
        settings,
        timeOffBlocks,
        projects,
      }),
    [workerId, cells, selectedDates, shifts, workers, settings, timeOffBlocks, projects],
  );

  const monthLabel = new Date(year, monthIndex, 1).toLocaleString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="rounded-xl border border-pulseShell-border bg-pulseShell-surface/60 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Previous month"
          onClick={() => {
            const d = new Date(year, monthIndex - 1, 1);
            onMonthChange(d.getFullYear(), d.getMonth());
          }}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{monthLabel}</p>
        <button
          type="button"
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Next month"
          onClick={() => {
            const d = new Date(year, monthIndex + 1, 1);
            onMonthChange(d.getFullYear(), d.getMonth());
          }}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold uppercase tracking-wider text-pulse-muted">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-0.5">
        {cells.map(({ date, inMonth }) => {
          const state = dayStates[date];
          const selected = selectedDates.has(date);
          const primaryHint = state?.hints.find((h) => h !== "selected");
          const styleKey = selected ? "selected" : primaryHint;
          return (
            <button
              key={date}
              type="button"
              disabled={!inMonth || !workerId}
              title={state?.warning}
              onClick={() => {
                if (!inMonth) return;
                onToggleDate(date);
              }}
              className={cn(
                "relative flex h-9 items-center justify-center rounded-lg text-xs transition-colors",
                !inMonth && "pointer-events-none opacity-25",
                inMonth && "hover:bg-gray-100 dark:hover:bg-gray-800/80",
                styleKey && HINT_STYLES[styleKey],
                state?.warning && !selected && "ring-1 ring-amber-400/60",
              )}
            >
              {parseInt(date.slice(8), 10)}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-pulse-muted">
        <LegendDot className="bg-sky-500" label="Scheduled shift" />
        <LegendDot className="bg-gray-400" label="Off day" />
        <LegendDot className="bg-rose-400" label="Blackout" />
        <LegendDot className="bg-amber-400" label="Staffing risk" />
      </div>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("h-1.5 w-1.5 rounded-full", className)} />
      {label}
    </span>
  );
}
