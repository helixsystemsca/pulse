"use client";

import type { AvailabilityCellEvaluation } from "@/lib/schedule/operational-scheduling-model";
import {
  AVAILABILITY_CELL_AVAILABLE,
  AVAILABILITY_CELL_RESTRICTED,
  AVAILABILITY_CELL_UNAVAILABLE,
} from "@/lib/schedule/schedule-semantic-styles";
import { cn } from "@/lib/cn";

export function AvailabilityCellFrame({
  evaluation,
  children,
  className,
}: {
  evaluation: AvailabilityCellEvaluation;
  children: React.ReactNode;
  className?: string;
}) {
  const base =
    evaluation.kind === "unavailable"
      ? AVAILABILITY_CELL_UNAVAILABLE
      : evaluation.kind === "restricted"
        ? AVAILABILITY_CELL_RESTRICTED
        : AVAILABILITY_CELL_AVAILABLE;

  return (
    <div
      title={evaluation.message}
      className={cn("relative min-h-[3rem] rounded-md border border-pulseShell-border/60 p-1", base, className)}
    >
      {evaluation.overlay === "stripe-diagonal" ? (
        <div
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[0.14] dark:opacity-[0.18]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(-45deg, transparent, transparent 5px, var(--ds-text-primary) 5px, var(--ds-text-primary) 6px)",
          }}
          aria-hidden
        />
      ) : null}
      {evaluation.overlay === "edge-morning" ? (
        <div
          className="pointer-events-none absolute inset-y-1 left-1 w-1 rounded-sm bg-sky-400/55 dark:bg-sky-300/45"
          aria-hidden
        />
      ) : null}
      {evaluation.overlay === "edge-afternoon" ? (
        <div
          className="pointer-events-none absolute inset-y-1 right-1 w-1 rounded-sm bg-amber-400/55 dark:bg-amber-300/45"
          aria-hidden
        />
      ) : null}
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
