"use client";

import { flushSync } from "react-dom";
import { parseLocalDate } from "@/lib/schedule/calendar";
import { evaluateAvailabilityCell } from "@/lib/schedule/availability-layer";
import { attachWorkerDragPreview, readWorkerDragPayload, setWorkerDragData } from "@/lib/schedule/drag";
import { workerHighlightOverlayClass } from "@/lib/schedule/drag-highlight-classes";
import type { WorkerDayHighlight } from "@/lib/schedule/worker-drag-highlights";
import type { ScheduleDragSession, ScheduleSettings, Shift, TimeOffBlock, Worker, Zone } from "@/lib/schedule/types";
import { cn } from "@/lib/cn";
import { GripVertical } from "lucide-react";
import { AssignmentCard } from "./AssignmentCard";
import { AvailabilityCellFrame } from "./AvailabilityCellFrame";

type Props = {
  weekDates: string[];
  workers: Worker[];
  shifts: Shift[];
  zones: Zone[];
  settings: ScheduleSettings;
  timeOffBlocks: TimeOffBlock[];
  dragSession: ScheduleDragSession | null;
  workerHighlightByDate: Record<string, WorkerDayHighlight> | null;
  rosterDragEnabled: boolean;
  scheduleDragLock: boolean;
  onWorkerDrop: (workerId: string, date: string) => void;
  onSelectShift: (shift: Shift) => void;
  onDragSessionStart: (session: ScheduleDragSession) => void;
  onDragSessionEnd: () => void;
};

function headerLabel(iso: string): string {
  try {
    const d = parseLocalDate(iso);
    return d.toLocaleDateString(undefined, { weekday: "short", month: "numeric", day: "numeric" });
  } catch {
    return iso;
  }
}

export function ScheduleEmployeeWeekGrid({
  weekDates,
  workers,
  shifts,
  zones,
  settings,
  timeOffBlocks,
  dragSession,
  workerHighlightByDate,
  rosterDragEnabled,
  scheduleDragLock,
  onWorkerDrop,
  onSelectShift,
  onDragSessionStart,
  onDragSessionEnd,
}: Props) {
  const zoneMap = new Map(zones.map((z) => [z.id, z]));
  const sorted = [...workers].filter((w) => w.active).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  return (
    <div className="overflow-x-auto rounded-lg border border-pulseShell-border bg-pulseShell-surface shadow-[var(--pulse-shell-shadow)]">
      <table className="min-w-[720px] w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-pulseShell-border bg-pulseShell-header-row/80">
            <th className="sticky left-0 z-[2] min-w-[10rem] border-r border-pulseShell-border px-2 py-2 text-left text-xs font-bold uppercase tracking-wide text-ds-muted">
              Employee
            </th>
            {weekDates.map((d) => (
              <th key={d} className="px-1 py-2 text-center text-xs font-bold uppercase tracking-wide text-ds-muted">
                {headerLabel(d)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((worker) => (
            <tr key={worker.id} className="border-b border-pulseShell-border/80">
              <td className="sticky left-0 z-[1] border-r border-pulseShell-border bg-pulseShell-surface px-2 py-1.5 align-top">
                <div className="flex items-center gap-1">
                  <span
                    role="button"
                    tabIndex={0}
                    draggable={rosterDragEnabled}
                    title="Drag to your row for this week"
                    className={cn(
                      "inline-flex shrink-0 rounded p-0.5 text-ds-muted hover:bg-ds-interactive-hover/50",
                      rosterDragEnabled ? "cursor-grab active:cursor-grabbing" : "cursor-not-allowed opacity-50",
                    )}
                    onDragStart={(e) => {
                      if (!rosterDragEnabled) {
                        e.preventDefault();
                        return;
                      }
                      setWorkerDragData(e.dataTransfer, { workerId: worker.id });
                      attachWorkerDragPreview(e, worker.name);
                      flushSync(() => onDragSessionStart({ kind: "worker", workerId: worker.id }));
                    }}
                    onDragEnd={onDragSessionEnd}
                  >
                    <GripVertical className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 truncate font-semibold text-ds-foreground">{worker.name}</span>
                </div>
              </td>
              {weekDates.map((date) => {
                const evaluation = evaluateAvailabilityCell(worker, date, settings, timeOffBlocks);
                const rowShifts = shifts.filter((s) => s.workerId === worker.id && s.date === date && s.shiftKind !== "project_task");
                const hl =
                  dragSession?.kind === "worker" && dragSession.workerId === worker.id ? workerHighlightByDate?.[date] : undefined;

                return (
                  <td key={`${worker.id}-${date}`} className="align-top p-1">
                    <div
                      className={cn("relative rounded-md", hl ? workerHighlightOverlayClass(hl.tone) : "")}
                      title={hl?.tooltip}
                      onDragOver={(e) => {
                        if (scheduleDragLock || !rosterDragEnabled) return;
                        const dt = e.dataTransfer;
                        if (!dragSession || dragSession.kind !== "worker" || dragSession.workerId !== worker.id) return;
                        e.preventDefault();
                        dt.dropEffect = "copy";
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (scheduleDragLock || !rosterDragEnabled) return;
                        const wp = readWorkerDragPayload(e.dataTransfer);
                        if (!wp || wp.workerId !== worker.id) return;
                        onWorkerDrop(worker.id, date);
                      }}
                    >
                      <AvailabilityCellFrame evaluation={evaluation}>
                        <div className="flex flex-col gap-1">
                          {rowShifts.length === 0 ? (
                            <p className="px-0.5 py-1 text-[10px] text-ds-muted">—</p>
                          ) : (
                            rowShifts.map((s) => (
                              <AssignmentCard
                                key={s.id}
                                shift={s}
                                workerName={worker.name}
                                zone={zoneMap.get(s.zoneId)}
                                settings={settings}
                                onOpen={() => onSelectShift(s)}
                              />
                            ))
                          )}
                        </div>
                      </AvailabilityCellFrame>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-pulseShell-border px-3 py-2 text-[11px] text-ds-muted">
        Availability tinting applies to the cell (not badges). Shift codes are the primary assignment identity; TRN/PTO/GG etc.
        are operational metadata. Drag the grip on your row to schedule — drops only match the same employee row.
      </p>
    </div>
  );
}
