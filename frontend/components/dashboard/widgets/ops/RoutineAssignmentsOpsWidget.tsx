"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";

import { apiFetch, isApiMode } from "@/lib/api";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import type { DashboardWidgetRenderContext } from "@/lib/dashboard/render-context";
import { opsWidgetFillLayout } from "@/lib/dashboard/ops-widget-fill";
import {
  buildDayRoutineWorkerRows,
  groupDayRoutineWorkerRows,
  localCalendarDayBoundsMs,
  routineShiftSectionLabel,
  type DayRoutineWorkerRow,
  type RoutineShiftSectionId,
} from "@/lib/dashboard/routine-assignments-day-board";
import { routineAssignmentRowCap } from "@/lib/dashboard/widget-tier-disclosure";
import { readSession } from "@/lib/pulse-session";
import { mergedScheduleShiftsForCalendarDate } from "@/lib/schedule/dashboardScheduleDay";
import {
  operationalDayRolloverHint,
} from "@/lib/schedule/operational-schedule-day";
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
import {
  demoHandoverSummaries,
  listAssignmentHandoverSummariesForDate,
  type AssignmentHandoverSummary,
} from "@/lib/routines/assignment-handover";
import { RoutineAssignmentHandoverChip } from "@/components/routines/handover/RoutineAssignmentHandoverChip";

const DEMO_WORKFORCE_ROWS: DayRoutineWorkerRow[] = [
  {
    workerId: "demo-1",
    workerName: "Alex Chen",
    shiftWindow: "06:00–14:00",
    shiftBand: "day",
    routines: [{ assignmentId: "d1", name: "Arena A — Day", primaryUserId: "demo-1" }],
    badges: ["GROUNDS"],
  },
  {
    workerId: "demo-2",
    workerName: "Jordan Lee",
    shiftWindow: "14:00–22:00",
    shiftBand: "afternoon",
    routines: [{ assignmentId: "d2", name: "Arena B — Afternoon", primaryUserId: "demo-2" }],
    badges: ["EXTRA"],
  },
  {
    workerId: "demo-3",
    workerName: "Sam Rivera",
    shiftWindow: "22:00–06:00",
    shiftBand: "night",
    routines: [],
    badges: [],
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
      handoverSummaries: AssignmentHandoverSummary[];
      loadErr: string | null;
      rolloverHint: string | null;
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
      const rolloverHint = operationalDayRolloverHint(now);
      const dateLabel = new Date(`${dateStr}T12:00:00`).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      const anchorMs = new Date(`${dateStr}T12:00:00`).getTime();
      const { dayStartMs, dayEndMsExclusive } = localCalendarDayBoundsMs(anchorMs);
      // Include overnight spill into the next calendar morning (e.g. Mon 22:00 → Tue 08:00).
      const toMs = dayEndMsExclusive + 10 * 60 * 60 * 1000;
      const from = new Date(dayStartMs).toISOString();
      const to = new Date(toMs).toISOString();

      let loadErr: string | null = null;
      try {
        const [assignments, routines, shiftList, pulseWorkers, pulseZones, handoverSummaries] =
          await Promise.all([
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
          listAssignmentHandoverSummariesForDate(dateStr).catch(() => [] as AssignmentHandoverSummary[]),
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
            handoverSummaries,
            loadErr,
            rolloverHint,
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
          handoverSummaries: [],
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
      nowMs: Date.now(),
    });
  }, [state, deploymentBadgeOverlays]);

  const handoverSummaryByAssignment = useMemo(() => {
    if (state.kind !== "live") return new Map<string, AssignmentHandoverSummary>();
    const m = new Map<string, AssignmentHandoverSummary>();
    for (const s of state.handoverSummaries) m.set(s.assignment_id, s);
    return m;
  }, [state]);

  const reload = () => setReloadToken((n) => n + 1);

  if (state.kind === "live") {
    return {
      kind: "live" as const,
      workforce,
      routines: state.routines,
      dateLabel: state.dateLabel,
      loadErr: state.loadErr,
      handoverSummaryByAssignment,
      reload,
      dateStr: state.dateStr,
      rolloverHint: state.rolloverHint,
    };
  }
  if (state.kind === "demo") {
    return { kind: "demo" as const, reload };
  }
  return state;
}

function ShiftSectionHeader({
  section,
  count,
  fillShell,
}: {
  section: RoutineShiftSectionId;
  count: number;
  fillShell?: boolean;
}) {
  const isMissing = section === "missing";
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-between gap-2 border-b border-[color-mix(in_srgb,var(--ds-text-primary)_10%,transparent)] pb-1",
        fillShell ? "pt-0.5" : "pt-1",
        isMissing && "border-amber-300/60 dark:border-amber-500/35",
      )}
    >
      <p
        className={cn(
          "text-[10px] font-bold uppercase tracking-[0.1em]",
          isMissing
            ? "text-amber-800 dark:text-amber-200"
            : "text-[color-mix(in_srgb,var(--ds-text-primary)_48%,transparent)]",
        )}
      >
        {routineShiftSectionLabel(section)}
      </p>
      <span className="text-[10px] font-semibold tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_45%,transparent)]">
        {count}
      </span>
    </div>
  );
}

function WorkforceRoutineRow({
  row,
  compact,
  fillShell,
  emphasizeMissing,
  handoverSummaryByAssignment,
  onHandoverChange,
}: {
  row: DayRoutineWorkerRow;
  compact?: boolean;
  fillShell?: boolean;
  emphasizeMissing?: boolean;
  handoverSummaryByAssignment?: Map<string, AssignmentHandoverSummary>;
  onHandoverChange?: () => void;
}) {
  const hasChips = row.badges.length > 0 || row.routines.length > 0;

  return (
    <li className={cn("ops-dash-row shrink-0 px-2 py-1", fillShell && "min-h-0")}>
      <div className="flex min-w-0 items-center gap-1.5">
        <p
          className={cn(
            "min-w-0 max-w-[9rem] shrink truncate font-semibold text-[color-mix(in_srgb,var(--ds-text-primary)_92%,transparent)]",
            fillShell ? "text-sm" : "text-xs",
          )}
          title={row.workerName}
        >
          {row.workerName}
        </p>
        {hasChips ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-0.5">
            {row.badges.map((code) => {
              const def = OPERATIONAL_BADGE_REGISTRY[code];
              return (
                <span
                  key={code}
                  className={cn(
                    "rounded border px-1 py-px text-[8px] font-bold uppercase leading-none",
                    operationalBadgeClasses(def?.group ?? "special"),
                  )}
                  title={def?.detail}
                >
                  {operationalBadgeChipLabel(code)}
                </span>
              );
            })}
            {row.routines.map((r) => (
              <RoutineAssignmentHandoverChip
                key={r.assignmentId}
                layout="inline"
                assignment={r}
                workerName={row.workerName}
                shiftWindow={row.shiftWindow}
                summary={handoverSummaryByAssignment?.get(r.assignmentId)}
                onHandoverChange={onHandoverChange}
              />
            ))}
          </div>
        ) : null}
        {row.shiftWindow ? (
          <span className="shrink-0 text-[10px] font-bold tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]">
            {row.shiftWindow}
          </span>
        ) : null}
      </div>
      {emphasizeMissing ? (
        <p className="mt-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-200">On shift — no routine assigned</p>
      ) : !hasChips ? (
        <p className="mt-0.5 text-[10px] text-[color-mix(in_srgb,var(--ds-text-primary)_50%,transparent)]">
          On shift — no routines or badges yet
        </p>
      ) : null}
    </li>
  );
}

function WorkforceByShiftSections({
  groups,
  compact,
  fillShell,
  dateLabel,
  loadErr,
  demoHint,
  rolloverHint,
  handoverSummaryByAssignment,
  onHandoverChange,
}: {
  groups: ReturnType<typeof groupDayRoutineWorkerRows>;
  compact?: boolean;
  fillShell?: boolean;
  dateLabel?: string;
  loadErr?: string | null;
  rolloverHint?: string | null;
  demoHint?: string;
  handoverSummaryByAssignment?: Map<string, AssignmentHandoverSummary>;
  onHandoverChange?: () => void;
}) {
  const totalWorkers = groups.reduce((n, g) => n + g.rows.length, 0);

  return (
    <div className={cn(fillShell && "flex min-h-0 flex-1 flex-col")}>
      <p className="shrink-0 text-[10px] font-bold uppercase tracking-[0.1em] text-[color-mix(in_srgb,var(--ds-text-primary)_48%,transparent)]">
        Workforce{dateLabel ? ` · ${dateLabel}` : ""}
      </p>
      {demoHint ? (
        <p className="mt-1 shrink-0 text-[11px] text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]">{demoHint}</p>
      ) : null}
      {rolloverHint ? (
        <p className="mt-1 shrink-0 text-[11px] text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]">
          {rolloverHint}
        </p>
      ) : null}
      {loadErr ? (
        <p className="mt-1 shrink-0 text-[11px] font-medium text-amber-700 dark:text-amber-300">{loadErr}</p>
      ) : null}
      {totalWorkers === 0 ? (
        <p className="mt-1.5 text-xs text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]">
          No scheduled workers for this day. Assign on Schedule → Daily assignments.
        </p>
      ) : (
        <div
          className={cn(
            "mt-1.5 min-h-0",
            fillShell && totalWorkers > 0 ? "flex flex-1 flex-col gap-1.5 overflow-y-auto" : "space-y-2",
          )}
        >
          {groups.map(({ section, rows }) => (
            <section
              key={section}
              className={cn(
                section === "missing" && "rounded-lg border border-amber-200/70 bg-amber-50/40 px-2 py-1.5 dark:border-amber-500/25 dark:bg-amber-950/20",
              )}
            >
              <ShiftSectionHeader section={section} count={rows.length} fillShell={fillShell} />
              <ul className="mt-0.5 min-h-0 space-y-0">
                {rows.map((row) => (
                  <WorkforceRoutineRow
                    key={row.workerId}
                    row={row}
                    compact={compact}
                    fillShell={fillShell}
                    emphasizeMissing={section === "missing"}
                    handoverSummaryByAssignment={handoverSummaryByAssignment}
                    onHandoverChange={onHandoverChange}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function RoutineAssignmentsInner({
  compact,
  maxWorkers,
  showFooterLinks = true,
  fillShell = false,
}: {
  compact?: boolean;
  maxWorkers?: number;
  showFooterLinks?: boolean;
  fillShell?: boolean;
}) {
  const state = useRoutineAssignmentsBoardState();
  const [handoverBump, setHandoverBump] = useState(0);
  const mutedText = "text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]";
  const fillCenter = fillShell ? "flex flex-1 items-center justify-center text-center px-2" : "";

  const onHandoverChange = useCallback(() => {
    setHandoverBump((n) => n + 1);
    if ("reload" in state && typeof state.reload === "function") state.reload();
  }, [state]);

  const demoHandoverMap = useMemo(() => {
    const ids = DEMO_WORKFORCE_ROWS.flatMap((r) => r.routines.map((x) => x.assignmentId));
    const summaries = demoHandoverSummaries(ids);
    return new Map(summaries.map((s) => [s.assignment_id, s]));
  }, [handoverBump]);

  const body = useMemo(() => {
    if (state.kind === "loading") {
      return <p className={cn("text-xs", mutedText, fillCenter)}>Loading routines…</p>;
    }
    if (state.kind === "demo") {
      const limit = maxWorkers ?? (compact ? 4 : 8);
      const rows = DEMO_WORKFORCE_ROWS.slice(0, limit);
      const groups = groupDayRoutineWorkerRows(rows);
      return (
        <WorkforceByShiftSections
          groups={groups}
          compact={compact}
          fillShell={fillShell}
          demoHint="Demo workforce handoffs — sign in to sync with the schedule board."
          handoverSummaryByAssignment={demoHandoverMap}
          onHandoverChange={onHandoverChange}
        />
      );
    }

    if (state.kind !== "live") {
      return null;
    }

    const wLimit = maxWorkers ?? (compact ? 6 : 12);
    const workforce = state.workforce.slice(0, wLimit);
    const groups = groupDayRoutineWorkerRows(workforce);

    return (
      <WorkforceByShiftSections
        groups={groups}
        compact={compact}
        fillShell={fillShell}
        dateLabel={state.dateLabel}
        loadErr={state.loadErr}
        rolloverHint={state.rolloverHint}
        handoverSummaryByAssignment={state.handoverSummaryByAssignment}
        onHandoverChange={onHandoverChange}
      />
    );
  }, [state, compact, maxWorkers, fillShell, fillCenter, mutedText, demoHandoverMap]);

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
  const { maxAssignments } = routineAssignmentRowCap(tier);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <div className="ops-dash-inner-card flex min-h-0 flex-1 flex-col overflow-hidden">
        <RoutineAssignmentsInner
          fillShell={fillShell}
          maxWorkers={maxAssignments}
          showFooterLinks={false}
        />
      </div>
    </div>
  );
}

export function RoutineAssignmentsPeekSlice({
  compact,
  dense,
}: {
  sliceId: string;
  compact: boolean;
  dense: boolean;
  maxRoutines?: number;
}) {
  return (
    <RoutineAssignmentsInner
      compact={compact || dense}
      maxWorkers={compact ? 4 : dense ? 8 : 10}
      showFooterLinks
    />
  );
}
