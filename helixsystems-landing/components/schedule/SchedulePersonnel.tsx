"use client";

import { useMemo } from "react";
import { monthLabel, parseLocalDate } from "@/lib/schedule/calendar";
import type { Shift, Worker } from "@/lib/schedule/types";
import type { ScheduleRoleDefinition } from "@/lib/schedule/types";

type Props = {
  workers: Worker[];
  shifts: Shift[];
  roles: ScheduleRoleDefinition[];
  year: number;
  monthIndex: number;
  /** When a shift is being dragged on the calendar, ignore personnel table interactions. */
  scheduleDragLocked?: boolean;
};

export function SchedulePersonnel({
  workers,
  shifts,
  roles,
  year,
  monthIndex,
  scheduleDragLocked = false,
}: Props) {
  const roleMap = useMemo(() => new Map(roles.map((r) => [r.id, r.label])), [roles]);

  const rows = useMemo(() => {
    return workers.map((w) => {
      const count = shifts.filter((s) => {
        const d = parseLocalDate(s.date);
        return d.getFullYear() === year && d.getMonth() === monthIndex && s.workerId === w.id;
      }).length;
      return { w, count };
    });
  }, [workers, shifts, year, monthIndex]);

  return (
    <div
      className={`rounded-md border border-pulseShell-border bg-pulseShell-surface shadow-[var(--pulse-shell-shadow)] ${scheduleDragLocked ? "pointer-events-none" : ""}`}
    >
      <div className="border-b border-pulseShell-border px-5 py-4">
        <h2 className="text-lg font-semibold text-ds-foreground">Personnel</h2>
        <p className="mt-1 text-sm text-ds-muted">Workers and shift load for {monthLabel(year, monthIndex)}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead>
            <tr className="border-b border-pulseShell-border text-[11px] font-semibold uppercase tracking-wide text-ds-muted">
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Job role</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Shifts (month)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ w, count }) => (
              <tr
                key={w.id}
                className="ds-table-row-hover border-b border-pulseShell-border/60 last:border-0"
              >
                <td className="px-5 py-3 font-medium text-ds-foreground">{w.name}</td>
                <td className="px-5 py-3 text-ds-muted">{roleMap.get(w.role) ?? w.role}</td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                      w.active ? "app-badge-emerald" : "app-badge-slate"
                    }`}
                  >
                    {w.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-ds-foreground">{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
