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
};

export function SchedulePersonnel({ workers, shifts, roles, year, monthIndex }: Props) {
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
    <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-lg font-semibold text-pulse-navy">Personnel</h2>
        <p className="mt-1 text-sm text-pulse-muted">Workers and shift load for {monthLabel(year, monthIndex)}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-pulse-muted">
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Job role</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Shifts (month)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ w, count }) => (
              <tr key={w.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                <td className="px-5 py-3 font-medium text-pulse-navy">{w.name}</td>
                <td className="px-5 py-3 text-pulse-muted">{roleMap.get(w.role) ?? w.role}</td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                      w.active ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/80" : "bg-slate-100 text-pulse-muted"
                    }`}
                  >
                    {w.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-pulse-navy">{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
