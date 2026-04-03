"use client";

import { useState } from "react";
import type { Worker } from "@/lib/schedule/types";
import { PulseDrawer } from "./PulseDrawer";

type Props = {
  open: boolean;
  workers: Worker[];
  onClose: () => void;
  onSubmit: (payload: { workerId: string; startDate: string; endDate: string; status: "approved" | "pending" }) => void;
};

/**
 * Placeholder hook for time-off: approved blocks feed conflict hints only (no real workflow).
 */
export function TimeOffRequestModal({ open, workers, onClose, onSubmit }: Props) {
  const [workerId, setWorkerId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [status, setStatus] = useState<"approved" | "pending">("approved");

  return (
    <PulseDrawer
      open={open}
      title="Time off (demo)"
      subtitle="Approved entries block availability hints on the schedule. Full workflow coming later."
      onClose={onClose}
      labelledBy="timeoff-drawer-title"
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="text-sm font-semibold text-pulse-muted hover:text-pulse-navy"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-[10px] bg-[#2B4C7E] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#234066] disabled:opacity-40"
            disabled={!workerId || !start || !end}
            onClick={() => {
              onSubmit({ workerId, startDate: start, endDate: end, status });
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
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-pulse-muted" htmlFor="pto-worker">
            Worker
          </label>
          <select
            id="pto-worker"
            className="mt-1.5 w-full rounded-[10px] border border-slate-200/90 px-3 py-2.5 text-sm"
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
            <label className="text-[11px] font-semibold uppercase tracking-wider text-pulse-muted" htmlFor="pto-start">
              Start
            </label>
            <input
              id="pto-start"
              type="date"
              className="mt-1.5 w-full rounded-[10px] border border-slate-200/90 px-3 py-2.5 text-sm"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-pulse-muted" htmlFor="pto-end">
              End
            </label>
            <input
              id="pto-end"
              type="date"
              className="mt-1.5 w-full rounded-[10px] border border-slate-200/90 px-3 py-2.5 text-sm"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-pulse-muted" htmlFor="pto-status">
            Status (mock)
          </label>
          <select
            id="pto-status"
            className="mt-1.5 w-full rounded-[10px] border border-slate-200/90 px-3 py-2.5 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as "approved" | "pending")}
          >
            <option value="approved">Approved (blocks hints)</option>
            <option value="pending">Pending (informational only)</option>
          </select>
        </div>
      </div>
    </PulseDrawer>
  );
}
