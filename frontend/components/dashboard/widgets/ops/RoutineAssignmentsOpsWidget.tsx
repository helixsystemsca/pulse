"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";

import { isApiMode } from "@/lib/api";
import type { DashboardWidgetRenderContext } from "@/lib/dashboard/render-context";
import { opsWidgetFillLayout } from "@/lib/dashboard/ops-widget-fill";
import { routineAssignmentRowCap } from "@/lib/dashboard/widget-tier-disclosure";
import { readSession } from "@/lib/pulse-session";
import { listMyRoutineAssignments, listRoutines, type RoutineAssignmentDetail, type RoutineRow } from "@/lib/routinesService";
import { cn } from "@/lib/cn";

const DEMO_ASSIGNMENTS: { routineName: string; date: string }[] = [
  { routineName: "Opening pool deck", date: "Today" },
  { routineName: "Chemical room check", date: "Today" },
  { routineName: "Closing checklist", date: "Tonight" },
];

function formatAssignmentDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    const dt = new Date(`${d}T12:00:00`);
    if (Number.isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return d;
  }
}

function spreadListClass(fillShell: boolean, count: number, tight?: boolean) {
  return cn(
    "mt-1.5 min-h-0",
    fillShell && count > 0
      ? cn("flex flex-1 flex-col justify-between", tight ? "gap-1" : "gap-2")
      : tight
        ? "space-y-1"
        : "space-y-1.5",
  );
}

type LoadState =
  | { kind: "loading" }
  | { kind: "demo" }
  | { kind: "live"; assignments: RoutineAssignmentDetail[]; routines: RoutineRow[] };

export function useRoutineAssignmentsBoardState() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let cancel = false;
    const run = async () => {
      const sess = readSession();
      const can = isApiMode() && Boolean(sess?.access_token);
      if (!can) {
        if (!cancel) setState({ kind: "demo" });
        return;
      }
      try {
        const [assignments, routines] = await Promise.all([
          listMyRoutineAssignments(),
          listRoutines().catch(() => [] as RoutineRow[]),
        ]);
        if (!cancel) setState({ kind: "live", assignments, routines });
      } catch {
        if (!cancel) setState({ kind: "demo" });
      }
    };
    void run();
    return () => {
      cancel = true;
    };
  }, []);

  return state;
}

function RoutineAssignmentsInner({
  compact,
  maxAssignments,
  maxRoutines,
  variant = "full",
  showFooterLinks = true,
  fillShell = false,
}: {
  compact?: boolean;
  maxAssignments?: number;
  maxRoutines?: number;
  /** `full` = built-in tile; peek slices pick `assignments` or `library` only. */
  variant?: "full" | "assignments" | "library";
  showFooterLinks?: boolean;
  fillShell?: boolean;
}) {
  const state = useRoutineAssignmentsBoardState();
  const showAssignments = variant !== "library";
  const showLibrary = variant !== "assignments";
  const mutedText = "text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]";
  const fillCenter = fillShell ? "flex flex-1 items-center justify-center text-center px-2" : "";

  const body = useMemo(() => {
    if (state.kind === "loading") {
      return <p className={cn("text-xs", mutedText, fillCenter)}>Loading routines…</p>;
    }
    if (state.kind === "demo") {
      if (!showAssignments) {
        return (
          <p className={cn("text-xs", mutedText, fillCenter)}>
            Sign in to list published routines for this tenant.
          </p>
        );
      }
      const aCap = maxAssignments ?? (compact ? 2 : 4);
      const demoRows = DEMO_ASSIGNMENTS.slice(0, aCap);
      return (
        <div className={cn(fillShell && "flex min-h-0 flex-1 flex-col")}>
          <p
            className={cn(
              "text-[11px] text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]",
              fillShell ? "shrink-0" : "",
            )}
          >
            Demo assignments — sign in with a live tenant to load real routine handoffs.
          </p>
          <ul className={spreadListClass(fillShell, demoRows.length)}>
            {demoRows.map((row) => (
              <li
                key={row.routineName}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg bg-[color-mix(in_srgb,var(--ds-text-primary)_5%,transparent)] px-2 font-medium text-[color-mix(in_srgb,var(--ds-text-primary)_88%,transparent)]",
                  fillShell ? "min-h-0 flex-1 py-2.5 text-sm" : "py-1.5 text-xs",
                )}
              >
                <span className="min-w-0 truncate">{row.routineName}</span>
                <span className="shrink-0 text-[11px] font-bold text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]">
                  {row.date}
                </span>
              </li>
            ))}
          </ul>
        </div>
      );
    }

    if (state.kind !== "live") {
      return null;
    }

    const aLimit = maxAssignments ?? (compact ? 3 : 6);
    const rLimit = maxRoutines ?? (compact ? 3 : 5);
    const assignments = state.assignments.slice(0, aLimit);
    const routines = state.routines.slice(0, rLimit);

    return (
      <div
        className={cn(
          fillShell ? "flex min-h-0 flex-1 flex-col gap-4" : "space-y-4",
          fillShell && showAssignments && showLibrary && "justify-between",
        )}
      >
        {showAssignments ? (
          <div
            className={cn(
              fillShell && assignments.length > 0 && "flex min-h-0 min-w-0 flex-1 flex-col",
            )}
          >
            <p className="shrink-0 text-[10px] font-bold uppercase tracking-[0.1em] text-[color-mix(in_srgb,var(--ds-text-primary)_48%,transparent)]">
              Your assignments
            </p>
            {assignments.length === 0 ? (
              <p className={cn("mt-1.5 text-xs", mutedText, !showLibrary && fillCenter)}>
                Nothing delegated to you right now. Supervisors can assign routines from the schedule.
              </p>
            ) : (
              <ul className={spreadListClass(fillShell, assignments.length)}>
                {assignments.map((a) => (
                  <li
                    key={a.id}
                    className={cn(
                      "ops-dash-row flex items-start justify-between gap-2 px-2",
                      fillShell ? "min-h-0 flex-1 py-2.5" : "py-1.5",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate font-semibold text-[color-mix(in_srgb,var(--ds-text-primary)_92%,transparent)]",
                          fillShell ? "text-sm" : "text-xs",
                        )}
                      >
                        {a.routine.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[color-mix(in_srgb,var(--ds-text-primary)_55%,transparent)]">
                        {a.item_assignments.length} item{a.item_assignments.length === 1 ? "" : "s"} linked
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] font-bold tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]">
                      {formatAssignmentDate(a.date)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {showLibrary ? (
          <div className={cn(fillShell && routines.length > 0 && "flex min-h-0 min-w-0 flex-1 flex-col")}>
            <p className="shrink-0 text-[10px] font-bold uppercase tracking-[0.1em] text-[color-mix(in_srgb,var(--ds-text-primary)_48%,transparent)]">
              Routine library
            </p>
            {routines.length === 0 ? (
              <p className={cn("mt-1.5 text-xs", mutedText, !showAssignments && fillCenter)}>No routines published yet.</p>
            ) : (
              <ul className={spreadListClass(fillShell, routines.length, true)}>
                {routines.map((r) => (
                  <li
                    key={r.id}
                    className={cn(
                      "truncate text-[color-mix(in_srgb,var(--ds-text-primary)_78%,transparent)]",
                      fillShell
                        ? "ops-dash-row flex min-h-0 flex-1 items-center px-2 py-2.5 text-sm font-medium"
                        : "text-xs",
                    )}
                  >
                    · {r.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    );
  }, [state, compact, maxAssignments, maxRoutines, showAssignments, showLibrary, fillShell, fillCenter, mutedText]);

  return (
    <div className={cn(fillShell ? "flex h-full min-h-0 flex-col" : "space-y-2")}>
      <div className="flex shrink-0 items-center gap-2 text-[11px] font-semibold text-[color-mix(in_srgb,var(--ds-text-primary)_55%,transparent)]">
        <ClipboardList className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
        <span>Shift routines & handoffs</span>
      </div>
      <div className={cn(fillShell && "flex min-h-0 flex-1 flex-col")}>{body}</div>
      {showFooterLinks && !compact ? (
        <div className="flex shrink-0 flex-wrap gap-x-3 gap-y-1 pt-1">
          <Link
            href="/standards/routines"
            className="text-[11px] font-semibold text-[var(--ds-accent)] underline-offset-2 hover:underline"
          >
            Manage routines →
          </Link>
          <Link href="/schedule" className="text-[11px] font-semibold text-[var(--ds-accent)] underline-offset-2 hover:underline">
            Schedule →
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export function RoutineAssignmentsOpsWidget({ layoutContext }: { layoutContext?: DashboardWidgetRenderContext }) {
  const fillShell = opsWidgetFillLayout(layoutContext?.heightTier);
  const tier = layoutContext?.heightTier ?? "expanded";
  const { maxAssignments, maxRoutines } = routineAssignmentRowCap(tier);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <div className="ops-dash-inner-card flex min-h-0 flex-1 flex-col overflow-hidden p-1.5">
        <RoutineAssignmentsInner
          fillShell={fillShell}
          maxAssignments={maxAssignments}
          maxRoutines={maxRoutines}
          showFooterLinks={false}
        />
      </div>
    </div>
  );
}

export function RoutineAssignmentsPeekSlice({
  sliceId,
  compact,
  dense,
  maxRoutines,
}: {
  sliceId: string;
  compact: boolean;
  dense: boolean;
  maxRoutines: number;
}) {
  const variant = sliceId === "routine_library" ? "library" : "assignments";
  return (
    <RoutineAssignmentsInner
      compact={compact || dense}
      maxAssignments={compact ? 2 : dense ? 5 : 6}
      maxRoutines={maxRoutines}
      variant={variant}
    />
  );
}
