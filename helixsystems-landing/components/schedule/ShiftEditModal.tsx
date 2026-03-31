"use client";

import { AlertTriangle, CalendarDays, Clock, MapPin, Trash2, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { parseLocalDate } from "@/lib/schedule/calendar";
import { formatTimeRange } from "@/lib/schedule/time-format";
import type {
  ScheduleRoleDefinition,
  ScheduleSettings,
  Shift,
  ShiftEventType,
  ShiftTypeConfig,
  ShiftTypeKey,
  Worker,
  Zone,
} from "@/lib/schedule/types";
import { PulseDrawer } from "./PulseDrawer";

export type ShiftDraft = Omit<Shift, "id"> & { id?: string };

const PRIMARY_BTN =
  "rounded-[10px] bg-[#2B4C7E] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#234066] disabled:opacity-50";

const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-pulse-navy shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25";

const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-pulse-muted";

const QUICK_RANGES = [
  { label: "07:00–15:00", start: "07:00", end: "15:00" },
  { label: "15:00–23:00", start: "15:00", end: "23:00" },
];

type Props = {
  open: boolean;
  shift: Shift | null;
  defaultDate: string;
  workers: Worker[];
  zones: Zone[];
  roles: ScheduleRoleDefinition[];
  shiftTypes: ShiftTypeConfig[];
  settings: ScheduleSettings;
  /** All shifts for availability + coverage checks */
  allShifts: Shift[];
  onClose: () => void;
  onSave: (draft: ShiftDraft) => void;
  onDelete?: (id: string) => void;
};

function formatDateLong(iso: string): string {
  const d = parseLocalDate(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function workerBadge(
  workerId: string | null,
  date: string,
  shifts: Shift[],
  excludeShiftId: string | undefined,
): { text: string; className: string } {
  if (!workerId) {
    return {
      text: "Open slot",
      className: "bg-slate-100 text-pulse-muted ring-1 ring-slate-200/80",
    };
  }
  const other = shifts.filter(
    (s) => s.workerId === workerId && s.date === date && s.id !== excludeShiftId,
  );
  if (other.length === 0) {
    return {
      text: "Available",
      className: "bg-sky-50 text-[#2B4C7E] ring-1 ring-sky-200/80",
    };
  }
  return {
    text: "Scheduled",
    className: "bg-amber-50 text-amber-950 ring-1 ring-amber-200/80",
  };
}

function coverageMessage(
  draft: ShiftDraft,
  allShifts: Shift[],
  settings: ScheduleSettings,
  zoneLabel: string,
): string | null {
  if (!settings.staffing.requireSupervisor) return null;
  if (draft.eventType !== "work") return null;
  const exclude = draft.id;
  const dayInZone = allShifts.filter(
    (s) => s.date === draft.date && s.zoneId === draft.zoneId && s.id !== exclude,
  );
  const hasSup = dayInZone.some((s) => s.role === "supervisor" || s.role === "lead");
  const draftIsSup = draft.role === "supervisor" || draft.role === "lead";
  if (draftIsSup && draft.workerId) return null;
  if (!hasSup && dayInZone.length > 0 && draft.role === "worker") {
    return `This shift may create a coverage gap in ${zoneLabel}. Recommended: assign a lead or supervisor for this zone, or adjust times.`;
  }
  if (!hasSup && draft.role === "worker") {
    return `No supervisor or lead is currently assigned to ${zoneLabel} on this date. Confirm staffing before publishing.`;
  }
  return null;
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex rounded-[10px] border border-slate-200/80 bg-slate-100/85 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded-lg px-2 py-2 text-center text-xs font-semibold transition-colors sm:text-sm ${
              active
                ? "bg-white text-[#2B4C7E] shadow-sm ring-1 ring-slate-200/90"
                : "text-pulse-muted hover:bg-white/70 hover:text-pulse-navy"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function ShiftEditModal({
  open,
  shift,
  defaultDate,
  workers,
  zones,
  roles,
  shiftTypes,
  settings,
  allShifts,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const empty: ShiftDraft = useMemo(
    () => ({
      workerId: null,
      date: defaultDate,
      startTime: "06:00",
      endTime: "14:00",
      shiftType: "day",
      eventType: "work",
      role: "worker",
      zoneId: zones[0]?.id ?? "",
    }),
    [defaultDate, zones],
  );

  const [draft, setDraft] = useState<ShiftDraft>(empty);

  useEffect(() => {
    if (!open) return;
    if (shift) {
      setDraft({
        id: shift.id,
        workerId: shift.workerId,
        date: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        shiftType: shift.shiftType,
        eventType: shift.eventType ?? "work",
        role: shift.role,
        zoneId: shift.zoneId,
      });
    } else {
      setDraft(empty);
    }
  }, [open, shift, empty]);

  const zone = zones.find((z) => z.id === draft.zoneId);
  const zoneLabel = zone?.label ?? "this zone";
  const subtitle = `Configure workforce allocation for ${zoneLabel}`;
  const badge = workerBadge(draft.workerId, draft.date, allShifts, draft.id);
  const warnText = coverageMessage(draft, allShifts, settings, zoneLabel);
  const tf = settings.timeFormat;
  const preview = formatTimeRange(draft.startTime, draft.endTime, tf);

  const shiftTypeOptions = shiftTypes.map((t) => ({ value: t.key as ShiftTypeKey, label: t.label }));
  const eventOptions: { value: ShiftEventType; label: string }[] = [
    { value: "work", label: "Work" },
    { value: "training", label: "Training" },
    { value: "vacation", label: "Vacation" },
  ];

  const presetChips = [
    ...QUICK_RANGES,
    ...settings.shiftDurationPresets.map((p) => {
      const [sh, sm] = draft.startTime.split(":").map(Number);
      const startM = sh * 60 + sm;
      const endM = startM + p.hours * 60;
      const eh = Math.floor(endM / 60) % 24;
      const em = endM % 60;
      const end = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
      return { label: `${draft.startTime} → ${end} (${p.label})`, start: draft.startTime, end };
    }),
  ];

  return (
    <PulseDrawer
      open={open}
      title={shift ? "Edit shift" : "Create shift"}
      subtitle={subtitle}
      onClose={onClose}
      labelledBy="shift-drawer-title"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            {shift && onDelete ? (
              <button
                type="button"
                className="inline-flex items-center gap-2 text-sm font-semibold text-red-700 hover:text-red-800"
                onClick={() => {
                  onDelete(shift.id);
                  onClose();
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete shift
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" className="text-sm font-semibold text-pulse-muted hover:text-pulse-navy" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className={PRIMARY_BTN}
              onClick={() => onSave({ ...draft, eventType: draft.eventType ?? "work" })}
            >
              Confirm shift
            </button>
          </div>
        </div>
      }
    >
      <div className="mx-auto max-w-lg space-y-5">
        <div>
          <label className={LABEL} htmlFor="shift-worker">
            Worker
          </label>
          <div className="relative mt-1.5">
            <User
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pulse-muted"
              strokeWidth={2}
              aria-hidden
            />
            <select
              id="shift-worker"
              className={`${FIELD} appearance-none pl-10 pr-10`}
              value={draft.workerId ?? ""}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  workerId: e.target.value === "" ? null : e.target.value,
                }))
              }
            >
              <option value="">Unassigned</option>
              {workers
                .filter((w) => w.active)
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
            </select>
            <span
              className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.className}`}
            >
              {badge.text}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="shift-role">
              Role
            </label>
            <select
              id="shift-role"
              className={FIELD}
              value={draft.role}
              onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="shift-date">
              Date
            </label>
            <div className="relative mt-1.5">
              <CalendarDays
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pulse-muted"
                strokeWidth={2}
                aria-hidden
              />
              <input
                id="shift-date"
                type="date"
                className={`${FIELD} pl-10`}
                value={draft.date}
                onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
              />
            </div>
            <p className="mt-1 text-xs text-pulse-muted">{formatDateLong(draft.date)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className={LABEL}>Shift type</p>
            <div className="mt-1.5">
              <Segmented
                value={draft.shiftType}
                onChange={(v) => setDraft((d) => ({ ...d, shiftType: v }))}
                options={shiftTypeOptions}
              />
            </div>
          </div>
          <div>
            <p className={LABEL}>Event type</p>
            <div className="mt-1.5">
              <Segmented
                value={draft.eventType ?? "work"}
                onChange={(v) => setDraft((d) => ({ ...d, eventType: v }))}
                options={eventOptions}
              />
            </div>
          </div>
        </div>

        <div>
          <p className={LABEL}>Duration</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {presetChips.slice(0, 5).map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, startTime: p.start, endTime: p.end }))}
                className="rounded-lg border border-slate-200/90 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#2B4C7E] shadow-sm hover:bg-slate-50"
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="shift-start">
                Start
              </label>
              <div className="relative mt-1.5">
                <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pulse-muted" />
                <input
                  id="shift-start"
                  type="time"
                  className={`${FIELD} pl-10`}
                  value={draft.startTime}
                  onChange={(e) => setDraft((d) => ({ ...d, startTime: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className={LABEL} htmlFor="shift-end">
                End
              </label>
              <div className="relative mt-1.5">
                <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pulse-muted" />
                <input
                  id="shift-end"
                  type="time"
                  className={`${FIELD} pl-10`}
                  value={draft.endTime}
                  onChange={(e) => setDraft((d) => ({ ...d, endTime: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs text-pulse-muted">
            Preview: <span className="font-medium text-pulse-navy">{preview}</span> ({tf})
          </p>
        </div>

        <div>
          <label className={LABEL} htmlFor="shift-zone">
            Location
          </label>
          <div className="mt-1.5 rounded-[10px] border border-slate-200/90 bg-white p-4 shadow-sm">
            <div className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-pulse-muted">
                <MapPin className="h-4 w-4" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-pulse-muted">Selected location</p>
                <select
                  id="shift-zone"
                  className="mt-1 w-full border-0 bg-transparent p-0 text-base font-semibold text-pulse-navy focus:ring-0"
                  value={draft.zoneId}
                  onChange={(e) => setDraft((d) => ({ ...d, zoneId: e.target.value }))}
                >
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {warnText ? (
          <div className="flex gap-3 rounded-[10px] border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 shadow-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" strokeWidth={2} />
            <p>
              <span className="font-semibold">Alert: </span>
              {warnText}
            </p>
          </div>
        ) : null}
      </div>
    </PulseDrawer>
  );
}
