"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = {
  /** Compact workspace rail (nav, search, facilities) — sits above the status strip. */
  operationsRow?: ReactNode;
  /** Operational status strip (six columns). */
  status: ReactNode;
  /** View / layout / display toolbar row. */
  controls: ReactNode;
  className?: string;
};

/**
 * Single premium control surface below the page title: optional ops rail, status metrics, then controls.
 */
export function ScheduleUnifiedControlCard({ operationsRow, status, controls, className }: Props) {
  return (
    <section
      className={cn(
        "rounded-[20px] border border-pulseShell-border/90 bg-white shadow-[0_10px_40px_-20px_rgba(15,23,42,0.18)] dark:border-slate-700/80 dark:bg-slate-950/80 dark:shadow-black/35",
        "px-5 py-4 sm:px-6 sm:py-5",
        className,
      )}
    >
      {operationsRow ? (
        <div className="mb-4 border-b border-pulseShell-border/70 pb-4 dark:border-slate-700/80">{operationsRow}</div>
      ) : null}
      <div className="-mx-1">{status}</div>
      <div className="mt-4 border-t border-pulseShell-border/70 pt-4 dark:border-slate-700/80">{controls}</div>
    </section>
  );
}
