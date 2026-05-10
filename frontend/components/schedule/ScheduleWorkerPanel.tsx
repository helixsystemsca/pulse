"use client";

import { ChevronDown, GripVertical } from "lucide-react";
import { useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { attachWorkerDragPreview, setWorkerDragData } from "@/lib/schedule/drag";
import { recurringShiftCodeMapFromWorkers } from "@/lib/schedule/shift-codes";
import {
  bandSortOrder,
  compareWorkersInSchedulePanel,
  primaryBandForWorker,
  roleIndicatorForSchedule,
  shiftCodeBadgeToneClasses,
  shiftCodeForWorkerPanel,
  type WorkerPrimaryBand,
} from "@/lib/schedule/scheduleWorkerPanelSort";
import type { ScheduleDragSession, SchedulePlacementBand, ScheduleRoleDefinition, Shift, Worker } from "@/lib/schedule/types";

const BAND_SECTION_ORDER: WorkerPrimaryBand[] = ["D", "A", "N", "none"];

const BAND_SECTION_LABEL: Record<WorkerPrimaryBand, string> = {
  D: "Day shifts",
  A: "Afternoon shifts",
  N: "Night shifts",
  none: "No recurring template",
};

type Props = {
  workers: Worker[];
  rosterDragEnabled: boolean;
  dragSession: ScheduleDragSession | null;
  shifts: Shift[];
  roles: ScheduleRoleDefinition[];
  placementDutyRole: string;
  onPlacementDutyRoleChange: (roleId: string) => void;
  placementBand: SchedulePlacementBand;
  onPlacementBandChange: (band: SchedulePlacementBand) => void;
  onDragSessionStart: (session: ScheduleDragSession) => void;
  onDragSessionEnd: () => void;
};

export function ScheduleWorkerPanel({
  workers,
  rosterDragEnabled,
  dragSession,
  shifts,
  roles,
  placementDutyRole,
  onPlacementDutyRoleChange,
  placementBand,
  onPlacementBandChange,
  onDragSessionStart,
  onDragSessionEnd,
}: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(BAND_SECTION_ORDER.map((k) => [k, true])),
  );

  const activeWorkers = useMemo(() => workers.filter((w) => w.active), [workers]);

  const sortedWorkers = useMemo(
    () => [...activeWorkers].sort(compareWorkersInSchedulePanel),
    [activeWorkers],
  );

  const workersByBand = useMemo(() => {
    const m: Record<WorkerPrimaryBand, Worker[]> = { D: [], A: [], N: [], none: [] };
    for (const w of sortedWorkers) {
      m[primaryBandForWorker(w)].push(w);
    }
    return m;
  }, [sortedWorkers]);

  const recurringCodeMap = useMemo(() => recurringShiftCodeMapFromWorkers(workers), [workers]);

  const activeCertRequirements: string[] = useMemo(() => {
    if (!dragSession || dragSession.kind !== "shift") return [];
    const s = shifts.find((x) => x.id === dragSession.shiftId);
    return (s?.required_certifications ?? []).filter(Boolean) as string[];
  }, [dragSession, shifts]);

  function workerMeetsCerts(worker: Worker, required: string[]): boolean {
    if (!required.length) return true;
    const wc = new Set(worker.certifications ?? []);
    return required.every((c) => wc.has(c));
  }

  return (
    <div className="rounded-md border border-pulseShell-border bg-pulseShell-surface shadow-[var(--pulse-shell-shadow)]">
      <div className="border-b border-pulseShell-border px-3 py-2.5 sm:px-4">
        <h2 className="text-sm font-semibold text-ds-foreground">Workers</h2>
        <p className="mt-0.5 text-[11px] leading-snug text-ds-muted">
          Choose the duty role and shift window, then drag someone onto the calendar to create their assignment.
        </p>
        <div className="mt-3 space-y-2">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-ds-muted" htmlFor="schedule-placement-role">
              Role when placing
            </label>
            <select
              id="schedule-placement-role"
              className="mt-1 w-full rounded-md border border-pulseShell-border bg-pulseShell-elevated px-2 py-1.5 text-xs font-medium text-ds-foreground shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25 dark:bg-ds-secondary"
              value={placementDutyRole}
              disabled={!rosterDragEnabled}
              onChange={(e) => onPlacementDutyRoleChange(e.target.value)}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-ds-muted" htmlFor="schedule-placement-band">
              Shift window
            </label>
            <select
              id="schedule-placement-band"
              className="mt-1 w-full rounded-md border border-pulseShell-border bg-pulseShell-elevated px-2 py-1.5 text-xs font-medium text-ds-foreground shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25 dark:bg-ds-secondary"
              value={placementBand}
              disabled={!rosterDragEnabled}
              onChange={(e) => onPlacementBandChange(e.target.value as SchedulePlacementBand)}
            >
              <option value="template">Match worker template</option>
              <option value="day">Day · 07:00–15:00</option>
              <option value="afternoon">Afternoon · 14:00–22:00</option>
              <option value="night">Night · 22:00–06:00</option>
            </select>
          </div>
        </div>
      </div>
      <div className="max-h-[min(52vh,28rem)] space-y-1 overflow-y-auto px-2 py-2">
        {BAND_SECTION_ORDER.map((band) => {
          const list = workersByBand[band] ?? [];
          if (list.length === 0) return null;
          const isOpen = open[band] !== false;
          return (
            <div key={band} className="rounded-lg border border-pulseShell-border/80 bg-pulseShell-elevated/60">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-xs font-semibold text-ds-foreground hover:bg-ds-interactive-hover/40"
                onClick={() => setOpen((o) => ({ ...o, [band]: !isOpen }))}
                aria-expanded={isOpen}
              >
                <span>{BAND_SECTION_LABEL[band]}</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-ds-muted">
                  {list.length}
                  <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </span>
              </button>
              {isOpen ? (
                <ul className="space-y-1 border-t border-pulseShell-border/60 px-1.5 py-1.5">
                  {list.map((w) => {
                    const eligible = workerMeetsCerts(w, activeCertRequirements);
                    const wc = new Set(w.certifications ?? []);
                    const missingCerts = activeCertRequirements.filter((c) => !wc.has(c));
                    const code = shiftCodeForWorkerPanel(w, recurringCodeMap);
                    const roleInd = roleIndicatorForSchedule(w.role);
                    return (
                      <li key={w.id}>
                        <div
                          role="button"
                          tabIndex={0}
                          draggable={rosterDragEnabled}
                          title={
                            !eligible && missingCerts.length
                              ? `Missing cert: ${missingCerts.join(", ")}`
                              : undefined
                          }
                          className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] leading-tight text-ds-foreground ${
                            rosterDragEnabled
                              ? "cursor-grab border border-transparent bg-[color-mix(in_srgb,var(--ds-success)_8%,var(--ds-surface-primary))] hover:border-ds-border active:cursor-grabbing dark:bg-[color-mix(in_srgb,var(--ds-success)_10%,var(--ds-surface-secondary))]"
                              : "cursor-default opacity-60"
                          } ${!eligible ? "pointer-events-none opacity-40" : ""}`}
                          onDragStart={(e) => {
                            if (!rosterDragEnabled) {
                              e.preventDefault();
                              return;
                            }
                            setWorkerDragData(e.dataTransfer, { workerId: w.id });
                            attachWorkerDragPreview(e, w.name);
                            flushSync(() => onDragSessionStart({ kind: "worker", workerId: w.id }));
                          }}
                          onDragEnd={onDragSessionEnd}
                          onKeyDown={(e) => {
                            if (!rosterDragEnabled) return;
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                            }
                          }}
                        >
                          <GripVertical className="h-3.5 w-3.5 shrink-0 text-ds-muted" aria-hidden />
                          <span className="min-w-0 flex-1 truncate font-medium">{w.name}</span>
                          {roleInd ? (
                            <span className="shrink-0 font-mono text-[10px] font-semibold tabular-nums text-ds-muted">
                              {roleInd}
                            </span>
                          ) : null}
                          {code ? (
                            <span
                              className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold tabular-nums tracking-tight ${shiftCodeBadgeToneClasses(code)}`}
                            >
                              {code}
                            </span>
                          ) : (
                            <span className="shrink-0 text-[10px] text-ds-muted">—</span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
