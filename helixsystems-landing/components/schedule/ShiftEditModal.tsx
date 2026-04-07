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
import { SegmentedControl } from "./SegmentedControl";

export type ShiftDraft = Omit<Shift, "id"> & { id?: string };

const PRIMARY_BTN =
  "rounded-[10px] bg-[#2B4C7E] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#234066] disabled:opacity-50";

const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-pulseShell-border bg-pulseShell-surface px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25 dark:text-gray-100 dark:focus:border-blue-400/40 dark:focus:ring-blue-400/25";

const LABEL =
  "text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400";

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
      className:
        "bg-gray-100 text-gray-500 ring-1 ring-gray-200/80 dark:bg-pulseShell-elevated dark:text-slate-400 dark:ring-pulseShell-border",
    };
  }
  const other = shifts.filter(
    (s) => s.workerId === workerId && s.date === date && s.id !== excludeShiftId,
  );
  if (other.length === 0) {
    return {
      text: "Available",
      className: "bg-sky-50 text-[#2B4C7E] ring-1 ring-sky-200/80 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-500/25",
    };
  }
  return {
    text: "Scheduled",
    className: "bg-amber-50 text-amber-950 ring-1 ring-amber-200/80 dark:bg-amber-950/35 dark:text-amber-200 dark:ring-amber-500/25",
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
      required_certifications: [],
      accepts_any_certification: false,
      requires_supervisor: false,
      minimum_workers: undefined,
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
        required_certifications: shift.required_certifications ?? [],
        accepts_any_certification: shift.accepts_any_certification === true,
        requires_supervisor: shift.requires_supervisor ?? false,
        minimum_workers: shift.minimum_workers,
        uiFlags: shift.uiFlags,
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
            <button type="button" className="text-sm font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className={PRIMARY_BTN}
              onClick={() =>
                onSave({
                  ...draft,
                  eventType: draft.eventType ?? "work",
                  required_certifications: (draft.required_certifications ?? []).filter(Boolean),
                })
              }
            >
              Confirm shift
            </button>
          </div>
        </div>
      }
    >
      <div className="mx-auto max-w-lg space-y-5">
        <div>
          <div className="flex items-center justify-between gap-2">
            <label className={LABEL} htmlFor="shift-worker">
              Worker
            </label>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.className}`}>
              {badge.text}
            </span>
          </div>
          <div className="relative mt-1.5">
            <User
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400"
              strokeWidth={2}
              aria-hidden
            />
            <select
              id="shift-worker"
              className={`${FIELD} appearance-none pl-10 pr-4`}
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
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400"
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
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{formatDateLong(draft.date)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className={LABEL}>Shift type</p>
            <div className="mt-1.5">
              <SegmentedControl
                value={draft.shiftType}
                onChange={(v) => setDraft((d) => ({ ...d, shiftType: v }))}
                options={shiftTypeOptions}
              />
            </div>
          </div>
          <div>
            <p className={LABEL}>Event type</p>
            <div className="mt-1.5">
              <SegmentedControl
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
            {presetChips.slice(0, 5).map((p, i) => (
              <button
                key={`${p.label}-${i}`}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, startTime: p.start, endTime: p.end }))}
                className="rounded-lg border border-pulseShell-border bg-pulseShell-elevated px-2.5 py-1.5 text-xs font-semibold text-[#2B4C7E] shadow-sm hover:bg-pulseShell-surface dark:text-blue-300"
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
                <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
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
                <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
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
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Preview: <span className="font-medium text-gray-900 dark:text-gray-100">{preview}</span> ({tf})
          </p>
        </div>

        <div className="rounded-[10px] border border-pulseShell-border/70 bg-gray-50/50 p-4 dark:bg-pulseShell-elevated/40">
          <p className={LABEL}>Shift requirements (optional)</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Used for warning badges only — you can still save with conflicts. Built-in codes: RO, P1, P2, FA (custom
            tags work too).
          </p>
          <div className="mt-3 space-y-3">
            <div>
              <label className={LABEL} htmlFor="shift-certs">
                Required certifications (comma-separated)
              </label>
              <input
                id="shift-certs"
                type="text"
                className={FIELD}
                placeholder="e.g. RO, P1, P2, FA, OSHA-10"
                value={(draft.required_certifications ?? []).join(", ")}
                onChange={(e) =>
                  setDraft((d) => {
                    const required_certifications = e.target.value
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean);
                    return {
                      ...d,
                      required_certifications,
                      accepts_any_certification:
                        required_certifications.length > 1 ? d.accepts_any_certification : false,
                    };
                  })
                }
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-900 dark:text-gray-100">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-pulseShell-border text-[#2B4C7E]"
                checked={draft.accepts_any_certification === true}
                disabled={!(draft.required_certifications && draft.required_certifications.length > 1)}
                onChange={(e) => setDraft((d) => ({ ...d, accepts_any_certification: e.target.checked }))}
              />
              Worker may satisfy with any one of the listed certifications
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-900 dark:text-gray-100">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-pulseShell-border text-[#2B4C7E]"
                checked={draft.requires_supervisor === true}
                onChange={(e) => setDraft((d) => ({ ...d, requires_supervisor: e.target.checked }))}
              />
              Require supervisor / lead in zone (stricter check for this shift)
            </label>
            <div>
              <label className={LABEL} htmlFor="shift-min-workers">
                Minimum workers in zone (empty = use org default)
              </label>
              <input
                id="shift-min-workers"
                type="number"
                min={1}
                className={FIELD}
                placeholder={`Default: ${settings.staffing.minWorkersPerShift}`}
                value={draft.minimum_workers ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraft((d) => ({
                    ...d,
                    minimum_workers: v === "" ? undefined : Math.max(1, parseInt(v, 10) || 1),
                  }));
                }}
              />
            </div>
          </div>
        </div>

        <div>
          <label className={LABEL} htmlFor="shift-zone">
            Location
          </label>
          <div className="mt-1.5 rounded-[10px] border border-pulseShell-border bg-pulseShell-surface p-4 shadow-[var(--pulse-shell-shadow)]">
            <div className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-pulseShell-elevated dark:text-slate-400">
                <MapPin className="h-4 w-4" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Selected location</p>
                <select
                  id="shift-zone"
                  className="mt-1 w-full border-0 bg-transparent p-0 text-base font-semibold text-gray-900 dark:text-gray-100 focus:ring-0"
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
