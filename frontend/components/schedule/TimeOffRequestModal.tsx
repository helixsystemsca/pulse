"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { Worker, Shift, ScheduleSettings, TimeOffBlock } from "@/lib/schedule/types";
import type { ProjectScheduleOverlayMeta } from "@/lib/schedule/project-overlay-styles";
import { assessPtoApprovalWarnings } from "@/lib/schedule/project-pto-conflicts";
import { PulseDrawer } from "./PulseDrawer";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

type Props = {
  open: boolean;
  workers: Worker[];
  projects?: readonly ProjectScheduleOverlayMeta[];
  shifts?: Shift[];
  settings?: ScheduleSettings;
  timeOffBlocks?: TimeOffBlock[];
  showConflictHints?: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    workerId: string;
    startDate: string;
    endDate: string;
    status: "approved" | "pending";
    kind: "vacation" | "sick";
  }) => void;
};

/**
 * Time-off entry with non-blocking project staffing conflict hints for leadership.
 */
export function TimeOffRequestModal({
  open,
  workers,
  projects = [],
  shifts = [],
  settings,
  timeOffBlocks = [],
  showConflictHints = true,
  onClose,
  onSubmit,
}: Props) {
  const [workerId, setWorkerId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [status, setStatus] = useState<"approved" | "pending">("approved");
  const [kind, setKind] = useState<"vacation" | "sick">("vacation");

  const warnings = useMemo(() => {
    if (!showConflictHints || !workerId || !start || !end || start > end) return [];
    if (!settings) return [];
    return assessPtoApprovalWarnings({
      workerId,
      ptoStart: start,
      ptoEnd: end,
      projects,
      shifts,
      workers,
      settings,
      timeOffBlocks,
    });
  }, [showConflictHints, workerId, start, end, projects, shifts, workers, settings, timeOffBlocks]);

  return (
    <PulseDrawer
      open={open}
      title="Time off"
      subtitle="Approved entries affect availability hints. Project overlaps are warnings only — they do not block approval."
      onClose={onClose}
      placement="center"
      labelledBy="timeoff-drawer-title"
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="text-sm font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className={cn(buttonVariants({ surface: "light", intent: "accent" }), "px-5 py-2.5 disabled:opacity-40")}
            disabled={!workerId || !start || !end}
            onClick={() => {
              onSubmit({ workerId, startDate: start, endDate: end, status, kind });
              onClose();
            }}
          >
            Save block
          </button>
        </div>
      }
    >
      <div className="mx-auto max-w-lg space-y-4">
        <h3 id="timeoff-drawer-title" className="sr-only">
          Time off request
        </h3>
        {warnings.length > 0 ? (
          <div
            role="status"
            className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-3 dark:border-amber-900/50 dark:bg-amber-950/40"
          >
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
              <div className="min-w-0 space-y-2">
                <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">Staffing impact warnings</p>
                <ul className="space-y-1.5 text-xs text-amber-900/90 dark:text-amber-100/90">
                  {warnings.map((w) => (
                    <li key={`${w.code}-${w.message}`}>
                      <span
                        className={cn(
                          "font-semibold",
                          w.severity === "critical" ? "text-rose-800 dark:text-rose-300" : "",
                        )}
                      >
                        {w.severity === "critical" ? "Critical: " : ""}
                      </span>
                      {w.message}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : null}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-pulse-muted" htmlFor="pto-worker">
            Worker
          </label>
          <select
            id="pto-worker"
            className="mt-1.5 w-full rounded-[10px] border border-pulseShell-border bg-pulseShell-surface px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100"
            value={workerId}
            onChange={(e) => setWorkerId(e.target.value)}
          >
            <option value="">Select…</option>
            {workers
              .filter((w) => w.active)
              .map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400" htmlFor="pto-start">
              Start
            </label>
            <input
              id="pto-start"
              type="date"
              className="mt-1.5 w-full rounded-[10px] border border-pulseShell-border bg-pulseShell-surface px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400" htmlFor="pto-end">
              End
            </label>
            <input
              id="pto-end"
              type="date"
              className="mt-1.5 w-full rounded-[10px] border border-pulseShell-border bg-pulseShell-surface px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400" htmlFor="pto-kind">
            Type
          </label>
          <select
            id="pto-kind"
            className="mt-1.5 w-full rounded-[10px] border border-pulseShell-border bg-pulseShell-surface px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100"
            value={kind}
            onChange={(e) => setKind(e.target.value as "vacation" | "sick")}
          >
            <option value="vacation">Vacation</option>
            <option value="sick">Sick</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400" htmlFor="pto-status">
            Status
          </label>
          <select
            id="pto-status"
            className="mt-1.5 w-full rounded-[10px] border border-pulseShell-border bg-pulseShell-surface px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100"
            value={status}
            onChange={(e) => setStatus(e.target.value as "approved" | "pending")}
          >
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>
    </PulseDrawer>
  );
}
