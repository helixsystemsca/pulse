"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";

import { apiFetch, isApiMode } from "@/lib/api";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import type { DashboardWidgetRenderContext } from "@/lib/dashboard/render-context";
import { opsWidgetFillLayout } from "@/lib/dashboard/ops-widget-fill";
import {
  buildDayRoutineWorkerRows,
  localCalendarDayBoundsMs,
  type DayRoutineWorkerRow,
} from "@/lib/dashboard/routine-assignments-day-board";
import { routineAssignmentRowCap } from "@/lib/dashboard/widget-tier-disclosure";
import { readSession } from "@/lib/pulse-session";
import { mergedScheduleShiftsForCalendarDate } from "@/lib/schedule/dashboardScheduleDay";
import {
  normalizeRoutineAssignmentDate,
  routineAssignmentsDisplayDate,
} from "@/lib/schedule/routine-assignments-sync";
import {
  OPERATIONAL_BADGE_REGISTRY,
  operationalBadgeChipLabel,
} from "@/lib/schedule/operational-scheduling-model";
import { operationalBadgeClasses } from "@/lib/schedule/schedule-semantic-styles";
import {
  listRoutineAssignmentsForDate,
  listRoutines,
  type RoutineRow,
} from "@/lib/routinesService";
import {
  pulseWorkersToSchedule,
  type PulseShiftApi,
  type PulseWorkerApi,
  type PulseZoneApi,
} from "@/lib/schedule/pulse-bridge";
import { useScheduleStore } from "@/lib/schedule/schedule-store";
import type { Shift, Worker } from "@/lib/schedule/types";
import type { RoutineAssignmentDetail } from "@/lib/routinesService";
import { cn } from "@/lib/cn";

const DEMO_WORKFORCE_ROWS: DayRoutineWorkerRow[] = [
  {
    workerId: "demo-1",
    workerName: "Alex Chen",
    shiftWindow: "06:00–14:00",
    routines: [{ assignmentId: "d1", name: "Arena A — Day" }],
    badges: ["GROUNDS"],
  },
  {
    workerId: "demo-2",
    workerName: "Jordan Lee",
    shiftWindow: "14:00–22:00",
    routines: [{ assignmentId: "d2", name: "Arena B — Afternoon" }],
    badges: ["EXTRA"],
  },
];

function routineAssignmentsLoadMessage(err: unknown): string {
  const { message, status, requestUrl } = parseClientApiError(err);
  if (status === 404) return "";
  const networkLike =
    err instanceof TypeError ||
    /browser could not read the api response|cors|failed to fetch|networkerror|load failed/i.test(
      message,
    );
  const isAssignmentsDay =
    (typeof requestUrl === "string" && requestUrl.includes("/routines/assignments/day")) ||
    networkLike;
  if (status === 401) {
    return "Routine assignments require a signed-in session. Sign in again if this persists.";
  }
  if (isAssignmentsDay && networkLike) {
    return (
      "Could not load routine assignments (network or server error). Open DevTools → Network for this request’s status; other widgets working usually means this route failed server-side."
    );
  }
  return message || "Could not load routine assignments for this day.";
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
  | {
      kind: "live";
      dateStr: string;
      dateLabel: string;
      shifts: Shift[];
      workers: Worker[];
      assignments: RoutineAssignmentDetail[];
      routines: RoutineRow[];
      loadErr: string | null;
    };

export function useRoutineAssignmentsBoardState() {
  const deploymentBadgeOverlays = useScheduleStore((s) => s.deploymentBadgeOverlays);
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const bump = () => setReloadToken((n) => n + 1);
    window.addEventListener("focus", bump);
    return () => window.removeEventListener("focus", bump);
  }, []);

  useEffect(() => {
    let cancel = false;
    const run = async () => {
      const sess = readSession();
      const can = isApiMode() && Boolean(sess?.access_token);
      if (!can) {
        if (!cancel) setState({ kind: "demo" });
        return;
      }

      const now = Date.now();
      const dateStr =
        normalizeRoutineAssignmentDate(routineAssignmentsDisplayDate(now)) ??
        routineAssignmentsDisplayDate(now);
      const dateLabel = new Date(`${dateStr}T12:00:00`).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      const { dayStartMs, dayEndMsExclusive } = localCalendarDayBoundsMs(
        new Date(`${dateStr}T12:00:00`).getTime(),
      );
      const from = new Date(dayStartMs).toISOString();
      const to = new Date(dayEndMsExclusive).toISOString();

      let loadErr: string | null = null;
      try {
        const [assignments, routines, shiftList, pulseWorkers, pulseZones] = await Promise.all([
          listRoutineAssignmentsForDate(dateStr).catch((e) => {
            const { status } = parseClientApiError(e);
            if (status === 404) return [] as RoutineAssignmentDetail[];
            loadErr = routineAssignmentsLoadMessage(e);
            return [] as RoutineAssignmentDetail[];
          }),
          listRoutines().catch(() => [] as RoutineRow[]),
          apiFetch<PulseShiftApi[]>(
            `/api/v1/pulse/schedule/shifts?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
          ).catch((e) => {
            const st = (e as { status?: number })?.status;
            if (st === 403) return [] as PulseShiftApi[];
            throw e;
          }),
          apiFetch<PulseWorkerApi[]>("/api/v1/pulse/workers").catch(() => [] as PulseWorkerApi[]),
          apiFetch<PulseZoneApi[]>("/api/v1/pulse/schedule-facilities").catch(() => [] as PulseZoneApi[]),
        ]);

        const storeWorkers = useScheduleStore.getState().workers;
        const workers =
          storeWorkers.length > 0 ? storeWorkers : pulseWorkersToSchedule(pulseWorkers);
        const shifts = mergedScheduleShiftsForCalendarDate({
          dateStr,
          pulseShifts: shiftList,
          pulseWorkers,
          pulseZones,
        });

        if (!cancel) {
          setState({
            kind: "live",
            dateStr,
            dateLabel,
            shifts,
            workers,
            assignments,
            routines,
            loadErr,
          });
        }
      } catch (e) {
        if (cancel) return;
        setState({
          kind: "live",
          dateStr,
          dateLabel,
          shifts: [],
          workers: [],
          assignments: [],
          routines: [],
          loadErr: routineAssignmentsLoadMessage(e),
        });
      }
    };
    void run();
    return () => {
      cancel = true;
    };
  }, [reloadToken]);

  const workforce = useMemo(() => {
    if (state.kind !== "live") return [] as DayRoutineWorkerRow[];
    return buildDayRoutineWorkerRows({
      dateStr: state.dateStr,
      shifts: state.shifts,
      workers: state.workers,
      assignments: state.assignments,
      deploymentBadgeOverlays,
    });
  }, [state, deploymentBadgeOverlays]);

  if (state.kind === "live") {
    return {
      kind: "live" as const,
      workforce,
      routines: state.routines,
      dateLabel: state.dateLabel,
      loadErr: state.loadErr,
    };
  }
  return state;
}

function WorkforceRoutineRow({
  row,
  compact,
  fillShell,
}: {
  row: DayRoutineWorkerRow;
  compact?: boolean;
  fillShell?: boolean;
}) {
  return (
    <li
      className={cn(
        "ops-dash-row flex flex-col gap-1 px-2",
        fillShell ? "min-h-0 flex-1 justify-center py-2.5" : "py-1.5",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            "min-w-0 truncate font-semibold text-[color-mix(in_srgb,var(--ds-text-primary)_92%,transparent)]",
            fillShell ? "text-sm" : "text-xs",
          )}
        >
          {row.workerName}
        </p>
        {row.shiftWindow ? (
          <span className="shrink-0 text-[10px] font-bold tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]">
            {row.shiftWindow}
          </span>
        ) : null}
      </div>
      {(row.badges.length > 0 || row.routines.length > 0) && (
        <div className="flex flex-wrap items-center gap-1">
          {row.badges.map((code) => {
            const def = OPERATIONAL_BADGE_REGISTRY[code];
            return (
              <span
                key={code}
                className={cn(
                  "rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase",
                  operationalBadgeClasses(def?.group ?? "special"),
                )}
                title={def?.detail}
              >
                {operationalBadgeChipLabel(code)}
              </span>
            );
          })}
          {row.routines.map((r) => (
            <span
              key={r.assignmentId}
              className="rounded-md border border-violet-200/80 bg-violet-50/90 px-1.5 py-0.5 text-[10px] font-medium text-violet-900 dark:border-violet-500/30 dark:bg-violet-950/60 dark:text-violet-100"
            >
              {r.name}
            </span>
          ))}
        </div>
      )}
      {row.badges.length === 0 && row.routines.length === 0 ? (
        <p className="text-[10px] text-[color-mix(in_srgb,var(--ds-text-primary)_50%,transparent)]">
          On shift — no routines or badges yet
        </p>
      ) : null}
    </li>
  );
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
      const rows = DEMO_WORKFORCE_ROWS.slice(0, maxAssignments ?? (compact ? 2 : 4));
      return (
        <div className={cn(fillShell && "flex min-h-0 flex-1 flex-col")}>
          <p
            className={cn(
              "text-[11px] text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]",
              fillShell ? "shrink-0" : "",
            )}
          >
            Demo workforce handoffs — sign in to sync with the schedule board.
          </p>
          <ul className={spreadListClass(fillShell, rows.length)}>
            {rows.map((row) => (
              <WorkforceRoutineRow key={row.workerId} row={row} compact={compact} fillShell={fillShell} />
            ))}
          </ul>
        </div>
      );
    }

    if (state.kind !== "live") {
      return null;
    }

    const rLimit = maxRoutines ?? (compact ? 3 : 5);
    const routines = state.routines.slice(0, rLimit);
    const wLimit = maxAssignments ?? (compact ? 3 : 6);
    const workforce = state.workforce.slice(0, wLimit);

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
              fillShell && workforce.length > 0 && "flex min-h-0 min-w-0 flex-1 flex-col",
            )}
          >
            <p className="shrink-0 text-[10px] font-bold uppercase tracking-[0.1em] text-[color-mix(in_srgb,var(--ds-text-primary)_48%,transparent)]">
              Workforce · {state.dateLabel}
            </p>
            {state.loadErr ? (
              <p className="mt-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">{state.loadErr}</p>
            ) : null}
            {workforce.length === 0 ? (
              <p className={cn("mt-1.5 text-xs", mutedText, !showLibrary && fillCenter)}>
                No scheduled workers or routine assignments for this day. Assign on Schedule → Daily assignments.
              </p>
            ) : (
              <ul className={spreadListClass(fillShell, workforce.length)}>
                {workforce.map((row) => (
                  <WorkforceRoutineRow
                    key={row.workerId}
                    row={row}
                    compact={compact}
                    fillShell={fillShell}
                  />
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
      <div className="ops-dash-inner-card flex min-h-0 flex-1 flex-col overflow-hidden">
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
      showFooterLinks
    />
  );
}
