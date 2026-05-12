"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";

import { isApiMode } from "@/lib/api";
import { readSession } from "@/lib/pulse-session";
import { listMyRoutineAssignments, listRoutines, type RoutineAssignmentDetail, type RoutineRow } from "@/lib/routinesService";
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
}: {
  compact?: boolean;
  maxAssignments?: number;
  maxRoutines?: number;
  /** `full` = built-in tile; peek slices pick `assignments` or `library` only. */
  variant?: "full" | "assignments" | "library";
}) {
  const state = useRoutineAssignmentsBoardState();
  const showAssignments = variant !== "library";
  const showLibrary = variant !== "assignments";

  const body = useMemo(() => {
    if (state.kind === "loading") {
      return <p className="text-xs text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]">Loading routines…</p>;
    }
    if (state.kind === "demo") {
      if (!showAssignments) {
        return (
          <p className="text-xs text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]">
            Sign in to list published routines for this tenant.
          </p>
        );
      }
      const aCap = maxAssignments ?? (compact ? 2 : 4);
      return (
        <div className="space-y-3">
          <p className="text-[11px] text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]">
            Demo assignments — sign in with a live tenant to load real routine handoffs.
          </p>
          <ul className="space-y-1.5">
            {DEMO_ASSIGNMENTS.slice(0, aCap).map((row) => (
              <li
                key={row.routineName}
                className="flex items-center justify-between gap-2 rounded-lg bg-[color-mix(in_srgb,var(--ds-text-primary)_5%,transparent)] px-2 py-1.5 text-xs font-medium text-[color-mix(in_srgb,var(--ds-text-primary)_88%,transparent)]"
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
      <div className="space-y-4">
        {showAssignments ? (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[color-mix(in_srgb,var(--ds-text-primary)_48%,transparent)]">
              Your assignments
            </p>
            {assignments.length === 0 ? (
              <p className="mt-1.5 text-xs text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]">
                Nothing delegated to you right now. Supervisors can assign routines from the schedule.
              </p>
            ) : (
              <ul className="mt-1.5 space-y-1.5">
                {assignments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-[color-mix(in_srgb,var(--ops-dash-border,#cbd5e1)_70%,transparent)] bg-[var(--ops-dash-widget-bg,#ffffff)] px-2 py-1.5 dark:border-white/[0.08] dark:bg-[color-mix(in_srgb,#0f172a_92%,#1e293b)]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-[color-mix(in_srgb,var(--ds-text-primary)_92%,transparent)]">
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
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[color-mix(in_srgb,var(--ds-text-primary)_48%,transparent)]">
              Routine library
            </p>
            {routines.length === 0 ? (
              <p className="mt-1.5 text-xs text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]">No routines published yet.</p>
            ) : (
              <ul className="mt-1.5 space-y-1">
                {routines.map((r) => (
                  <li key={r.id} className="truncate text-xs text-[color-mix(in_srgb,var(--ds-text-primary)_78%,transparent)]">
                    · {r.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    );
  }, [state, compact, maxAssignments, maxRoutines, showAssignments, showLibrary]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-[color-mix(in_srgb,var(--ds-text-primary)_55%,transparent)]">
        <ClipboardList className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
        <span>Shift routines & handoffs</span>
      </div>
      {body}
      {!compact ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
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

export function RoutineAssignmentsOpsWidget() {
  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-[color-mix(in_srgb,var(--ops-dash-widget-bg,#fff)_65%,var(--ops-dash-border,#cbd5e1))] bg-[var(--ops-dash-widget-bg,#ffffff)] p-3 shadow-sm dark:border-white/[0.07] dark:bg-[color-mix(in_srgb,#0f172a_96%,#1e293b)]">
      <RoutineAssignmentsInner />
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
