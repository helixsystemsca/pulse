"use client";

/**
 * ScheduleMyShiftsView
 * Personal shift list for the logged-in worker.
 * Mobile-first. Shows upcoming shifts chronologically.
 * No other workers' data shown.
 */

import { CalendarDays, CheckCircle, Clock } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, isApiMode } from "@/lib/api";
import { firstOpenSchedulePeriodId } from "@/lib/schedule/period-utils";
import type { Shift, Worker, ScheduleSettings } from "@/lib/schedule/types";
import { formatTimeRange } from "@/lib/schedule/time-format";

type PeriodRow = { id: string; start_date: string; end_date: string; status: string };

type AckStatus = { acknowledged: boolean; acknowledged_at?: string | null };

type Props = {
  shifts: Shift[];
  workers: Worker[];
  currentUserId: string | null;
  settings: ScheduleSettings;
  onSelectShift: (shift: Shift) => void;
};

function groupByMonth(shifts: Shift[]): Record<string, Shift[]> {
  const groups: Record<string, Shift[]> = {};
  for (const s of shifts) {
    const month = s.date.slice(0, 7); // YYYY-MM
    if (!groups[month]) groups[month] = [];
    groups[month]!.push(s);
  }
  return groups;
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function shiftTypeLabel(type: string): string {
  if (type === "afternoon") return "Afternoons";
  if (type === "night") return "Nights";
  return "Days";
}

function shiftTypeDot(type: string): string {
  if (type === "afternoon") return "bg-teal-500";
  if (type === "night") return "bg-purple-500";
  return "bg-blue-500";
}

export function ScheduleMyShiftsView({ shifts, settings, onSelectShift }: Props) {
  const [ackPeriodId, setAckPeriodId] = useState<string | null>(null);
  const [ackPeriodLabel, setAckPeriodLabel] = useState<string>("");
  const [ackStatus, setAckStatus] = useState<AckStatus | null>(null);
  const [ackLoading, setAckLoading] = useState(false);
  const [ackBusy, setAckBusy] = useState(false);
  const [ackErr, setAckErr] = useState<string | null>(null);

  const loadAckState = useCallback(async () => {
    if (!isApiMode()) return;
    setAckLoading(true);
    setAckErr(null);
    try {
      const periods = await apiFetch<PeriodRow[]>("/api/v1/pulse/schedule/periods");
      const pid = firstOpenSchedulePeriodId(periods);
      if (!pid) {
        setAckPeriodId(null);
        setAckPeriodLabel("");
        setAckStatus(null);
        return;
      }
      const p = periods.find((x) => x.id === pid);
      setAckPeriodId(pid);
      setAckPeriodLabel(
        p ? `${p.start_date} → ${p.end_date}` : "",
      );
      const st = await apiFetch<AckStatus>(
        `/api/v1/pulse/schedule/acknowledgement/status?period_id=${encodeURIComponent(pid)}`,
      );
      setAckStatus(st);
    } catch {
      setAckPeriodId(null);
      setAckStatus(null);
      setAckErr("Could not load schedule acknowledgement status.");
    } finally {
      setAckLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAckState();
  }, [loadAckState]);

  const acknowledgeSchedule = useCallback(async () => {
    if (!ackPeriodId) return;
    setAckBusy(true);
    setAckErr(null);
    try {
      await apiFetch("/api/v1/pulse/schedule/acknowledge", {
        method: "POST",
        json: { period_id: ackPeriodId },
      });
      setAckStatus({ acknowledged: true });
    } catch (e) {
      setAckErr(e instanceof Error ? e.message : "Could not acknowledge.");
    } finally {
      setAckBusy(false);
    }
  }, [ackPeriodId]);

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = shifts.filter((s) => s.date >= today);
  const past = shifts
    .filter((s) => s.date < today)
    .slice(-10)
    .reverse();

  const AckBanner = () =>
    isApiMode() && ackPeriodId ? (
      <div className="mx-auto mb-6 w-full max-w-lg rounded-md border border-pulseShell-border bg-pulseShell-surface px-4 py-3 shadow-sm">
        {ackLoading ? (
          <p className="text-xs text-ds-muted">Loading schedule status…</p>
        ) : ackErr ? (
          <p className="text-xs text-ds-danger">{ackErr}</p>
        ) : ackStatus?.acknowledged ? (
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            <CheckCircle className="h-4 w-4 shrink-0" aria-hidden />
            Schedule acknowledged
            {ackPeriodLabel ? (
              <span className="font-normal text-ds-muted">· {ackPeriodLabel}</span>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-ds-foreground">
              When you have reviewed your shifts for{" "}
              <span className="font-semibold">{ackPeriodLabel || "this period"}</span>, acknowledge the schedule.
            </p>
            <button
              type="button"
              disabled={ackBusy}
              onClick={() => void acknowledgeSchedule()}
              className="inline-flex items-center gap-2 rounded-md bg-ds-accent px-3 py-2 text-xs font-bold text-ds-accent-foreground hover:bg-ds-accent/90 disabled:opacity-60"
            >
              {ackBusy ? "Saving…" : "Acknowledge schedule"}
            </button>
          </div>
        )}
      </div>
    ) : null;

  if (!upcoming.length && !past.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <AckBanner />
        <CalendarDays className="h-8 w-8 text-ds-muted/40" />
        <p className="text-center text-sm text-ds-muted">
          No shifts scheduled yet.
          <br />
          Your upcoming shifts will appear here.
        </p>
      </div>
    );
  }

  const upcomingByMonth = groupByMonth(upcoming);
  const pastByMonth = groupByMonth(past);

  const ShiftRow = ({ shift }: { shift: Shift }) => (
    <button
      type="button"
      onClick={() => onSelectShift(shift)}
      className="flex w-full items-center gap-3 rounded-md border border-ds-border bg-ds-primary px-4 py-3 text-left transition-colors hover:bg-ds-interactive-hover"
    >
      <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${shiftTypeDot(shift.shiftType)}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ds-foreground">
          {formatDayLabel(shift.date)}
          {shift.shiftCode ? (
            <span className="ml-2 rounded bg-ds-accent/10 px-1.5 py-0.5 text-[10px] font-bold text-ds-accent">
              {shift.shiftCode}
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-ds-muted">
          <Clock className="h-3 w-3 shrink-0" />
          {formatTimeRange(shift.startTime, shift.endTime, settings.timeFormat)}
          {" · "}
          {shiftTypeLabel(shift.shiftType)}
        </p>
      </div>
      <span className="shrink-0 text-[10px] text-ds-muted">›</span>
    </button>
  );

  return (
    <div className="mx-auto max-w-lg space-y-6 py-2">
      <AckBanner />

      {Object.entries(upcomingByMonth).map(([month, monthShifts]) => (
        <div key={month}>
          <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-ds-muted">
            {formatMonthLabel(month)}
          </p>
          <div className="space-y-2">
            {monthShifts.map((s) => (
              <ShiftRow key={s.id} shift={s} />
            ))}
          </div>
        </div>
      ))}

      {past.length > 0 ? (
        <div>
          <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-ds-muted">Recent past shifts</p>
          <div className="space-y-2 opacity-60">
            {Object.entries(pastByMonth).map(([month, monthShifts]) => (
              <div key={month}>
                <p className="mb-1 px-1 text-[10px] text-ds-muted">{formatMonthLabel(month)}</p>
                {monthShifts.map((s) => (
                  <ShiftRow key={s.id} shift={s} />
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

