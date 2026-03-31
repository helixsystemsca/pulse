"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMemo } from "react";
import { monthGrid, monthLabel } from "@/lib/schedule/calendar";
import { formatTimeRange } from "@/lib/schedule/time-format";
import type { Shift, ShiftTypeConfig, Worker, Zone } from "@/lib/schedule/types";
import type { ScheduleSettings } from "@/lib/schedule/types";
import type { ScheduleRoleDefinition } from "@/lib/schedule/types";

const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Props = {
  year: number;
  monthIndex: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  shifts: Shift[];
  workers: Worker[];
  zones: Zone[];
  roles: ScheduleRoleDefinition[];
  shiftTypes: ShiftTypeConfig[];
  settings: ScheduleSettings;
  onSelectShift: (shift: Shift) => void;
  onAddForDate: (iso: string) => void;
};

export function ScheduleCalendarGrid({
  year,
  monthIndex,
  onPrevMonth,
  onNextMonth,
  shifts,
  workers,
  zones,
  roles,
  shiftTypes,
  settings,
  onSelectShift,
  onAddForDate,
}: Props) {
  const cells = useMemo(() => monthGrid(year, monthIndex), [year, monthIndex]);
  const typeMap = useMemo(() => new Map(shiftTypes.map((t) => [t.key, t])), [shiftTypes]);
  const zoneMap = useMemo(() => new Map(zones.map((z) => [z.id, z.label])), [zones]);
  const roleMap = useMemo(() => new Map(roles.map((r) => [r.id, r.label])), [roles]);
  const workerMap = useMemo(() => new Map(workers.map((w) => [w.id, w])), [workers]);

  const byDate = useMemo(() => {
    const m = new Map<string, Shift[]>();
    for (const s of shifts) {
      const d = parseShiftMonth(s.date);
      if (d.getFullYear() !== year || d.getMonth() !== monthIndex) continue;
      const list = m.get(s.date) ?? [];
      list.push(s);
      m.set(s.date, list);
    }
    for (const [, list] of m) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return m;
  }, [shifts, year, monthIndex]);

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
        <h2 className="text-lg font-semibold text-pulse-navy">{monthLabel(year, monthIndex)}</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white p-2 text-pulse-navy shadow-sm hover:bg-slate-50"
            onClick={onPrevMonth}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white p-2 text-pulse-navy shadow-sm hover:bg-slate-50"
            onClick={onNextMonth}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px border-b border-slate-100 bg-slate-200/80">
        {WEEK.map((d) => (
          <div
            key={d}
            className="bg-slate-50/90 px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-pulse-muted"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-slate-200/80">
        {cells.map((c) => {
          const dayShifts = byDate.get(c.date) ?? [];
          return (
            <div
              key={c.date}
              className={`flex min-h-[7.5rem] flex-col bg-white ${
                c.inMonth ? "" : "bg-slate-50/50 opacity-80"
              }`}
            >
              <div className="flex items-center justify-between gap-1 border-b border-transparent px-1.5 pt-1.5">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                    c.inMonth ? "text-pulse-navy" : "text-pulse-muted"
                  }`}
                >
                  {c.dayOfMonth}
                </span>
                {c.inMonth ? (
                  <button
                    type="button"
                    className="rounded-md p-1 text-pulse-muted hover:bg-slate-100 hover:text-pulse-accent"
                    aria-label={`Add shift on ${c.date}`}
                    onClick={() => onAddForDate(c.date)}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <div className="flex max-h-[11rem] flex-1 flex-col gap-1 overflow-y-auto px-1 pb-2 pt-1">
                {dayShifts.map((s) => {
                  const st = typeMap.get(s.shiftType);
                  const w = s.workerId ? workerMap.get(s.workerId) : null;
                  const name = w?.name ?? "Open";
                  const zone = zoneMap.get(s.zoneId) ?? "—";
                  const roleLb = roleMap.get(s.role) ?? s.role;
                  const cls = st
                    ? `${st.bg} ${st.border} ${st.text} border`
                    : "border border-slate-200 bg-slate-50 text-pulse-navy";
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onSelectShift(s)}
                      className={`w-full rounded-lg px-1.5 py-1.5 text-left text-[11px] leading-snug shadow-sm transition-colors hover:brightness-[0.97] ${cls}`}
                    >
                      <p className="truncate font-semibold">{name}</p>
                      <p className="truncate opacity-90">
                        {formatTimeRange(s.startTime, s.endTime, settings.timeFormat)}
                      </p>
                      <p className="truncate text-[10px] opacity-90">
                        {roleLb} · {zone}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function parseShiftMonth(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
