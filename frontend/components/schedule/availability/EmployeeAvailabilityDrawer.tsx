"use client";

import { useEffect, useMemo, useState } from "react";
import { PulseDrawer } from "@/components/schedule/PulseDrawer";
import { normalizeWeekdayKey } from "@/lib/schedule/recurring";
import type { WeekdayKey, Worker, WorkerSchedulingConstraints } from "@/lib/schedule/types";
import { buttonVariants } from "@/styles/button-variants";

const WEEKDAYS: { key: WeekdayKey; label: string }[] = [
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
  { key: "sunday", label: "Sun" },
];

type Props = {
  open: boolean;
  onClose: () => void;
  workers: Worker[];
  setWorkers: (workers: Worker[]) => void;
};

export function EmployeeAvailabilityDrawer({ open, onClose, workers, setWorkers }: Props) {
  const active = useMemo(() => workers.filter((w) => w.active), [workers]);
  const [workerId, setWorkerId] = useState<string>(active[0]?.id ?? "");

  useEffect(() => {
    if (open && active.length && !active.some((w) => w.id === workerId)) {
      setWorkerId(active[0]!.id);
    }
  }, [open, active, workerId]);

  const w = workers.find((x) => x.id === workerId);

  const [dayAvail, setDayAvail] = useState<Record<string, { available: boolean; start: string; end: string }>>({});
  const [constraints, setConstraints] = useState<WorkerSchedulingConstraints>({});

  useEffect(() => {
    if (!w) return;
    const next: Record<string, { available: boolean; start: string; end: string }> = {};
    for (const { key } of WEEKDAYS) {
      const d = w.availability?.[key] ?? w.availability?.[normalizeWeekdayKey(key)];
      next[key] = {
        available: d?.available !== false,
        start: d?.start ?? "",
        end: d?.end ?? "",
      };
    }
    setDayAvail(next);
    setConstraints(w.schedulingConstraints ?? {});
  }, [w]);

  function save() {
    if (!w) return;
    const availability: Worker["availability"] = {};
    for (const { key } of WEEKDAYS) {
      const row = dayAvail[key];
      if (!row) continue;
      availability[key] = {
        available: row.available,
        ...(row.start ? { start: row.start } : {}),
        ...(row.end ? { end: row.end } : {}),
      };
    }
    const sc: WorkerSchedulingConstraints = {};
    if (constraints.noNights) sc.noNights = true;
    if (constraints.afternoonsOnly) sc.afternoonsOnly = true;
    if (constraints.morningsOnly) sc.morningsOnly = true;

    const nextWorkers = workers.map((x) =>
      x.id === w.id
        ? {
            ...x,
            availability,
            schedulingConstraints: Object.keys(sc).length ? sc : undefined,
          }
        : x,
    );
    setWorkers(nextWorkers);
    onClose();
  }

  return (
    <PulseDrawer
      open={open}
      onClose={onClose}
      wide
      placement="center"
      title="Employee availability"
      subtitle="Recurring windows, unavailable days, and shift restrictions feed the operational scheduling layer."
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={buttonVariants({ surface: "light", intent: "secondary" })} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={buttonVariants({ surface: "light", intent: "accent" })} onClick={save}>
            Save profile
          </button>
        </div>
      }
    >
      {!w ? (
        <p className="text-sm text-ds-muted">No workers available.</p>
      ) : (
        <div className="space-y-6 px-1">
          <label className="block text-xs font-semibold uppercase tracking-wide text-ds-muted">
            Employee
            <select
              className="mt-1.5 w-full rounded-xl border border-pulseShell-border bg-white px-3 py-2 text-sm dark:bg-slate-950"
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
            >
              {active.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Weekly availability</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {WEEKDAYS.map(({ key, label }) => {
                const row = dayAvail[key] ?? { available: true, start: "", end: "" };
                return (
                  <div
                    key={key}
                    className={`rounded-xl border px-3 py-2 ${row.available ? "border-emerald-500/25 bg-emerald-50/40 dark:bg-emerald-950/25" : "border-pulseShell-border bg-slate-50/80 opacity-70 dark:bg-slate-900/50"}`}
                  >
                    <label className="flex items-center gap-2 text-sm font-semibold text-ds-foreground">
                      <input
                        type="checkbox"
                        checked={row.available}
                        onChange={(e) =>
                          setDayAvail((prev) => ({
                            ...prev,
                            [key]: { ...row, available: e.target.checked },
                          }))
                        }
                      />
                      {label}
                    </label>
                    <div className="mt-2 flex gap-2">
                      <input
                        type="time"
                        className="w-full rounded-lg border border-pulseShell-border bg-white px-2 py-1 text-xs dark:bg-slate-950"
                        value={row.start}
                        disabled={!row.available}
                        onChange={(e) =>
                          setDayAvail((prev) => ({
                            ...prev,
                            [key]: { ...row, start: e.target.value },
                          }))
                        }
                      />
                      <input
                        type="time"
                        className="w-full rounded-lg border border-pulseShell-border bg-white px-2 py-1 text-xs dark:bg-slate-950"
                        value={row.end}
                        disabled={!row.available}
                        onChange={(e) =>
                          setDayAvail((prev) => ({
                            ...prev,
                            [key]: { ...row, end: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Shift restrictions</p>
            <div className="mt-2 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!constraints.noNights}
                  onChange={(e) =>
                    setConstraints((c) => {
                      const next = { ...c };
                      if (e.target.checked) next.noNights = true;
                      else delete next.noNights;
                      return next;
                    })
                  }
                />
                Cannot work nights
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!constraints.afternoonsOnly}
                  onChange={(e) =>
                    setConstraints((c) => {
                      const next = { ...c };
                      if (e.target.checked) next.afternoonsOnly = true;
                      else delete next.afternoonsOnly;
                      return next;
                    })
                  }
                />
                Afternoons only
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!constraints.morningsOnly}
                  onChange={(e) =>
                    setConstraints((c) => {
                      const next = { ...c };
                      if (e.target.checked) next.morningsOnly = true;
                      else delete next.morningsOnly;
                      return next;
                    })
                  }
                />
                Mornings only
              </label>
            </div>
          </div>
        </div>
      )}
    </PulseDrawer>
  );
}
