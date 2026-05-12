"use client";

import { flushSync } from "react-dom";
import { workerDayAttendanceKey, useWorkerDayAttendanceStore } from "@/lib/dashboard/worker-day-attendance-store";
import { scheduleShiftHoverSummary } from "@/lib/schedule/certifications";
import { getShiftConflicts } from "@/lib/schedule/conflicts";
import type { CompactDayShiftRow } from "@/lib/schedule/compact-day-shifts";
import {
  attachShiftDragPreview,
  readPaletteDragPayload,
  setShiftDragData,
  type PaletteDragPayload,
} from "@/lib/schedule/drag";
import { buildingIndicatorForZone } from "@/lib/schedule/building-indicators";
import { displayStandardShiftCode } from "@/lib/schedule/shift-definition-catalog";
import { shiftCodeBadgeToneClasses, shiftCodeToneClassForRowBadge } from "@/lib/schedule/scheduleWorkerPanelSort";
import { cn } from "@/lib/cn";
import { OperationalBadgeStack } from "@/components/schedule/operational/OperationalBadgeStack";
import { ScheduleShiftCertChips } from "./ScheduleShiftCertChips";
import type {
  ScheduleDragSession,
  ScheduleRoleDefinition,
  ScheduleSettings,
  Shift,
  ShiftTypeConfig,
  TimeOffBlock,
  Worker,
  Zone,
} from "@/lib/schedule/types";

type Props = {
  rows: CompactDayShiftRow[];
  fullDayShifts: Shift[];
  workers: Worker[];
  zones: Zone[];
  roles: ScheduleRoleDefinition[];
  shiftTypes: ShiftTypeConfig[];
  settings: ScheduleSettings;
  timeOffBlocks: TimeOffBlock[];
  onSelectShift: (shift: Shift) => void;
  scheduleDragLock: boolean;
  dragSession: ScheduleDragSession | null;
  shiftDragEnabled?: boolean;
  onShiftDragSessionStart: (payload: ScheduleDragSession) => void;
  onShiftDragSessionEnd: () => void;
  /** Calendar date (YYYY-MM-DD) for this cell — attendance marks are keyed by worker + date. */
  cellDate: string;
  /** Drop assignment palette entries onto a worker row (workforce / work). */
  onPaletteDrop?: (workerId: string, date: string, payload: PaletteDragPayload) => void;
  /** Remove an operational badge from this worker-day (overlay + any shifts that carry the code). */
  onRemoveOperationalBadge?: (workerId: string, date: string, code: string) => void;
  /** Supervisors/managers: tap worker name to mark sick / DNS (stored locally until telemetry). */
  onOpenWorkerAttendance?: (payload: { workerId: string; date: string; label: string }) => void;
  /** Outer scroll area (month vs week cell height). */
  scrollClassName?: string;
  /**
   * `summary` — one line per chip (name · shift code only); full role/facility/time open in day view or shift editor.
   * `full` — second line with role · facility (or project line).
   */
  chipDetailLevel?: "summary" | "full";
};

function aggregateConflictHoverTip(
  row: CompactDayShiftRow,
  fullDay: Shift[],
  workers: Worker[],
  settings: ScheduleSettings,
  timeOffBlocks: TimeOffBlock[],
  zones: Zone[],
  workerMap: Map<string, Worker>,
): string {
  const tips: string[] = [];
  for (const s of row.shifts) {
    const w = s.workerId ? workerMap.get(s.workerId) : null;
    const c = getShiftConflicts(s, fullDay, workers, settings, timeOffBlocks, zones);
    tips.push(scheduleShiftHoverSummary(s, w ?? null, c));
  }
  return tips.filter(Boolean).join("\n---\n");
}

export function ScheduleCompactCellRows({
  rows,
  fullDayShifts,
  workers,
  zones,
  roles,
  shiftTypes,
  settings,
  timeOffBlocks,
  onSelectShift,
  scheduleDragLock,
  dragSession,
  shiftDragEnabled = true,
  onShiftDragSessionStart,
  onShiftDragSessionEnd,
  cellDate,
  onPaletteDrop,
  onRemoveOperationalBadge,
  onOpenWorkerAttendance,
  scrollClassName = "max-h-[11rem] flex-1 flex-col gap-1 overflow-y-auto px-1 pb-2 pt-1",
  chipDetailLevel = "full",
}: Props) {
  const attendanceMarks = useWorkerDayAttendanceStore((s) => s.marks);
  const typeMap = new Map(shiftTypes.map((t) => [t.key, t]));
  const zoneMap = new Map(zones.map((z) => [z.id, z.label]));
  const zoneObjMap = new Map(zones.map((z) => [z.id, z]));
  const roleMap = new Map(roles.map((r) => [r.id, r.label]));
  const workerMap = new Map(workers.map((w) => [w.id, w]));

  const summary = chipDetailLevel === "summary";
  /** `scheduleDragLock` is true for any active drag; palette row targets must stay interactive while dragging from the palette. */
  const paletteInteractionsBlocked = scheduleDragLock && dragSession?.kind !== "palette";

  return (
    <div className={`relative z-[2] flex ${scrollClassName}`}>
      {rows.map((row) => {
        const s = row.primaryShift;
        const st = typeMap.get(s.shiftType);
        const isOpen = !s.workerId && s.shiftKind !== "project_task";
        const zone = zoneMap.get(s.zoneId) ?? "—";
        const zoneObj = zoneObjMap.get(s.zoneId);
        const bld = buildingIndicatorForZone(zoneObj);
        const roleLb = roleMap.get(s.role) ?? s.role;
        // Outer card stays neutral; shift chip carries the shift-type color for compact scan.
        const cardCls = "border border-pulseShell-border bg-pulseShell-surface text-ds-foreground";
        const openCls = isOpen
          ? "ring-2 ring-dashed ring-ds-success/45 ring-offset-1 ring-offset-pulse-shell-cell dark:ring-offset-pulse-shell-cell"
          : "";
        const tip = aggregateConflictHoverTip(
          row,
          fullDayShifts,
          workers,
          settings,
          timeOffBlocks,
          zones,
          workerMap,
        );
        const chipLocked =
          scheduleDragLock &&
          dragSession?.kind !== "palette" &&
          (dragSession?.kind === "worker" ||
            (dragSession?.kind === "shift" && !row.shifts.some((x) => x.id === dragSession.shiftId)));
        const anyAuto = row.shifts.some((x) => x.autoGenerated);
        const canDrag =
          shiftDragEnabled &&
          !anyAuto &&
          row.shifts.length === 1 &&
          (!scheduleDragLock || (dragSession?.kind === "shift" && dragSession.shiftId === s.id));

        const certUnion = [
          ...new Set(
            row.shifts.flatMap((x) => (x.required_certifications?.filter(Boolean) as string[] | undefined) ?? []),
          ),
        ] as string[];

        const attendanceMark =
          s.workerId && s.eventType === "work"
            ? attendanceMarks[workerDayAttendanceKey(s.workerId, cellDate)]
            : undefined;
        const canTapAttendance =
          Boolean(onOpenWorkerAttendance) &&
          !scheduleDragLock &&
          Boolean(s.workerId) &&
          s.eventType === "work" &&
          s.shiftKind !== "project_task";

        const paletteWorkerId =
          s.workerId && s.shiftKind !== "project_task" && (s.eventType === "work" || s.eventType === "training")
            ? s.workerId
            : null;

        const canEditOpBadges =
          Boolean(paletteWorkerId && onRemoveOperationalBadge && !scheduleDragLock && !anyAuto);

        const opBadges = [
          ...new Set(
            row.shifts.flatMap((x) => (x.operationalBadges ?? []).map((c) => c.trim().toUpperCase()).filter(Boolean)),
          ),
        ];

        const displayedShiftCode =
          s.shiftKind === "workforce" && s.eventType === "work"
            ? displayStandardShiftCode(s, { fallbackCode: row.code })
            : (s.shiftCode ?? "");
        const rowCodeBadgeTone = shiftCodeToneClassForRowBadge(row.code);

        return (
          <div
            key={row.key}
            role="button"
            tabIndex={0}
            data-schedule-interactive
            draggable={canDrag}
            title={tip || undefined}
            className={`w-full rounded-lg text-left shadow-sm transition-colors hover:brightness-[0.97] ${
              summary ? "px-1 py-px text-[10px] leading-tight" : "px-1.5 py-1.5 text-[11px] leading-snug"
            } ${anyAuto ? "opacity-[0.92]" : ""} ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-default"} ${chipLocked ? "pointer-events-none" : ""} ${cardCls} ${openCls} ${
              paletteWorkerId && onPaletteDrop && dragSession?.kind === "palette" ? "ring-1 ring-inset ring-sky-400/50" : ""
            }`}
            onDragOver={(e) => {
              if (!paletteWorkerId || !onPaletteDrop || paletteInteractionsBlocked) return;
              if (dragSession?.kind !== "palette") return;
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = "copy";
            }}
            onDrop={(e) => {
              if (!paletteWorkerId || !onPaletteDrop || paletteInteractionsBlocked) return;
              const pl = readPaletteDragPayload(e.dataTransfer);
              if (pl) {
                e.preventDefault();
                e.stopPropagation();
                onPaletteDrop(paletteWorkerId, cellDate, pl);
                return;
              }
              if (dragSession?.kind === "palette") {
                e.preventDefault();
                e.stopPropagation();
                onPaletteDrop(paletteWorkerId, cellDate, {
                  paletteKind: dragSession.paletteKind,
                  code: dragSession.code,
                });
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (scheduleDragLock || anyAuto) return;
              onSelectShift(s);
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (scheduleDragLock || anyAuto) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectShift(s);
              }
            }}
            onDragStart={(e) => {
              if (!shiftDragEnabled || anyAuto || row.shifts.length !== 1) {
                e.preventDefault();
                return;
              }
              const dup = e.shiftKey;
              setShiftDragData(e.dataTransfer, { shiftId: s.id, duplicate: dup });
              attachShiftDragPreview(e, dup);
              flushSync(() => onShiftDragSessionStart({ kind: "shift", shiftId: s.id, duplicate: dup }));
            }}
            onDragEnd={onShiftDragSessionEnd}
          >
            <div className="min-w-0">
              {summary ? (
                <>
                  <div className="flex min-w-0 items-center gap-0.5">
                    {s.shiftCode && s.shiftKind !== "project_task" ? (
                      <span
                        className={cn(
                          "mr-1 inline-flex shrink-0 items-center rounded px-1 py-0 text-[9px] font-bold uppercase tracking-wide",
                          shiftCodeBadgeToneClasses(displayedShiftCode),
                        )}
                      >
                        {displayedShiftCode}
                      </span>
                    ) : null}
                    {canTapAttendance ? (
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left font-semibold leading-tight text-ds-foreground underline-offset-2 hover:underline"
                        title="Mark attendance (sick / DNS)"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!s.workerId) return;
                          onOpenWorkerAttendance?.({
                            workerId: s.workerId,
                            date: cellDate,
                            label: row.name,
                          });
                        }}
                      >
                        {row.name}
                      </button>
                    ) : (
                      <span className="min-w-0 flex-1 truncate font-semibold leading-tight">{row.name}</span>
                    )}
                    {attendanceMark ? (
                      <span className="shrink-0 rounded bg-[#e8706f] px-1 py-px text-[8px] font-bold uppercase leading-none text-white">
                        {attendanceMark === "dns" ? "DNS" : "Sick"}
                      </span>
                    ) : null}
                    <span className="flex min-w-0 shrink-0 items-center gap-0.5">
                      {certUnion.length ? (
                        <ScheduleShiftCertChips shift={s} size="compact" requiredOverride={certUnion} />
                      ) : null}
                      {bld ? (
                        <span className="inline-flex shrink-0 items-center rounded border border-pulseShell-border bg-pulseShell-elevated/40 px-1 py-px text-[9px] font-bold leading-none text-ds-muted">
                          {bld.code}
                        </span>
                      ) : null}
                      {opBadges.length > 0 ? (
                        <OperationalBadgeStack
                          codes={opBadges}
                          maxVisible={6}
                          onRemove={
                            canEditOpBadges && paletteWorkerId
                              ? (code) => onRemoveOperationalBadge?.(paletteWorkerId, cellDate, code)
                              : undefined
                          }
                        />
                      ) : null}
                      <span
                        className={cn(
                          "ml-auto inline-flex shrink-0 items-center rounded px-1 py-px text-[9px] font-bold leading-none tabular-nums tracking-tight",
                          rowCodeBadgeTone ??
                            (st
                              ? `${st.bg} ${st.border} ${st.text} border`
                              : "border border-pulseShell-border bg-pulseShell-elevated text-ds-foreground"),
                        )}
                      >
                        {row.code}
                      </span>
                    </span>
                  </div>
                  {row.shifts.length > 1 ? (
                    <p className="mt-0.5 truncate text-[9px] opacity-75">{row.shifts.length} blocks</p>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="flex min-w-0 flex-wrap items-center gap-1">
                    {s.shiftCode && s.shiftKind !== "project_task" ? (
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center rounded px-1 py-0 text-[9px] font-bold uppercase tracking-wide",
                          shiftCodeBadgeToneClasses(displayedShiftCode),
                        )}
                      >
                        {displayedShiftCode}
                      </span>
                    ) : null}
                    {canTapAttendance ? (
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left font-semibold leading-tight text-ds-foreground underline-offset-2 hover:underline"
                        title="Mark attendance (sick / DNS)"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!s.workerId) return;
                          onOpenWorkerAttendance?.({
                            workerId: s.workerId,
                            date: cellDate,
                            label: row.name,
                          });
                        }}
                      >
                        {row.name}
                      </button>
                    ) : (
                      <p className="min-w-0 flex-1 truncate font-semibold leading-tight">{row.name}</p>
                    )}
                    {attendanceMark ? (
                      <span className="shrink-0 rounded bg-[#e8706f] px-1 py-0.5 text-[9px] font-bold uppercase leading-none text-white">
                        {attendanceMark === "dns" ? "DNS" : "Sick"}
                      </span>
                    ) : null}
                    <span className="ml-auto flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-1">
                      {certUnion.length ? (
                        <ScheduleShiftCertChips shift={s} size="day" requiredOverride={certUnion} />
                      ) : null}
                      {bld ? (
                        <span className="inline-flex shrink-0 items-center rounded-md border border-pulseShell-border bg-pulseShell-elevated/40 px-1.5 py-0.5 text-[10px] font-bold leading-none text-ds-muted">
                          {bld.code}
                        </span>
                      ) : null}
                      {opBadges.length > 0 ? (
                        <OperationalBadgeStack
                          codes={opBadges}
                          maxVisible={8}
                          onRemove={
                            canEditOpBadges && paletteWorkerId
                              ? (code) => onRemoveOperationalBadge?.(paletteWorkerId, cellDate, code)
                              : undefined
                          }
                        />
                      ) : null}
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-none tabular-nums tracking-tight",
                          rowCodeBadgeTone ??
                            (st
                              ? `${st.bg} ${st.border} ${st.text} border`
                              : "border border-pulseShell-border bg-pulseShell-elevated text-ds-foreground"),
                        )}
                      >
                        {row.code}
                      </span>
                    </span>
                  </div>
                  {row.shifts.length > 1 ? (
                    <p className="mt-1 truncate text-[10px] opacity-80">{row.shifts.length} blocks — tap to edit first</p>
                  ) : s.shiftKind === "project_task" && s.projectName ? (
                    <p className="mt-1 truncate text-[10px] opacity-90">{s.projectName}</p>
                  ) : (
                    <p className="mt-1 truncate text-[10px] opacity-90">
                      {s.shiftKind === "project_task" ? "Project" : `${roleLb} · ${zone}`}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
